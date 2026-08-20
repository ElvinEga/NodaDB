//! NodaDB MCP Server — exposes database operations as MCP tools over stdio.
//!
//! Usage:
//!   DATABASE_URL=postgres://user:pass@host/db NODADB_AGENT_ID=claude-code nodadb-mcp
//!
//! All logs go to stderr. stdout is reserved for JSON-RPC 2.0 messages.

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::any::{AnyPoolOptions, AnyRow};
use sqlx::{Column, Executor, Row, TypeInfo};
use std::collections::HashMap;
use std::env;
use std::path::PathBuf;
use tokio::io::{self, AsyncBufReadExt, AsyncWriteExt, BufReader};

// ─── JSON-RPC 2.0 types ───────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    #[allow(dead_code)]
    jsonrpc: String,
    #[allow(dead_code)]
    id: Option<Value>,
    method: String,
    params: Option<Value>,
}

#[derive(Debug, Serialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize)]
struct JsonRpcError {
    code: i32,
    message: String,
}

impl JsonRpcResponse {
    fn ok(id: Value, result: Value) -> Self {
        Self { jsonrpc: "2.0".into(), id, result: Some(result), error: None }
    }
    fn err(id: Value, code: i32, msg: impl Into<String>) -> Self {
        Self { jsonrpc: "2.0".into(), id, result: None, error: Some(JsonRpcError { code, message: msg.into() }) }
    }
}

// ─── Agent Config (read from ~/.config/nodadb/agents.json) ───────────────────

#[derive(Debug, Deserialize, Default)]
struct AgentConfig {
    id: String,
    #[allow(dead_code)]
    name: String,
    permissions: Vec<String>,
    trusted: bool,
}

fn default_permissions(agent_id: &str) -> Vec<String> {
    match agent_id {
        "claude-code" | "gemini-cli" | "opencode" => vec!["READ".into(), "EXPLAIN".into(), "SCHEMA".into()],
        "codex" | "aider" => vec!["READ".into(), "WRITE".into(), "EXPLAIN".into(), "SCHEMA".into()],
        _ => vec!["READ".into(), "EXPLAIN".into()],
    }
}

fn load_agent_config(agent_id: &str) -> AgentConfig {
    let home = env::var("HOME").or_else(|_| env::var("USERPROFILE")).unwrap_or_default();
    if home.is_empty() {
        return AgentConfig {
            id: agent_id.to_string(),
            name: agent_id.to_string(),
            permissions: default_permissions(agent_id),
            trusted: false,
        };
    }

    let path = PathBuf::from(&home).join(".config/nodadb/agents.json");
    if let Ok(content) = std::fs::read_to_string(&path) {
        if let Ok(configs) = serde_json::from_str::<Vec<AgentConfig>>(&content) {
            if let Some(cfg) = configs.into_iter().find(|c| c.id == agent_id) {
                return cfg;
            }
        }
    }

    AgentConfig {
        id: agent_id.to_string(),
        name: agent_id.to_string(),
        permissions: default_permissions(agent_id),
        trusted: false,
    }
}

// ─── Row → JSON ───────────────────────────────────────────────────────────────

fn row_to_json(row: &AnyRow) -> Value {
    let mut map = serde_json::Map::new();
    for col in row.columns() {
        let name = col.name().to_string();
        let type_name = col.type_info().name().to_lowercase();
        let val: Value = if type_name.contains("int") || type_name.contains("serial") {
            row.try_get::<i64, _>(col.ordinal())
                .map(|v| json!(v))
                .or_else(|_| row.try_get::<i32, _>(col.ordinal()).map(|v| json!(v)))
                .unwrap_or(Value::Null)
        } else if type_name.contains("float") || type_name.contains("double") || type_name.contains("real") || type_name.contains("numeric") || type_name.contains("decimal") {
            row.try_get::<f64, _>(col.ordinal())
                .map(|v| json!(v))
                .unwrap_or(Value::Null)
        } else if type_name.contains("bool") {
            row.try_get::<bool, _>(col.ordinal())
                .map(|v| json!(v))
                .unwrap_or(Value::Null)
        } else {
            row.try_get::<String, _>(col.ordinal())
                .map(|v| json!(v))
                .unwrap_or(Value::Null)
        };
        map.insert(name, val);
    }
    Value::Object(map)
}

// ─── Query result helper ──────────────────────────────────────────────────────

