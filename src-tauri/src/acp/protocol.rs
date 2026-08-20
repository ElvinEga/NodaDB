use serde::{Deserialize, Serialize};
use serde_json::Value;

// ─── ACP JSON-RPC 2.0 Types ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcpRpcRequest {
    pub jsonrpc: String,
    pub id: Option<Value>,
    pub method: String,
    pub params: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcpRpcResponse {
    pub jsonrpc: String,
    pub id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<AcpRpcError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcpRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

impl AcpRpcResponse {
    pub fn success(id: Value, result: Value) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            id,
            result: Some(result),
            error: None,
        }
    }

    pub fn error(id: Value, code: i32, message: impl Into<String>) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            id,
            result: None,
            error: Some(AcpRpcError {
                code,
                message: message.into(),
                data: None,
            }),
        }
    }
}

// ─── ACP Handshake & Capabilities ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcpClientInfo {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcpCommandCapability {
    pub command: String,
    pub description: String,
    pub arguments: Vec<String>,
    pub requires_permission: String,
    pub requires_confirmation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcpClientCapabilities {
    pub database: bool,
    pub filesystem: bool,
    pub terminal: bool,
    pub streaming: bool,
    pub tool_approvals: bool,
    pub commands: Vec<AcpCommandCapability>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcpInitializeParams {
    pub protocol_version: String,
    pub client_info: AcpClientInfo,
    pub capabilities: AcpClientCapabilities,
}

// ─── Session Updates & Messages ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AcpUpdateChunk {
    Thought { text: String },
    MessageChunk { text: String },
    ToolCall {
        call_id: String,
        tool: String,
        arguments: Value,
        requires_approval: bool,
    },
    PlanStep { step: String, status: String },
    Completed { summary: Option<String> },
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcpSessionEvent {
    pub session_id: String,
    pub agent_id: String,
    pub chunk: AcpUpdateChunk,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcpToolApprovalRequest {
    pub session_id: String,
    pub call_id: String,
    pub agent_id: String,
    pub command: String,
    pub arguments: Value,
    pub reason: String,
    pub destructive: bool,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcpRecentCommandEntry {
    pub id: String,
    pub timestamp: String,
    pub agent_id: String,
    pub command: String,
    pub arguments: Value,
    pub status: String, // "executed" | "rejected" | "failed"
    pub duration_ms: u64,
    pub ui_action_triggered: Option<String>,
}
