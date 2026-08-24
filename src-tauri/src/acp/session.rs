use crate::acp::bridge::AcpBridge;
use crate::acp::protocol::{
    AcpClientCapabilities, AcpClientInfo, AcpInitializeParams, AcpRpcRequest, AcpRpcResponse,
    AcpSessionEvent, AcpUpdateChunk,
};
use crate::agents::adapter::find_binary_in_path;
use anyhow::{anyhow, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{oneshot, Mutex, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcpAgentStatus {
    pub agent_id: String,
    pub name: String,
    pub status: String, // "connected" | "idle" | "error" | "disconnected"
    pub version: Option<String>,
    pub protocol_version: String,
    pub session_id: Option<String>,
}

pub struct AcpHostManager {
    bridge: Arc<AcpBridge>,
    active_processes: Arc<Mutex<HashMap<String, tokio::process::Child>>>,
    pending_approvals: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
    stdin_writers: Arc<Mutex<HashMap<String, tokio::process::ChildStdin>>>,
    connected_agents: Arc<RwLock<HashMap<String, AcpAgentStatus>>>,
}

impl Default for AcpHostManager {
    fn default() -> Self {
        Self::new()
    }
}

impl AcpHostManager {
    pub fn new() -> Self {
        Self {
            bridge: Arc::new(AcpBridge::new()),
            active_processes: Arc::new(Mutex::new(HashMap::new())),
            pending_approvals: Arc::new(Mutex::new(HashMap::new())),
            stdin_writers: Arc::new(Mutex::new(HashMap::new())),
            connected_agents: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn bridge(&self) -> Arc<AcpBridge> {
        self.bridge.clone()
    }

    pub async fn get_connected_agents(&self) -> Vec<AcpAgentStatus> {
        let map = self.connected_agents.read().await;
        map.values().cloned().collect()
    }

    pub async fn start_session(
        &self,
        app: AppHandle,
        agent_id: String,
        session_id: String,
    ) -> Result<AcpAgentStatus> {
        let (binary_name, acp_args): (&str, Vec<&str>) = match agent_id.as_str() {
            "opencode" => ("opencode", vec!["acp"]),
            "gemini" | "agy" => ("gemini", vec!["--acp"]),
            "codex" => ("codex", vec!["app-server"]),
            "claude" => ("claude", vec![]),
            _ => (agent_id.as_str(), vec![]),
        };

        let binary_path = find_binary_in_path(binary_name)
            .ok_or_else(|| anyhow!("Agent binary '{}' not found in PATH", binary_name))?;

        let mut cmd = tokio::process::Command::new(&binary_path);
        cmd.args(&acp_args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd
            .spawn()
            .map_err(|e| anyhow!("Failed to spawn ACP agent process: {}", e))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| anyhow!("Failed to capture stdin"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow!("Failed to capture stdout"))?;
        let stderr = child.stderr.take();

        {
            let mut procs = self.active_processes.lock().await;
            procs.insert(session_id.clone(), child);
            let mut stdins = self.stdin_writers.lock().await;
            stdins.insert(session_id.clone(), stdin);
        }

        let status = AcpAgentStatus {
            agent_id: agent_id.clone(),
            name: match agent_id.as_str() {
                "codex" => "Codex CLI",
                "claude" => "Claude Code",
                "opencode" => "OpenCode",
                "gemini" => "Gemini CLI",
                _ => &agent_id,
            }
            .to_string(),
            status: "connected".into(),
            version: None,
            protocol_version: "2025-08-01 (ACP v1)".into(),
            session_id: Some(session_id.clone()),
        };

        {
            let mut map = self.connected_agents.write().await;
            map.insert(agent_id.clone(), status.clone());
        }

        let _ = app.emit("acp://status", status.clone());

        // Send ACP initialize request
        let init_req = AcpRpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(json!(1)),
            method: "initialize".into(),
            params: Some(serde_json::to_value(AcpInitializeParams {
                protocol_version: "2025-08-01".into(),
                client_info: AcpClientInfo {
                    name: "NodaDB".into(),
                    version: "0.3.11".into(),
                },
                capabilities: AcpClientCapabilities {
                    database: true,
                    filesystem: true,
                    terminal: true,
                    streaming: true,
                    tool_approvals: true,
                    commands: AcpBridge::get_command_capabilities(),
                },
            })?),
        };

        self.send_raw_json(&session_id, &init_req).await?;

        // Spawn async reader loop
        let app_clone = app.clone();
        let sid_clone = session_id.clone();
        let agent_id_clone = agent_id.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }

                if let Ok(resp) = serde_json::from_str::<AcpRpcResponse>(trimmed) {
                    if let Some(res) = resp.result {
                        let _ = app_clone.emit(
                            "acp://session_update",
                            AcpSessionEvent {
                                session_id: sid_clone.clone(),
                                agent_id: agent_id_clone.clone(),
                                chunk: AcpUpdateChunk::MessageChunk {
                                    text: res.to_string(),
                                },
                                timestamp: Utc::now().format("%H:%M:%S").to_string(),
                            },
                        );
                    }
                } else if let Ok(req) = serde_json::from_str::<AcpRpcRequest>(trimmed) {
                    // Handle agent-initiated notifications or requests
                    if req.method == "session/update" {
                        if let Some(params) = req.params {
                            let chunk: AcpUpdateChunk = serde_json::from_value(params)
                                .unwrap_or_else(|_| AcpUpdateChunk::MessageChunk {
                                    text: trimmed.to_string(),
                                });
                            let _ = app_clone.emit(
                                "acp://session_update",
                                AcpSessionEvent {
                                    session_id: sid_clone.clone(),
                                    agent_id: agent_id_clone.clone(),
                                    chunk,
                                    timestamp: Utc::now().format("%H:%M:%S").to_string(),
                                },
                            );
                        }
                    } else {
                        // Plain text / message chunk fallback
                        let _ = app_clone.emit(
                            "acp://session_update",
                            AcpSessionEvent {
                                session_id: sid_clone.clone(),
                                agent_id: agent_id_clone.clone(),
                                chunk: AcpUpdateChunk::MessageChunk {
                                    text: trimmed.to_string(),
                                },
                                timestamp: Utc::now().format("%H:%M:%S").to_string(),
                            },
                        );
                    }
                } else {
                    // Plain line stream fallback
                    let _ = app_clone.emit(
                        "acp://session_update",
                        AcpSessionEvent {
                            session_id: sid_clone.clone(),
                            agent_id: agent_id_clone.clone(),
                            chunk: AcpUpdateChunk::MessageChunk {
                                text: trimmed.to_string(),
                            },
                            timestamp: Utc::now().format("%H:%M:%S").to_string(),
                        },
                    );
                }
            }
        });

        // Stderr logger
        if let Some(err) = stderr {
            tokio::spawn(async move {
                let mut reader = BufReader::new(err).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    eprintln!("[acp-stderr] {}", line);
                }
            });
        }

        Ok(status)
    }

    pub async fn send_prompt(
        &self,
        session_id: &str,
        prompt: &str,
        context: Option<Value>,
    ) -> Result<()> {
        let req = AcpRpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(json!(Utc::now().timestamp_millis())),
            method: "session/prompt".into(),
            params: Some(json!({
                "prompt": prompt,
                "context": context
            })),
        };

        self.send_raw_json(session_id, &req).await
    }

    async fn send_raw_json(&self, session_id: &str, req: &AcpRpcRequest) -> Result<()> {
        let mut writers = self.stdin_writers.lock().await;
        if let Some(stdin) = writers.get_mut(session_id) {
            let json_str = serde_json::to_string(req)?;
            stdin.write_all(json_str.as_bytes()).await?;
            stdin.write_all(b"\n").await?;
            stdin.flush().await?;
            Ok(())
        } else {
            Err(anyhow!(
                "No active stdin writer for session '{}'",
                session_id
            ))
        }
    }

    pub async fn approve_tool_call(&self, call_id: &str, approved: bool) -> Result<()> {
        let mut pending = self.pending_approvals.lock().await;
        if let Some(sender) = pending.remove(call_id) {
            let _ = sender.send(approved);
            Ok(())
        } else {
            Err(anyhow!(
                "No pending approval found for call_id '{}'",
                call_id
            ))
        }
    }

    pub async fn stop_session(&self, app: &AppHandle, session_id: &str) -> Result<()> {
        let mut procs = self.active_processes.lock().await;
        if let Some(mut child) = procs.remove(session_id) {
            let _ = child.kill().await;
        }
        let mut writers = self.stdin_writers.lock().await;
        writers.remove(session_id);

        let _ = app.emit(
            "acp://status",
            json!({ "session_id": session_id, "status": "disconnected" }),
        );
        Ok(())
    }
}