async fn fetch_all_json(pool: &sqlx::AnyPool, sql: &str) -> Result<Value> {
    let rows = sqlx::query(sql).fetch_all(pool).await?;
    let result: Vec<Value> = rows.iter().map(row_to_json).collect();
    let columns: Vec<String> = if let Some(first) = rows.first() {
        first.columns().iter().map(|c| c.name().to_string()).collect()
    } else {
        vec![]
    };
    Ok(json!({ "columns": columns, "rows": result, "row_count": result.len() }))
}

// ─── Tool definitions (for tools/list) ───────────────────────────────────────

fn tool_definitions() -> Value {
    json!([
        {
            "name": "explore",
            "description": "List all tables in the connected database. Permission: READ.",
            "inputSchema": { "type": "object", "properties": {}, "required": [] }
        },
        {
            "name": "schema",
            "description": "Get table structure: columns, types, primary keys, nullability. Permission: READ.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "table_name": { "type": "string", "description": "Name of the table to inspect" }
                },
                "required": ["table_name"]
            }
        },
        {
            "name": "indexes",
            "description": "List indexes for a table. Permission: READ.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "table_name": { "type": "string", "description": "Table name" }
                },
                "required": ["table_name"]
            }
        },
        {
            "name": "query",
            "description": "Execute a SQL query. SELECT requires READ. DML (INSERT/UPDATE/DELETE) requires WRITE + confirmed=true.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "sql": { "type": "string", "description": "SQL statement to execute" },
                    "confirmed": { "type": "boolean", "description": "Set to true to confirm DML execution" }
                },
                "required": ["sql"]
            }
        },
        {
            "name": "explain",
            "description": "Get the execution plan for a SQL query. Permission: EXPLAIN.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "sql": { "type": "string", "description": "SQL query to explain" },
                    "analyze": { "type": "boolean", "description": "Run EXPLAIN ANALYZE (executes the query)" }
                },
                "required": ["sql"]
            }
        },
        {
            "name": "context",
            "description": "Get full database context: all tables with column summaries. Permission: READ.",
            "inputSchema": { "type": "object", "properties": {}, "required": [] }
        },
        {
            "name": "status",
            "description": "Show agent info: ID, permissions, trusted flag, connection status.",
            "inputSchema": { "type": "object", "properties": {}, "required": [] }
        },
        {
            "name": "insert",
            "description": "Insert a row into a table. Permission: WRITE.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "table_name": { "type": "string" },
                    "data": { "type": "object", "description": "Key-value pairs for the new row" }
                },
                "required": ["table_name", "data"]
            }
        },
        {
            "name": "update",
            "description": "Update rows matching a WHERE clause. Permission: WRITE. Requires confirmed=true.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "table_name": { "type": "string" },
                    "set": { "type": "object", "description": "Column-value pairs to update" },
                    "where_clause": { "type": "string", "description": "WHERE clause (without WHERE keyword)" },
                    "confirmed": { "type": "boolean" }
                },
                "required": ["table_name", "set", "where_clause"]
            }
        },
        {
            "name": "delete",
            "description": "Delete rows matching a WHERE clause. Permission: WRITE. Requires confirmed=true.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "table_name": { "type": "string" },
                    "where_clause": { "type": "string" },
                    "confirmed": { "type": "boolean" }
                },
                "required": ["table_name", "where_clause"]
            }
        }
    ])
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

struct McpServer {
    pool: sqlx::AnyPool,
    agent_id: String,
    permissions: Vec<String>,
    trusted: bool,
    db_url: String,
}

impl McpServer {
    async fn new() -> Result<Self> {
        sqlx::any::install_default_drivers();

        let db_url = env::var("DATABASE_URL")
            .map_err(|_| anyhow!("DATABASE_URL environment variable is required.\nExample: postgres://user:pass@host/db"))?;

        let agent_id = env::var("NODADB_AGENT_ID").unwrap_or_else(|_| "default".to_string());
        let config = load_agent_config(&agent_id);

        eprintln!("[nodadb-mcp] Agent: {}", agent_id);
        eprintln!("[nodadb-mcp] Permissions: {:?}", config.permissions);
        eprintln!("[nodadb-mcp] Connecting to database...");

        let pool = AnyPoolOptions::new()
            .max_connections(5)
            .connect(&db_url)
            .await
            .map_err(|e| anyhow!("Failed to connect to database: {}", e))?;

        eprintln!("[nodadb-mcp] Connected. Serving over stdio.");

        Ok(Self { pool, agent_id, permissions: config.permissions, trusted: config.trusted, db_url })
    }

