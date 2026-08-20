use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentOutputEvent {
    pub session_id: String,
    pub text: String,
    pub stream: String, // "stdout" | "stderr"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStatusEvent {
    pub session_id: String,
    pub agent_id: String,
    pub status: String, // "started" | "completed" | "failed" | "killed"
    pub exit_code: Option<i32>,
    pub error: Option<String>,
}

pub struct AgentSessionManager {
    active_sessions: Arc<Mutex<HashMap<String, tokio::process::Child>>>,
}

impl Default for AgentSessionManager {
    fn default() -> Self {
        Self::new()
    }
}

impl AgentSessionManager {
    pub fn new() -> Self {
        Self {
            active_sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn spawn_session(
        &self,
        app: AppHandle,
        session_id: String,
        agent_id: String,
        mut command: tokio::process::Command,
    ) -> Result<()> {
        command
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null());

        let mut child = command
            .spawn()
            .map_err(|e| anyhow!("Failed to spawn agent process: {}", e))?;

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        {
            let mut lock = self.active_sessions.lock().await;
            lock.insert(session_id.clone(), child);
        }

        // Notify started
        let _ = app.emit(
            "agent://status",
            AgentStatusEvent {
                session_id: session_id.clone(),
                agent_id: agent_id.clone(),
                status: "started".into(),
                exit_code: None,
                error: None,
            },
        );

        let app_stdout = app.clone();
        let sid_stdout = session_id.clone();
        let stdout_handle = tokio::spawn(async move {
            if let Some(out) = stdout {
                let mut reader = BufReader::new(out).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = app_stdout.emit(
                        "agent://stdout",
                        AgentOutputEvent {
                            session_id: sid_stdout.clone(),
                            text: line,
                            stream: "stdout".into(),
                        },
                    );
                }
            }
        });

        let app_stderr = app.clone();
        let sid_stderr = session_id.clone();
        let stderr_handle = tokio::spawn(async move {
            if let Some(err) = stderr {
                let mut reader = BufReader::new(err).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = app_stderr.emit(
                        "agent://stderr",
                        AgentOutputEvent {
                            session_id: sid_stderr.clone(),
                            text: line,
                            stream: "stderr".into(),
                        },
                    );
                }
            }
        });

        let sessions_map = self.active_sessions.clone();
        let sid_monitor = session_id.clone();

        tokio::spawn(async move {
            let _ = stdout_handle.await;
            let _ = stderr_handle.await;

            let mut status = "completed";
            let mut exit_code = None;
            let mut error = None;

            let mut lock = sessions_map.lock().await;
            if let Some(mut child) = lock.remove(&sid_monitor) {
                match child.wait().await {
                    Ok(exit_status) => {
                        exit_code = exit_status.code();
                        if !exit_status.success() {
                            status = "failed";
                        }
                    }
                    Err(e) => {
                        status = "failed";
                        error = Some(e.to_string());
                    }
                }
            }

            let _ = app.emit(
                "agent://status",
                AgentStatusEvent {
                    session_id: sid_monitor,
                    agent_id,
                    status: status.into(),
                    exit_code,
                    error,
                },
            );
        });

        Ok(())
    }

    pub async fn kill_session(&self, app: &AppHandle, session_id: &str) -> Result<()> {
        let mut lock = self.active_sessions.lock().await;
        if let Some(mut child) = lock.remove(session_id) {
            let _ = child.kill().await;
            let _ = app.emit(
                "agent://status",
                AgentStatusEvent {
                    session_id: session_id.to_string(),
                    agent_id: "".into(),
                    status: "killed".into(),
                    exit_code: None,
                    error: Some("Session stopped by user".into()),
                },
            );
        }
        Ok(())
    }
}
