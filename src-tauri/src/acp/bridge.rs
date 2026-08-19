use crate::acp::protocol::{AcpCommandCapability, AcpRecentCommandEntry};
use crate::database::ConnectionManager;
use crate::models::DatabaseType;
use anyhow::{anyhow, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcpExecutionResult {
    pub success: bool,
    pub result: Value,
    pub ui_action: Option<String>,
}

pub struct AcpBridge {
    recent_commands: Arc<RwLock<Vec<AcpRecentCommandEntry>>>,
}

impl Default for AcpBridge {
    fn default() -> Self {
        Self::new()
    }
}

impl AcpBridge {
    pub fn new() -> Self {
        Self {
            recent_commands: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub fn get_command_capabilities() -> Vec<AcpCommandCapability> {
        vec![
            AcpCommandCapability {
                command: "/schema".into(),
                description: "Inspect visual database schema, tables, columns, and foreign keys".into(),
                arguments: vec!["table_name (optional)".into()],
                requires_permission: "SCHEMA".into(),
                requires_confirmation: false,
            },
            AcpCommandCapability {
                command: "/flow".into(),
                description: "Trace entity relationships and foreign key dependencies across tables".into(),
                arguments: vec!["entity_or_id".into()],
                requires_permission: "SCHEMA".into(),
                requires_confirmation: false,
            },
            AcpCommandCapability {
                command: "/explain".into(),
                description: "Explain SQL query execution plan and analyze performance bottlenecks".into(),
                arguments: vec!["sql".into(), "analyze (optional boolean)".into()],
                requires_permission: "EXPLAIN".into(),
                requires_confirmation: false,
            },
            AcpCommandCapability {
                command: "/query".into(),
                description: "Execute SQL queries (SELECT reads data; DML requires approval)".into(),
                arguments: vec!["sql".into()],
                requires_permission: "READ".into(),
                requires_confirmation: true,
            },
            AcpCommandCapability {
                command: "/table".into(),
                description: "Inspect table columns, indexes, and constraints in detail".into(),
                arguments: vec!["table_name".into()],
                requires_permission: "READ".into(),
                requires_confirmation: false,
            },
            AcpCommandCapability {
                command: "/indexes".into(),
                description: "List and analyze indexes for a table".into(),
                arguments: vec!["table_name".into()],
                requires_permission: "READ".into(),
                requires_confirmation: false,
            },
            AcpCommandCapability {
                command: "/export".into(),
                description: "Export table structure or query results".into(),
                arguments: vec!["table_name".into(), "format".into()],
                requires_permission: "EXPORT".into(),
                requires_confirmation: false,
            },
        ]
    }

    pub async fn execute_command(
        &self,
        app: &AppHandle,
        manager: &ConnectionManager,
        agent_id: &str,
        command: &str,
        args: &Value,
        connection_id: Option<&str>,
        db_type: Option<&DatabaseType>,
    ) -> Result<AcpExecutionResult> {
        let start = std::time::Instant::now();
        let cmd = command.trim();

        let mut ui_action = None;
        let mut result = json!(null);

        let cid = connection_id.ok_or_else(|| anyhow!("No active database connection"))?;
        let dt = db_type.unwrap_or(&DatabaseType::SQLite);

        match cmd {
            "/schema" | "schema" => {
                let table_name = args.get("table_name").and_then(|v| v.as_str());
                if let Some(tbl) = table_name {
                    let cols = manager.get_table_structure(cid, tbl, dt).await?;
                    let indexes = manager.get_table_indexes(cid, tbl, dt).await.unwrap_or_default();
                    result = json!({ "table": tbl, "columns": cols, "indexes": indexes });
                } else {
                    let tables = manager.list_tables(cid, dt).await?;
                    result = json!({ "tables": tables });
                }
                ui_action = Some("open_schema_designer".into());
                let _ = app.emit("noda://ui_action", json!({ "action": "open_tab", "tab": "schema", "table": table_name }));
            }

            "/flow" | "flow" => {
                let value = args.get("value")
                    .or_else(|| args.get("entity_or_id"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let relations = manager.trace_id_relations(cid, value, dt).await.unwrap_or_default();
                result = json!({ "search_value": value, "matches": relations });
                ui_action = Some("open_relation_flow".into());
                let _ = app.emit("noda://ui_action", json!({ "action": "open_tab", "tab": "relation-flow", "value": value }));
            }

            "/explain" | "explain" => {
                let sql = args.get("sql").and_then(|v| v.as_str()).ok_or_else(|| anyhow!("sql required"))?;
                let analyze = args.get("analyze").and_then(|v| v.as_bool()).unwrap_or(false);
                let plan = manager.explain_query(cid, sql, analyze, dt).await?;
                result = json!(plan);
            }

            "/table" | "table" => {
                let table_name = args.get("table_name").and_then(|v| v.as_str()).ok_or_else(|| anyhow!("table_name required"))?;
                let cols = manager.get_table_structure(cid, table_name, dt).await?;
                let indexes = manager.get_table_indexes(cid, table_name, dt).await.unwrap_or_default();
                let constraints = manager.get_table_constraints(cid, table_name, dt).await.unwrap_or_default();
                result = json!({ "table": table_name, "columns": cols, "indexes": indexes, "constraints": constraints });
            }

            "/indexes" | "indexes" => {
                let table_name = args.get("table_name").and_then(|v| v.as_str()).ok_or_else(|| anyhow!("table_name required"))?;
                let indexes = manager.get_table_indexes(cid, table_name, dt).await?;
                result = json!({ "indexes": indexes });
            }

            "/query" | "query" => {
                let sql = args.get("sql").and_then(|v| v.as_str()).ok_or_else(|| anyhow!("sql required"))?;
                let qr = manager.execute_query(cid, sql).await?;
                result = json!(qr);
            }

            _ => {
                return Err(anyhow!("Unknown ACP command: {}", cmd));
            }
        }

        let duration_ms = start.elapsed().as_millis() as u64;
        let entry = AcpRecentCommandEntry {
            id: format!("cmd-{}", Utc::now().timestamp_millis()),
            timestamp: Utc::now().format("%H:%M:%S").to_string(),
            agent_id: agent_id.to_string(),
            command: cmd.to_string(),
            arguments: args.clone(),
            status: "executed".into(),
            duration_ms,
            ui_action_triggered: ui_action.clone(),
        };

        {
            let mut rec = self.recent_commands.write().await;
            rec.insert(0, entry.clone());
            if rec.len() > 100 {
                rec.pop();
            }
        }

        let _ = app.emit("acp://command_executed", entry);

        Ok(AcpExecutionResult {
            success: true,
            result,
            ui_action,
        })
    }

    pub async fn get_recent_commands(&self) -> Vec<AcpRecentCommandEntry> {
        let rec = self.recent_commands.read().await;
        rec.clone()
    }
}