    fn has_permission(&self, perm: &str) -> bool {
        self.permissions.iter().any(|p| p == perm)
    }

    fn require_permission(&self, perm: &str) -> Result<()> {
        if !self.has_permission(perm) {
            Err(anyhow!(
                "Permission denied: {} permission required. Agent '{}' has: {}",
                perm, self.agent_id, self.permissions.join(", ")
            ))
        } else {
            Ok(())
        }
    }

    fn confirmation_response(operation: &str, preview: &str) -> Value {
        json!({
            "content": [{
                "type": "text",
                "text": serde_json::to_string(&json!({
                    "requires_confirmation": true,
                    "operation": operation,
                    "preview": preview,
                    "message": format!("This will {} data. Call again with confirmed=true to proceed.", operation),
                    "call_again_with": { "confirmed": true }
                })).unwrap_or_default()
            }]
        })
    }

    fn content_text(text: impl Into<String>) -> Value {
        json!({ "content": [{ "type": "text", "text": text.into() }] })
    }

    async fn handle_tool(&self, name: &str, args: &Value) -> Result<Value> {
        match name {
            "explore" => {
                self.require_permission("READ")?;
                // Try to detect DB type and use appropriate system table query
                let sql = self.list_tables_sql();
                let result = fetch_all_json(&self.pool, &sql).await?;
                Ok(Self::content_text(serde_json::to_string_pretty(&result)?))
            }

            "schema" => {
                self.require_permission("READ")?;
                let table = args["table_name"].as_str().ok_or_else(|| anyhow!("table_name required"))?;
                let sql = self.table_schema_sql(table);
                let result = fetch_all_json(&self.pool, &sql).await?;
                Ok(Self::content_text(serde_json::to_string_pretty(&result)?))
            }

            "indexes" => {
                self.require_permission("READ")?;
                let table = args["table_name"].as_str().ok_or_else(|| anyhow!("table_name required"))?;
                let sql = self.list_indexes_sql(table);
                let result = fetch_all_json(&self.pool, &sql).await?;
                Ok(Self::content_text(serde_json::to_string_pretty(&result)?))
            }

            "query" => {
                let sql = args["sql"].as_str().ok_or_else(|| anyhow!("sql required"))?;
                let confirmed = args["confirmed"].as_bool().unwrap_or(false);
                let sql_upper = sql.trim().to_uppercase();
                let is_dml = sql_upper.starts_with("INSERT")
                    || sql_upper.starts_with("UPDATE")
                    || sql_upper.starts_with("DELETE")
                    || sql_upper.starts_with("TRUNCATE");

                if is_dml {
                    self.require_permission("WRITE")?;
                    if !self.trusted && !confirmed {
                        return Ok(Self::confirmation_response("modify", sql));
                    }
                    let result = self.pool.execute(sql).await?;
                    Ok(Self::content_text(json!({ "rows_affected": result.rows_affected() }).to_string()))
                } else {
                    self.require_permission("READ")?;
                    let result = fetch_all_json(&self.pool, sql).await?;
                    Ok(Self::content_text(serde_json::to_string_pretty(&result)?))
                }
            }

            "explain" => {
                self.require_permission("EXPLAIN")?;
                let sql = args["sql"].as_str().ok_or_else(|| anyhow!("sql required"))?;
                let analyze = args["analyze"].as_bool().unwrap_or(false);
                let explain_sql = self.explain_sql(sql, analyze);
                let result = fetch_all_json(&self.pool, &explain_sql).await?;
                Ok(Self::content_text(serde_json::to_string_pretty(&result)?))
            }

            "context" => {
                self.require_permission("READ")?;
                let tables_sql = self.list_tables_sql();
                let tables_result = fetch_all_json(&self.pool, &tables_sql).await?;
                let tables = tables_result["rows"].as_array().cloned().unwrap_or_default();

                // Get schema for each table (limit to first 20 tables)
                let mut table_schemas: HashMap<String, Value> = HashMap::new();
                for table_row in tables.iter().take(20) {
                    let table_name = table_row.as_object()
                        .and_then(|m| m.values().next())
                        .and_then(|v| v.as_str())
                        .unwrap_or_default()
                        .to_string();
                    if !table_name.is_empty() {
                        let schema_sql = self.table_schema_sql(&table_name);
                        if let Ok(schema) = fetch_all_json(&self.pool, &schema_sql).await {
                            table_schemas.insert(table_name, schema);
                        }
                    }
                }

                let context = json!({
                    "database_url": self.db_url.split('@').last().unwrap_or(&self.db_url),
                    "table_count": tables.len(),
                    "tables": tables,
                    "schemas": table_schemas
                });
                Ok(Self::content_text(serde_json::to_string_pretty(&context)?))
            }

            "status" => {
                let status = json!({
                    "agent_id": self.agent_id,
                    "permissions": self.permissions,
                    "trusted": self.trusted,
                    "connected": true,
                    "mcp_version": "2024-11-05",
                    "server": "nodadb-mcp 1.0.0"
                });
                Ok(Self::content_text(serde_json::to_string_pretty(&status)?))
            }

            "insert" => {
                self.require_permission("WRITE")?;
                let table = args["table_name"].as_str().ok_or_else(|| anyhow!("table_name required"))?;
                let data = args["data"].as_object().ok_or_else(|| anyhow!("data must be a JSON object"))?;
                if data.is_empty() { return Err(anyhow!("data cannot be empty")); }

                let cols: Vec<String> = data.keys().cloned().collect();

                // Build the INSERT as a plain SQL string with values
                let mut val_parts = Vec::new();
                for col in &cols {
                    let v = &data[col];
                    let s = match v {
                        Value::String(s) => format!("'{}'", s.replace('\'', "''")),
                        Value::Number(n) => n.to_string(),
                        Value::Bool(b) => b.to_string(),
                        Value::Null => "NULL".to_string(),
                        other => format!("'{}'", other.to_string().replace('\'', "''")),
                    };
                    val_parts.push(s);
                }
                let plain_sql = format!(
                    "INSERT INTO {} ({}) VALUES ({})",
                    table, cols.join(", "), val_parts.join(", ")
                );
                let result = self.pool.execute(plain_sql.as_str()).await?;
                Ok(Self::content_text(json!({ "rows_affected": result.rows_affected(), "table": table }).to_string()))
            }

            "update" => {
                self.require_permission("WRITE")?;
                let table = args["table_name"].as_str().ok_or_else(|| anyhow!("table_name required"))?;
                let set = args["set"].as_object().ok_or_else(|| anyhow!("set must be a JSON object"))?;
                let where_clause = args["where_clause"].as_str().ok_or_else(|| anyhow!("where_clause required"))?;
                let confirmed = args["confirmed"].as_bool().unwrap_or(false);

                if !self.trusted && !confirmed {
                    return Ok(Self::confirmation_response("update", &format!("UPDATE {} SET ... WHERE {}", table, where_clause)));
                }

                let set_parts: Vec<String> = set.iter().map(|(k, v)| {
                    let val = match v {
                        Value::String(s) => format!("'{}'", s.replace('\'', "''")),
                        Value::Number(n) => n.to_string(),
                        Value::Bool(b) => b.to_string(),
                        Value::Null => "NULL".to_string(),
                        other => format!("'{}'", other.to_string().replace('\'', "''")),
                    };
                    format!("{} = {}", k, val)
                }).collect();

                let sql = format!("UPDATE {} SET {} WHERE {}", table, set_parts.join(", "), where_clause);
                let result = self.pool.execute(sql.as_str()).await?;
                Ok(Self::content_text(json!({ "rows_affected": result.rows_affected() }).to_string()))
            }

            "delete" => {
                self.require_permission("WRITE")?;
                let table = args["table_name"].as_str().ok_or_else(|| anyhow!("table_name required"))?;
                let where_clause = args["where_clause"].as_str().ok_or_else(|| anyhow!("where_clause required"))?;
                let confirmed = args["confirmed"].as_bool().unwrap_or(false);

                if !self.trusted && !confirmed {
                    return Ok(Self::confirmation_response("delete", &format!("DELETE FROM {} WHERE {}", table, where_clause)));
                }

                let sql = format!("DELETE FROM {} WHERE {}", table, where_clause);
                let result = self.pool.execute(sql.as_str()).await?;
                Ok(Self::content_text(json!({ "rows_affected": result.rows_affected() }).to_string()))
            }

            _ => Err(anyhow!("Unknown tool: {}", name)),
        }
    }

    // ── DB-agnostic SQL helpers ───────────────────────────────────────────────

    fn list_tables_sql(&self) -> String {
        // Works for all major DBs via information_schema (PG, MySQL, SQLite compat)
        if self.db_url.starts_with("sqlite") {
            "SELECT name as table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name".to_string()
        } else {
            "SELECT table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'sys', 'performance_schema') ORDER BY table_name".to_string()
        }
    }

    fn table_schema_sql(&self, table: &str) -> String {
        if self.db_url.starts_with("sqlite") {
            format!("PRAGMA table_info({})", table)
        } else {
            format!(
                "SELECT column_name, data_type, is_nullable, column_default \
                 FROM information_schema.columns WHERE table_name = '{}' ORDER BY ordinal_position",
                table.replace('\'', "''")
            )
        }
    }

    fn list_indexes_sql(&self, table: &str) -> String {
        if self.db_url.starts_with("sqlite") {
            format!("PRAGMA index_list({})", table)
        } else if self.db_url.starts_with("postgres") || self.db_url.starts_with("postgresql") {
            format!(
                "SELECT indexname as index_name, indexdef as definition \
                 FROM pg_indexes WHERE tablename = '{}'",
                table.replace('\'', "''")
            )
        } else {
            format!(
                "SELECT index_name, column_name, non_unique \
                 FROM information_schema.statistics WHERE table_name = '{}'",
                table.replace('\'', "''")
            )
        }
    }

    fn explain_sql(&self, sql: &str, analyze: bool) -> String {
        if self.db_url.starts_with("postgres") || self.db_url.starts_with("postgresql") {
            if analyze { format!("EXPLAIN ANALYZE {}", sql) } else { format!("EXPLAIN {}", sql) }
        } else if self.db_url.starts_with("mysql") || self.db_url.starts_with("mariadb") {
            format!("EXPLAIN {}", sql)
        } else {
            format!("EXPLAIN QUERY PLAN {}", sql)
        }
    }

    async fn handle_request(&self, req: JsonRpcRequest) -> Option<JsonRpcResponse> {
        let id = req.id.clone().unwrap_or(Value::Null);

        // Notifications don't need a response
        if req.method.starts_with("notifications/") {
            return None;
        }

        let result = match req.method.as_str() {
            "initialize" => Ok(json!({
                "protocolVersion": "2024-11-05",
                "capabilities": { "tools": {} },
                "serverInfo": {
                    "name": "nodadb-mcp",
                    "version": "1.0.0",
                    "description": "NodaDB AI Agent Command Control — database operations as MCP tools"
                }
            })),

            "initialized" => return None,

            "tools/list" => Ok(json!({ "tools": tool_definitions() })),

            "tools/call" => {
                let params = req.params.unwrap_or(json!({}));
                let tool_name = params["name"].as_str().unwrap_or("").to_string();
                let args = if params.get("arguments").is_some() && !params["arguments"].is_null() {
                    params["arguments"].clone()
                } else {
                    json!({})
                };
                self.handle_tool(&tool_name, &args).await
            }

            "ping" => Ok(json!({ "pong": true })),

            _ => Err(anyhow!("Method not found: {}", req.method)),
        };

        Some(match result {
            Ok(v) => JsonRpcResponse::ok(id, v),
            Err(e) => JsonRpcResponse::err(id, -32603, e.to_string()),
        })
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    let server = match McpServer::new().await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[nodadb-mcp] Fatal error: {}", e);
            std::process::exit(1);
        }
    };

    let stdin = io::stdin();
    let mut reader = BufReader::new(stdin).lines();
    let mut stdout = io::stdout();

    while let Ok(Some(line)) = reader.next_line().await {
        let line = line.trim().to_string();
        if line.is_empty() { continue; }

        eprintln!("[nodadb-mcp] ← {}", &line[..line.len().min(200)]);

        let response = match serde_json::from_str::<JsonRpcRequest>(&line) {
            Ok(req) => server.handle_request(req).await,
            Err(e) => Some(JsonRpcResponse::err(Value::Null, -32700, format!("Parse error: {}", e))),
        };

        if let Some(resp) = response {
            let out = match serde_json::to_string(&resp) {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("[nodadb-mcp] Serialization error: {}", e);
                    continue;
                }
            };
            eprintln!("[nodadb-mcp] → {}", &out[..out.len().min(200)]);
            let _ = stdout.write_all(out.as_bytes()).await;
            let _ = stdout.write_all(b"\n").await;
            let _ = stdout.flush().await;
        }
    }

    eprintln!("[nodadb-mcp] stdin closed, exiting.");
}
