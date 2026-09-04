pub mod types;

use crate::models::{AppliedMigration, ColumnTypeFamily, ConnectionConfig, ConnectionTestResult, DatabaseTable, DatabaseType, ExecutionPlan, ForeignKeyDefinition, MariaDBAuthMethod, PlanStep, PostgresConnectionInfo, PostgresExtension, PostgresTablePrivileges, QueryResult, TableColumn, TableConstraint, TableIndex, RelationMatch};
use crate::ssh_tunnel::SshTunnel;
use self::types::{
    classify_mysql_type, classify_postgres_type, classify_sqlite_type,
    extract_sqlite_check_constraints, extract_sqlite_json_columns_from_ddl, normalize_type_name,
};
use anyhow::{anyhow, Result};
use base64::Engine;
use sqlx::{Row, TypeInfo, Column};
use sqlx::types::BigDecimal;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{NaiveDateTime, NaiveDate, NaiveTime, DateTime, Utc};
use std::collections::{BTreeMap, HashMap};
use mongodb::bson::{self, doc, Bson, Document as BsonDocument};
use futures::TryStreamExt;

#[derive(Clone)]
pub enum DatabasePool {
    Sqlite(sqlx::SqlitePool),
    Postgres(sqlx::PgPool),
    MySql(sqlx::MySqlPool),
    MongoDB { client: mongodb::Client, database: String },
    ClickHouse { client: reqwest::Client, url: String, database: String },
    LibSQL { client: reqwest::Client, url: String, token: String },
    Redis { client: redis::Client, db: u8 },
    CloudflareD1 { client: reqwest::Client, account_id: String, database_id: String, api_token: String },
}

macro_rules! decimal_json_value {
    (postgres, $row:expr, $idx:expr) => {
        $row.try_get::<Option<BigDecimal>, _>($idx)
            .map(|v| {
                v.map(|decimal| serde_json::Value::String(decimal.to_string()))
                    .unwrap_or(serde_json::Value::Null)
            })
            .or_else(|_| {
                $row.try_get::<Option<f64>, _>($idx).map(|v| {
                    v.map(|n| serde_json::json!(n))
                        .unwrap_or(serde_json::Value::Null)
                })
            })
            .unwrap_or(serde_json::Value::Null)
    };
    (common, $row:expr, $idx:expr) => {
        $row.try_get::<Option<String>, _>($idx)
            .map(|v| v.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null))
            .or_else(|_| {
                $row.try_get::<Option<f64>, _>($idx).map(|v| {
                    v.map(|n| serde_json::json!(n))
                        .unwrap_or(serde_json::Value::Null)
                })
            })
            .unwrap_or(serde_json::Value::Null)
    };
}

macro_rules! process_rows {
    ($rows:expr, $decimal_mode:ident) => {{
        if $rows.is_empty() {
            return Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                rows_affected: 0,
            });
        }

        let columns: Vec<String> = $rows[0]
            .columns()
            .iter()
            .map(|col| col.name().to_string())
            .collect();

        let result_rows: Vec<serde_json::Value> = $rows
            .into_iter()
            .map(|row| {
                let mut map = serde_json::Map::new();
                for (idx, col) in row.columns().iter().enumerate() {
                    let type_name = col.type_info().name().to_ascii_uppercase();
                    let value = match type_name.as_str() {
                        "TEXT" | "VARCHAR" | "CHAR" | "BPCHAR" | "NAME" | "XML" => row
                            .try_get::<Option<String>, _>(idx)
                            .map(|v| v.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null))
                            .unwrap_or(serde_json::Value::Null),
                        "UUID" => row
                            .try_get::<Option<uuid::Uuid>, _>(idx)
                            .map(|v| v.map(|uuid| serde_json::Value::String(uuid.to_string())).unwrap_or(serde_json::Value::Null))
                            .unwrap_or(serde_json::Value::Null),
                        "SMALLINT" | "INTEGER" | "INT" | "BIGINT" | "INT2" | "INT4" | "INT8" => row
                            .try_get::<Option<i64>, _>(idx)
                            .map(|v| v.map(|n| serde_json::Value::Number(n.into())).unwrap_or(serde_json::Value::Null))
                            .unwrap_or(serde_json::Value::Null),
                        "REAL" | "FLOAT" | "DOUBLE" | "FLOAT4" | "FLOAT8" => row
                            .try_get::<Option<f64>, _>(idx)
                            .map(|v| v.map(|n| serde_json::json!(n)).unwrap_or(serde_json::Value::Null))
                            .unwrap_or(serde_json::Value::Null),
                        "NUMERIC" | "DECIMAL" | "MONEY" => decimal_json_value!($decimal_mode, row, idx),
                        "BOOLEAN" | "BOOL" => row
                            .try_get::<Option<bool>, _>(idx)
                            .map(|v| v.map(serde_json::Value::Bool).unwrap_or(serde_json::Value::Null))
                            .or_else(|_| {
                                row.try_get::<Option<i64>, _>(idx).map(|v| {
                                    v.map(|n| serde_json::Value::Bool(n != 0))
                                        .unwrap_or(serde_json::Value::Null)
                                })
                            })
                            .unwrap_or(serde_json::Value::Null),
                        "DATETIME" | "TIMESTAMP" => row
                            .try_get::<Option<NaiveDateTime>, _>(idx)
                            .map(|v| {
                                v.map(|dt| serde_json::Value::String(dt.format("%Y-%m-%d %H:%M:%S").to_string()))
                                    .unwrap_or(serde_json::Value::Null)
                            })
                            .unwrap_or(serde_json::Value::Null),
                        "TIMESTAMPTZ" | "TIMESTAMP WITH TIME ZONE" => row
                            .try_get::<Option<DateTime<Utc>>, _>(idx)
                            .map(|v| {
                                v.map(|dt| serde_json::Value::String(dt.to_rfc3339()))
                                    .unwrap_or(serde_json::Value::Null)
                            })
                            .or_else(|_| {
                                row.try_get::<Option<NaiveDateTime>, _>(idx).map(|v| {
                                    v.map(|dt| serde_json::Value::String(dt.format("%Y-%m-%d %H:%M:%S").to_string()))
                                        .unwrap_or(serde_json::Value::Null)
                                })
                            })
                            .unwrap_or(serde_json::Value::Null),
                        "DATE" => row
                            .try_get::<Option<NaiveDate>, _>(idx)
                            .map(|v| {
                                v.map(|d| serde_json::Value::String(d.format("%Y-%m-%d").to_string()))
                                    .unwrap_or(serde_json::Value::Null)
                            })
                            .unwrap_or(serde_json::Value::Null),
                        "TIME" | "TIMETZ" | "TIME WITH TIME ZONE" => row
                            .try_get::<Option<NaiveTime>, _>(idx)
                            .map(|v| {
                                v.map(|t| serde_json::Value::String(t.format("%H:%M:%S").to_string()))
                                    .unwrap_or(serde_json::Value::Null)
                            })
                            .unwrap_or(serde_json::Value::Null),
                        "JSON" | "JSONB" => row
                            .try_get::<Option<serde_json::Value>, _>(idx)
                            .map(|v| v.unwrap_or(serde_json::Value::Null))
                            .unwrap_or(serde_json::Value::Null),
                        "BYTEA" | "BLOB" | "VARBINARY" | "BINARY" => row
                            .try_get::<Option<Vec<u8>>, _>(idx)
                            .map(|v| {
                                v.map(|bytes| {
                                    serde_json::Value::String(
                                        base64::engine::general_purpose::STANDARD.encode(bytes),
                                    )
                                })
                                .unwrap_or(serde_json::Value::Null)
                            })
                            .unwrap_or(serde_json::Value::Null),
                        // PostgreSQL array and special types. We serialize as strings.
                        "INET" | "CIDR" | "MACADDR" | "MACADDR8" | "TSVECTOR" | "TSQUERY"
                        | "INT4RANGE" | "INT8RANGE" | "NUMRANGE" | "TSRANGE" | "TSTZRANGE"
                        | "DATERANGE" | "BOX" | "CIRCLE" | "LINE" | "LSEG" | "PATH" | "POINT"
                        | "POLYGON" | "PG_LSN" => row
                            .try_get::<Option<String>, _>(idx)
                            .map(|v| v.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null))
                            .unwrap_or(serde_json::Value::Null),
                        _ if type_name.starts_with('_') || type_name.ends_with("[]") => row
                            .try_get::<Option<String>, _>(idx)
                            .map(|v| v.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null))
                            .unwrap_or(serde_json::Value::Null),
                        _ => row
                            .try_get::<Option<String>, _>(idx)
                            .map(|v| v.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null))
                            .or_else(|_| {
                                row.try_get::<Option<i64>, _>(idx).map(|v| {
                                    v.map(|n| serde_json::Value::Number(n.into()))
                                        .unwrap_or(serde_json::Value::Null)
                                })
                            })
                            .or_else(|_| {
                                row.try_get::<Option<f64>, _>(idx).map(|v| {
                                    v.map(|n| serde_json::json!(n))
                                        .unwrap_or(serde_json::Value::Null)
                                })
                            })
                            .or_else(|_| {
                                row.try_get::<Option<bool>, _>(idx).map(|v| {
                                    v.map(serde_json::Value::Bool)
                                        .unwrap_or(serde_json::Value::Null)
                                })
                            })
                            .or_else(|_| {
                                row.try_get::<Option<serde_json::Value>, _>(idx)
                                    .map(|v| v.unwrap_or(serde_json::Value::Null))
                            })
                            .unwrap_or(serde_json::Value::Null),
                    };
                    map.insert(col.name().to_string(), value);
                }
                serde_json::Value::Object(map)
            })
            .collect();

        QueryResult {
            columns,
            rows: result_rows,
            rows_affected: 0,
        }
    }};
}

macro_rules! execute_query {
    ($pool:expr, $query:expr) => {{
        let rows_affected = match $pool {
            DatabasePool::Sqlite(pool) => {
                sqlx::query($query).execute(pool).await?.rows_affected()
            }
            DatabasePool::Postgres(pool) => {
                sqlx::query($query).execute(pool).await?.rows_affected()
            }
            DatabasePool::MySql(pool) => {
                sqlx::query($query).execute(pool).await?.rows_affected()
            }
            DatabasePool::MongoDB { .. } => {
                return Err(anyhow::anyhow!("Raw SQL execution is not supported for MongoDB"));
            }
            DatabasePool::ClickHouse { client, url, database } => {
                ConnectionManager::clickhouse_http_execute(client, url, database, $query).await?
            }
            DatabasePool::LibSQL { client, url, token } => {
                let res = ConnectionManager::libsql_http_pipeline(client, url, token, $query).await?;
                res.rows_affected
            }
            DatabasePool::CloudflareD1 { client, account_id, database_id, api_token } => {
                let res = ConnectionManager::cloudflare_d1_query(client, account_id, database_id, api_token, $query).await?;
                res.rows_affected
            }
            DatabasePool::Redis { client, db } => {
                let res = ConnectionManager::redis_execute_cmd(client, *db, $query).await?;
                res.rows_affected
            }
        };
        Ok::<u64, anyhow::Error>(rows_affected)
    }};
}

pub struct ConnectionManager {
    connections: Arc<RwLock<HashMap<String, DatabasePool>>>,
    ssh_tunnels: Arc<RwLock<HashMap<String, SshTunnel>>>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            ssh_tunnels: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    fn quote_pg_ident(ident: &str) -> String {
        format!("\"{}\"", ident.replace('"', "\"\""))
    }

    fn split_pg_table_name(table_name: &str) -> (String, String) {
        let parts: Vec<&str> = table_name.split('.').collect();
        if parts.len() == 2 {
            (
                parts[0].trim_matches('"').to_string(),
                parts[1].trim_matches('"').to_string(),
            )
        } else {
            ("public".to_string(), table_name.trim_matches('"').to_string())
        }
    }

    fn quote_pg_table(table_name: &str) -> String {
        let (schema, table) = Self::split_pg_table_name(table_name);
        format!(
            "{}.{}",
            Self::quote_pg_ident(&schema),
            Self::quote_pg_ident(&table)
        )
    }

    fn format_sqlx_error(error: sqlx::Error) -> anyhow::Error {
        match error {
            sqlx::Error::Database(db_err) => {
                let message = db_err.message();
                let code = db_err.code().map(|c| c.to_string()).unwrap_or_else(|| "unknown".to_string());
                anyhow!("SQLSTATE {}: {}", code, message)
            }
            other => anyhow!(other),
        }
    }

    fn quote_identifier(identifier: &str, db_type: &DatabaseType) -> String {
        match db_type {
            DatabaseType::PostgreSQL | DatabaseType::SQLite | DatabaseType::LibSQL => {
                format!("\"{}\"", identifier.replace('"', "\"\""))
            }
            DatabaseType::MySQL | DatabaseType::ClickHouse => format!("`{}`", identifier.replace('`', "``")),
            DatabaseType::MongoDB | DatabaseType::Redis => identifier.to_string(),
        }
    }

    fn quote_table_name(table_name: &str, db_type: &DatabaseType) -> String {
        match db_type {
            DatabaseType::PostgreSQL => Self::quote_pg_table(table_name),
            DatabaseType::SQLite | DatabaseType::LibSQL => {
                if table_name.contains('.') {
                    let parts: Vec<String> = table_name
                        .split('.')
                        .map(|part| Self::quote_identifier(part.trim_matches('"'), db_type))
                        .collect();
                    parts.join(".")
                } else {
                    Self::quote_identifier(table_name.trim_matches('"'), db_type)
                }
            }
            DatabaseType::MySQL | DatabaseType::ClickHouse => {
                if table_name.contains('.') {
                    let parts: Vec<String> = table_name
                        .split('.')
                        .map(|part| Self::quote_identifier(part.trim_matches('`'), db_type))
                        .collect();
                    parts.join(".")
                } else {
                    Self::quote_identifier(table_name.trim_matches('`'), db_type)
                }
            }
            DatabaseType::MongoDB | DatabaseType::Redis => table_name.to_string(),
        }
    }

    fn normalize_referential_action(action: Option<&str>) -> Option<String> {
        let normalized = action?.trim();
        if normalized.is_empty() {
            return None;
        }

        Some(
            normalized
                .split_whitespace()
                .map(|segment| segment.to_uppercase())
                .collect::<Vec<_>>()
                .join(" "),
        )
    }

    fn split_sql_statements(sql: &str) -> Vec<String> {
        let mut statements = Vec::new();
        let mut current = String::new();
        let mut chars = sql.chars().peekable();
        let mut in_single = false;
        let mut in_double = false;
        let mut in_line_comment = false;
        let mut in_block_comment = false;

        while let Some(ch) = chars.next() {
            if in_line_comment {
                current.push(ch);
                if ch == '\n' {
                    in_line_comment = false;
                }
                continue;
            }

            if in_block_comment {
                current.push(ch);
                if ch == '*' && matches!(chars.peek(), Some('/')) {
                    current.push(chars.next().unwrap());
                    in_block_comment = false;
                }
                continue;
            }

            if !in_single && !in_double {
                if ch == '-' && matches!(chars.peek(), Some('-')) {
                    current.push(ch);
                    current.push(chars.next().unwrap());
                    in_line_comment = true;
                    continue;
                }

                if ch == '/' && matches!(chars.peek(), Some('*')) {
                    current.push(ch);
                    current.push(chars.next().unwrap());
                    in_block_comment = true;
                    continue;
                }
            }

            if ch == '\'' && !in_double {
                in_single = !in_single;
                current.push(ch);
                continue;
            }

            if ch == '"' && !in_single {
                in_double = !in_double;
                current.push(ch);
                continue;
            }

            if ch == ';' && !in_single && !in_double {
                let trimmed = current.trim();
                if !trimmed.is_empty() {
                    statements.push(trimmed.to_string());
                }
                current.clear();
                continue;
            }

            current.push(ch);
        }

        let trimmed = current.trim();
        if !trimmed.is_empty() {
            statements.push(trimmed.to_string());
        }

        statements
    }


    /// Fetch a short-lived IAM/AD token and use it as the MySQL password.
    async fn fetch_cloud_token(config: &ConnectionConfig) -> Result<String> {
        match config.auth_method.as_ref() {
            Some(MariaDBAuthMethod::AwsIam) => {
                let region = config.aws_region.as_deref()
                    .ok_or_else(|| anyhow!("AWS region is required for IAM auth"))?;
                let host = config.host.as_deref()
                    .ok_or_else(|| anyhow!("Host is required"))?;
                let port = config.port
                    .ok_or_else(|| anyhow!("Port is required"))?;
                let db_user = config.aws_db_user.as_deref()
                    .ok_or_else(|| anyhow!("AWS DB user is required for IAM auth"))?;

                let mut cmd = tokio::process::Command::new("aws");
                cmd.args([
                    "rds", "generate-db-auth-token",
                    "--hostname", host,
                    "--port", &port.to_string(),
                    "--region", region,
                    "--username", db_user,
                ]);
                // Inject explicit credentials if provided; otherwise fall back to env/profile
                if let (Some(key_id), Some(secret)) = (
                    config.aws_access_key_id.as_deref(),
                    config.aws_secret_access_key.as_deref(),
                ) {
                    cmd.env("AWS_ACCESS_KEY_ID", key_id)
                       .env("AWS_SECRET_ACCESS_KEY", secret);
                }
                let output = cmd.output().await
                    .map_err(|e| anyhow!("AWS CLI not found or not executable: {}", e))?;
                if !output.status.success() {
                    return Err(anyhow!(
                        "aws rds generate-db-auth-token failed: {}",
                        String::from_utf8_lossy(&output.stderr).trim()
                    ));
                }
                Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
            }
            Some(MariaDBAuthMethod::AzureAd) => {
                let tenant = config.azure_tenant_id.as_deref().unwrap_or("common");
                let output = tokio::process::Command::new("az")
                    .args([
                        "account", "get-access-token",
                        "--resource-type", "oss-rdbms",
                        "--tenant", tenant,
                        "--query", "accessToken",
                        "-o", "tsv",
                    ])
                    .output().await
                    .map_err(|e| anyhow!("Azure CLI (az) not found or not executable: {}", e))?;
                if !output.status.success() {
                    return Err(anyhow!(
                        "az account get-access-token failed: {}",
                        String::from_utf8_lossy(&output.stderr).trim()
                    ));
                }
                Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
            }
            Some(MariaDBAuthMethod::GcpIam) => {
                let mut cmd = tokio::process::Command::new("gcloud");
                cmd.args(["auth", "print-access-token"]);
                if let Some(project) = config.gcp_project.as_deref() {
                    cmd.arg("--project").arg(project);
                }
                let output = cmd.output().await
                    .map_err(|e| anyhow!("gcloud CLI not found or not executable: {}", e))?;
                if !output.status.success() {
                    return Err(anyhow!(
                        "gcloud auth print-access-token failed: {}",
                        String::from_utf8_lossy(&output.stderr).trim()
                    ));
                }
                Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
            }
            _ => Err(anyhow!("fetch_cloud_token called without a cloud auth method")),
        }
    }

    fn bson_docs_to_query_result(docs: Vec<BsonDocument>) -> Result<QueryResult> {
        let mut columns_set = std::collections::BTreeSet::new();
        let mut json_rows = Vec::new();

        for doc in &docs {
            let json_val: serde_json::Value = serde_json::to_value(doc)?;
            if let serde_json::Value::Object(map) = &json_val {
                for k in map.keys() {
                    columns_set.insert(k.clone());
                }
            }
            json_rows.push(json_val);
        }

        let mut columns: Vec<String> = Vec::new();
        if columns_set.contains("_id") {
            columns.push("_id".to_string());
            columns_set.remove("_id");
        }
        for c in columns_set {
            columns.push(c);
        }

        let count = json_rows.len() as u64;
        Ok(QueryResult {
            columns,
            rows: json_rows,
            rows_affected: count,
        })
    }

    async fn mongo_execute_shell(client: &mongodb::Client, database: &str, query: &str) -> Result<QueryResult> {
        let db = client.database(database);
        let trimmed = query.trim().trim_end_matches(';');

        if trimmed.to_uppercase().starts_with("SELECT") {
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            let from_idx = parts.iter().position(|&p| p.eq_ignore_ascii_case("FROM"));
            let collection_name = if let Some(idx) = from_idx {
                if idx + 1 < parts.len() {
                    parts[idx + 1].trim_matches(|c| c == '"' || c == '\'' || c == '`').to_string()
                } else {
                    return Err(anyhow!("Invalid SELECT query"));
                }
            } else {
                return Err(anyhow!("Invalid SELECT query"));
            };

            let coll = db.collection::<BsonDocument>(&collection_name);
            let mut cursor = coll.find(doc! {}).await?;
            let mut docs = Vec::new();
            while let Some(doc) = cursor.try_next().await? {
                docs.push(doc);
            }
            return Self::bson_docs_to_query_result(docs);
        }

        if !trimmed.starts_with("db.") {
            return Err(anyhow!("MongoDB query must start with 'db.<collection>.<method>()' or 'SELECT ... FROM <collection>'"));
        }

        let rest = &trimmed[3..];
        let dot_idx = rest.find('.').ok_or_else(|| anyhow!("Invalid MQL format. Expected: db.<collection>.<method>(...)"))?;
        let collection = &rest[..dot_idx];
        let method_and_args = &rest[dot_idx + 1..];

        let paren_idx = method_and_args.find('(').ok_or_else(|| anyhow!("Invalid MQL format. Expected: method(...)"))?;
        let method = &method_and_args[..paren_idx];
        let args_str = method_and_args[paren_idx + 1..].trim_end_matches(')').trim();

        let coll = db.collection::<BsonDocument>(collection);

        match method {
            "find" => {
                let filter: BsonDocument = if args_str.is_empty() {
                    doc! {}
                } else {
                    let json_val: serde_json::Value = serde_json::from_str(args_str)?;
                    bson::to_document(&json_val)?
                };
                let mut cursor = coll.find(filter).await?;
                let mut docs = Vec::new();
                while let Some(doc) = cursor.try_next().await? {
                    docs.push(doc);
                }
                Self::bson_docs_to_query_result(docs)
            }
            "findOne" => {
                let filter: BsonDocument = if args_str.is_empty() {
                    doc! {}
                } else {
                    let json_val: serde_json::Value = serde_json::from_str(args_str)?;
                    bson::to_document(&json_val)?
                };
                let maybe_doc = coll.find_one(filter).await?;
                let docs = match maybe_doc {
                    Some(d) => vec![d],
                    None => vec![],
                };
                Self::bson_docs_to_query_result(docs)
            }
            "aggregate" => {
                let pipeline_json: serde_json::Value = serde_json::from_str(args_str)?;
                let pipeline_arr = pipeline_json.as_array().ok_or_else(|| anyhow!("aggregate requires an array of pipeline stages"))?;
                let mut pipeline = Vec::new();
                for stage in pipeline_arr {
                    let doc = bson::to_document(stage)?;
                    pipeline.push(doc);
                }
                let mut cursor = coll.aggregate(pipeline).await?;
                let mut docs = Vec::new();
                while let Some(doc) = cursor.try_next().await? {
                    docs.push(doc);
                }
                Self::bson_docs_to_query_result(docs)
            }
            "countDocuments" | "count" => {
                let filter: BsonDocument = if args_str.is_empty() {
                    doc! {}
                } else {
                    let json_val: serde_json::Value = serde_json::from_str(args_str)?;
                    bson::to_document(&json_val)?
                };
                let count = coll.count_documents(filter).await?;
                let mut doc = BsonDocument::new();
                doc.insert("count", count as i64);
                Self::bson_docs_to_query_result(vec![doc])
            }
            "insertOne" => {
                let json_val: serde_json::Value = serde_json::from_str(args_str)?;
                let doc = bson::to_document(&json_val)?;
                let res = coll.insert_one(doc).await?;
                let mut res_doc = BsonDocument::new();
                res_doc.insert("insertedId", res.inserted_id);
                res_doc.insert("status", "success");
                Self::bson_docs_to_query_result(vec![res_doc])
            }
            "insertMany" => {
                let json_val: serde_json::Value = serde_json::from_str(args_str)?;
                let arr = json_val.as_array().ok_or_else(|| anyhow!("insertMany requires an array of documents"))?;
                let mut docs = Vec::new();
                for item in arr {
                    docs.push(bson::to_document(item)?);
                }
                let res = coll.insert_many(docs).await?;
                let mut res_doc = BsonDocument::new();
                res_doc.insert("insertedCount", res.inserted_ids.len() as i64);
                res_doc.insert("status", "success");
                Self::bson_docs_to_query_result(vec![res_doc])
            }
            "deleteMany" => {
                let filter: BsonDocument = if args_str.is_empty() {
                    doc! {}
                } else {
                    let json_val: serde_json::Value = serde_json::from_str(args_str)?;
                    bson::to_document(&json_val)?
                };
                let res = coll.delete_many(filter).await?;
                let mut res_doc = BsonDocument::new();
                res_doc.insert("deletedCount", res.deleted_count as i64);
                res_doc.insert("status", "success");
                Self::bson_docs_to_query_result(vec![res_doc])
            }
            "deleteOne" => {
                let filter: BsonDocument = if args_str.is_empty() {
                    doc! {}
                } else {
                    let json_val: serde_json::Value = serde_json::from_str(args_str)?;
                    bson::to_document(&json_val)?
                };
                let res = coll.delete_one(filter).await?;
                let mut res_doc = BsonDocument::new();
                res_doc.insert("deletedCount", res.deleted_count as i64);
                res_doc.insert("status", "success");
                Self::bson_docs_to_query_result(vec![res_doc])
            }
            _ => Err(anyhow!("Unsupported MongoDB method: {}. Supported: find, findOne, aggregate, countDocuments, insertOne, insertMany, deleteOne, deleteMany", method))
        }
    }

    async fn clickhouse_http_query(
        client: &reqwest::Client,
        base_url: &str,
        database: &str,
        query: &str,
    ) -> Result<QueryResult> {
        let trimmed = query.trim();
        let mut final_query = trimmed.to_string();
        if !final_query.to_uppercase().contains("FORMAT ") {
            final_query.push_str(" FORMAT JSONCompact");
        }

        let url = format!("{}/?database={}", base_url, urlencoding::encode(database));
        let resp = client.post(&url).body(final_query).send().await?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_else(|_| "Unknown ClickHouse error".to_string());
            return Err(anyhow!("ClickHouse Error: {}", err_text));
        }

        let json_resp: serde_json::Value = resp.json().await?;
        
        let mut columns = Vec::new();
        if let Some(meta) = json_resp.get("meta").and_then(|m| m.as_array()) {
            for item in meta {
                if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                    columns.push(name.to_string());
                }
            }
        }

        let mut rows = Vec::new();
        if let Some(data) = json_resp.get("data").and_then(|d| d.as_array()) {
            for row_arr in data {
                if let Some(arr) = row_arr.as_array() {
                    let mut map = serde_json::Map::new();
                    for (i, val) in arr.iter().enumerate() {
                        if let Some(col_name) = columns.get(i) {
                            map.insert(col_name.clone(), val.clone());
                        }
                    }
                    rows.push(serde_json::Value::Object(map));
                }
            }
        }

        let rows_affected = json_resp.get("rows").and_then(|r| r.as_u64()).unwrap_or(rows.len() as u64);

        Ok(QueryResult {
            columns,
            rows,
            rows_affected,
        })
    }

    async fn clickhouse_http_execute(
        client: &reqwest::Client,
        base_url: &str,
        database: &str,
        query: &str,
    ) -> Result<u64> {
        let url = format!("{}/?database={}", base_url, urlencoding::encode(database));
        let resp = client.post(&url).body(query.to_string()).send().await?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_else(|_| "Unknown ClickHouse error".to_string());
            return Err(anyhow!("ClickHouse Error: {}", err_text));
        }

        Ok(1)
    }

    async fn libsql_http_pipeline(
        client: &reqwest::Client,
        base_url: &str,
        token: &str,
        sql: &str,
    ) -> Result<QueryResult> {
        let http_url = if base_url.starts_with("libsql://") {
            format!("https://{}", &base_url["libsql://".len()..])
        } else if base_url.starts_with("http://") || base_url.starts_with("https://") {
            base_url.to_string()
        } else {
            format!("https://{}", base_url)
        };

        let endpoint = format!("{}/v2/pipeline", http_url.trim_end_matches('/'));

        let body = serde_json::json!({
            "baton": null,
            "requests": [
                {
                    "type": "execute",
                    "stmt": {
                        "sql": sql
                    }
                }
            ]
        });

        let mut req = client.post(&endpoint).json(&body);
        if !token.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", token));
        }

        let resp = req.send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_else(|_| "LibSQL HTTP error".to_string());
            return Err(anyhow!("LibSQL Error: {}", err_text));
        }

        let json_resp: serde_json::Value = resp.json().await?;

        let result_obj = json_resp.get("results")
            .and_then(|r| r.as_array())
            .and_then(|arr| arr.first())
            .and_then(|first| first.get("response"))
            .and_then(|resp| resp.get("result"));

        let mut columns = Vec::new();
        let mut rows = Vec::new();
        let mut rows_affected = 0_u64;

        if let Some(res) = result_obj {
            if let Some(cols) = res.get("cols").and_then(|c| c.as_array()) {
                for c in cols {
                    if let Some(name) = c.get("name").and_then(|n| n.as_str()) {
                        columns.push(name.to_string());
                    }
                }
            }

            if let Some(r_affected) = res.get("affected_row_count").and_then(|a| a.as_u64()) {
                rows_affected = r_affected;
            }

            if let Some(row_list) = res.get("rows").and_then(|r| r.as_array()) {
                for row_item in row_list {
                    if let Some(cells) = row_item.as_array() {
                        let mut map = serde_json::Map::new();
                        for (i, cell) in cells.iter().enumerate() {
                            let col_name = columns.get(i).cloned().unwrap_or_else(|| format!("col_{}", i));
                            let val = match cell.get("type").and_then(|t| t.as_str()) {
                                Some("integer") => cell.get("value").and_then(|v| v.as_str()).and_then(|s| s.parse::<i64>().ok()).map(serde_json::Value::from).unwrap_or(serde_json::Value::Null),
                                Some("float") => cell.get("value").and_then(|v| v.as_f64()).map(serde_json::Value::from).unwrap_or(serde_json::Value::Null),
                                Some("text") => cell.get("value").and_then(|v| v.as_str()).map(serde_json::Value::from).unwrap_or(serde_json::Value::Null),
                                Some("blob") => cell.get("value").and_then(|v| v.as_str()).map(serde_json::Value::from).unwrap_or(serde_json::Value::Null),
                                Some("null") | None => serde_json::Value::Null,
                                _ => cell.get("value").cloned().unwrap_or(serde_json::Value::Null),
                            };
                            map.insert(col_name, val);
                        }
                        rows.push(serde_json::Value::Object(map));
                    }
                }
            }
        }

        Ok(QueryResult {
            columns,
            rows,
            rows_affected,
        })
    }

    async fn cloudflare_d1_query(
        client: &reqwest::Client,
        account_id: &str,
        database_id: &str,
        api_token: &str,
        sql: &str,
    ) -> Result<QueryResult> {
        let endpoint = format!(
            "https://api.cloudflare.com/client/v4/accounts/{}/d1/database/{}/query",
            account_id, database_id
        );

        let body = serde_json::json!({
            "sql": sql,
            "params": []
        });

        let resp = client
            .post(&endpoint)
            .header("Authorization", format!("Bearer {}", api_token))
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_else(|_| "Cloudflare D1 HTTP error".to_string());
            return Err(anyhow!("Cloudflare D1 Error: {}", err_text));
        }

        let json_resp: serde_json::Value = resp.json().await?;
        if json_resp.get("success").and_then(|s| s.as_bool()) == Some(false) {
            let err_msg = json_resp.get("errors")
                .and_then(|e| e.as_array())
                .and_then(|arr| arr.first())
                .and_then(|f| f.get("message"))
                .and_then(|m| m.as_str())
                .unwrap_or("D1 Query Error");
            return Err(anyhow!("Cloudflare D1 Error: {}", err_msg));
        }

        let first_res = json_resp.get("result")
            .and_then(|r| r.as_array())
            .and_then(|arr| arr.first());

        let mut columns = Vec::new();
        let mut rows = Vec::new();
        let mut rows_affected = 0_u64;

        if let Some(res) = first_res {
            if let Some(meta) = res.get("meta") {
                if let Some(changes) = meta.get("changes").and_then(|c| c.as_u64()) {
                    rows_affected = changes;
                }
            }

            if let Some(row_arr) = res.get("results").and_then(|r| r.as_array()) {
                if let Some(first_row) = row_arr.first().and_then(|r| r.as_object()) {
                    for key in first_row.keys() {
                        columns.push(key.clone());
                    }
                }
                for row_val in row_arr {
                    rows.push(row_val.clone());
                }
            }
        }

        Ok(QueryResult {
            columns,
            rows,
            rows_affected,
        })
    }

    async fn redis_execute_cmd(
        client: &redis::Client,
        db: u8,
        query: &str,
    ) -> Result<QueryResult> {
        use redis::AsyncCommands;
        let mut conn = client.get_multiplexed_async_connection().await?;
        if db > 0 {
            let _: () = redis::cmd("SELECT").arg(db).query_async(&mut conn).await?;
        }

        let trimmed = query.trim();
        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        let cmd = parts.first().unwrap_or(&"KEYS").to_uppercase();

        let mut columns = vec!["key".to_string(), "type".to_string(), "value".to_string(), "ttl".to_string()];
        let mut rows = Vec::new();

        if cmd == "KEYS" || cmd == "SCAN" {
            let pattern = parts.get(1).copied().unwrap_or("*");
            let keys: Vec<String> = conn.keys(pattern).await.unwrap_or_default();
            for key in keys {
                let key_type: String = redis::cmd("TYPE").arg(&key).query_async(&mut conn).await.unwrap_or_else(|_| "unknown".to_string());
                let ttl: i64 = conn.ttl(&key).await.unwrap_or(-1);
                let val_str: String = match key_type.as_str() {
                    "string" => conn.get(&key).await.unwrap_or_default(),
                    "hash" => {
                        let h: HashMap<String, String> = conn.hgetall(&key).await.unwrap_or_default();
                        serde_json::to_string(&h).unwrap_or_default()
                    }
                    "list" => {
                        let l: Vec<String> = conn.lrange(&key, 0, 100).await.unwrap_or_default();
                        serde_json::to_string(&l).unwrap_or_default()
                    }
                    "set" => {
                        let s: Vec<String> = conn.smembers(&key).await.unwrap_or_default();
                        serde_json::to_string(&s).unwrap_or_default()
                    }
                    "zset" => {
                        let z: Vec<(String, f64)> = conn.zrange_withscores(&key, 0, 100).await.unwrap_or_default();
                        serde_json::to_string(&z).unwrap_or_default()
                    }
                    _ => String::new(),
                };

                let mut row_map = serde_json::Map::new();
                row_map.insert("key".to_string(), serde_json::Value::String(key));
                row_map.insert("type".to_string(), serde_json::Value::String(key_type));
                row_map.insert("value".to_string(), serde_json::Value::String(val_str));
                row_map.insert("ttl".to_string(), serde_json::Value::Number(ttl.into()));
                rows.push(serde_json::Value::Object(row_map));
            }
        } else if cmd == "GET" {
            if let Some(&key) = parts.get(1) {
                let val: Option<String> = conn.get(key).await.ok();
                let ttl: i64 = conn.ttl(key).await.unwrap_or(-1);
                let key_type: String = redis::cmd("TYPE").arg(key).query_async(&mut conn).await.unwrap_or_else(|_| "string".to_string());
                let mut row_map = serde_json::Map::new();
                row_map.insert("key".to_string(), serde_json::Value::String(key.to_string()));
                row_map.insert("type".to_string(), serde_json::Value::String(key_type));
                row_map.insert("value".to_string(), val.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null));
                row_map.insert("ttl".to_string(), serde_json::Value::Number(ttl.into()));
                rows.push(serde_json::Value::Object(row_map));
            }
        } else if cmd == "SET" {
            if parts.len() >= 3 {
                let key = parts[1];
                let val = parts[2..].join(" ");
                let _: () = conn.set(key, &val).await?;
                return Ok(QueryResult {
                    columns: vec!["result".to_string()],
                    rows: vec![serde_json::json!({ "result": "OK", "key": key, "value": val })],
                    rows_affected: 1,
                });
            }
        } else if cmd == "DEL" {
            if let Some(&key) = parts.get(1) {
                let deleted: u64 = conn.del(key).await?;
                return Ok(QueryResult {
                    columns: vec!["deleted".to_string()],
                    rows: vec![serde_json::json!({ "key": key, "deleted": deleted })],
                    rows_affected: deleted,
                });
            }
        } else {
            let mut redis_cmd = redis::cmd(&cmd);
            for p in &parts[1..] {
                redis_cmd.arg(p);
            }
            let res_val: redis::Value = redis_cmd.query_async(&mut conn).await?;
            columns = vec!["result".to_string()];
            rows = vec![serde_json::json!({ "result": format!("{:?}", res_val) })];
        }

        let rows_affected = rows.len() as u64;
        Ok(QueryResult {
            columns,
            rows,
            rows_affected,
        })
    }

    pub async fn connect(&self, config: ConnectionConfig) -> Result<()> {
        // Handle SSH tunnel if configured
        let (actual_host, actual_port, ssh_tunnel) = if let Some(ref ssh_config) = config.ssh_config {
            if ssh_config.enabled && config.db_type != DatabaseType::SQLite {
                let db_host = config.host.as_ref().ok_or_else(|| anyhow!("Host is required"))?;
                let db_port = config.port.ok_or_else(|| anyhow!("Port is required"))?;

                // Create SSH tunnel
                let tunnel = SshTunnel::connect(
                    &ssh_config.host,
                    ssh_config.port,
                    &ssh_config.username,
                    ssh_config.password.as_deref(),
                    ssh_config.private_key_path.as_deref(),
                    db_host,
                    db_port,
                )?;

                let local_port = tunnel.local_port();
                ("127.0.0.1".to_string(), local_port, Some(tunnel))
            } else {
                (
                    config.host.clone().unwrap_or_default(),
                    config.port.unwrap_or_default(),
                    None,
                )
            }
        } else {
            (
                config.host.clone().unwrap_or_default(),
                config.port.unwrap_or_default(),
                None,
            )
        };

        let pool = match config.db_type {
            DatabaseType::SQLite => {
                if config.provider.as_deref() == Some("cloudflare") {
                    let account_id = config.cloudflare_account_id.as_deref()
                        .ok_or_else(|| anyhow!("Cloudflare Account ID is required"))?
                        .to_string();
                    let database_id = config.cloudflare_database_id.as_deref()
                        .ok_or_else(|| anyhow!("Cloudflare Database ID is required"))?
                        .to_string();
                    let api_token = config.cloudflare_api_token.as_deref()
                        .ok_or_else(|| anyhow!("Cloudflare API Token is required"))?
                        .to_string();
                    let client = reqwest::Client::builder().build()?;
                    DatabasePool::CloudflareD1 {
                        client,
                        account_id,
                        database_id,
                        api_token,
                    }
                } else {
                    let path = config
                        .file_path
                        .as_ref()
                        .ok_or_else(|| anyhow!("SQLite file path is required"))?;
                    let connection_string = format!("sqlite://{}", path);
                    let pool = sqlx::SqlitePool::connect(&connection_string).await?;
                    DatabasePool::Sqlite(pool)
                }
            }
            DatabaseType::PostgreSQL => {
                let username = config.username.as_ref().ok_or_else(|| anyhow!("Username is required"))?;
                let password = config.password.as_ref().ok_or_else(|| anyhow!("Password is required"))?;
                let database = config.database.as_ref().ok_or_else(|| anyhow!("Database is required"))?;

                let ssl_mode = if config.provider.as_deref() == Some("planetscale_postgres") {
                    "?sslmode=require"
                } else {
                    ""
                };
                let connection_string = format!(
                    "postgresql://{}:{}@{}:{}/{}{}",
                    username, password, actual_host, actual_port, database, ssl_mode
                );
                let pool = sqlx::PgPool::connect(&connection_string).await?;
                DatabasePool::Postgres(pool)
            }
            DatabaseType::MySQL => {
                let username = config.username.as_ref().ok_or_else(|| anyhow!("Username is required"))?;
                let database = config.database.as_ref().ok_or_else(|| anyhow!("Database is required"))?;

                let is_cloud_auth = matches!(
                    config.auth_method.as_ref(),
                    Some(MariaDBAuthMethod::AwsIam) | Some(MariaDBAuthMethod::AzureAd) | Some(MariaDBAuthMethod::GcpIam)
                );
                let is_planetscale = config.provider.as_deref() == Some("planetscale") || actual_host.contains("psdb.cloud");
                let (password, ssl_suffix) = if is_cloud_auth {
                    let token = Self::fetch_cloud_token(&config).await?;
                    (token, "?ssl-mode=required")
                } else if is_planetscale {
                    let pw = config.password.as_ref().ok_or_else(|| anyhow!("Password is required"))?;
                    (pw.clone(), "?ssl-mode=required")
                } else {
                    let pw = config.password.as_ref().ok_or_else(|| anyhow!("Password is required"))?;
                    (pw.clone(), "")
                };

                let encoded_pw = urlencoding::encode(&password).into_owned();
                let connection_string = format!(
                    "mysql://{}:{}@{}:{}/{}{}",
                    username, encoded_pw, actual_host, actual_port, database, ssl_suffix
                );
                let pool = sqlx::MySqlPool::connect(&connection_string).await?;
                DatabasePool::MySql(pool)
            }
            DatabaseType::MongoDB => {
                let uri = if config.mongo_auth_method.as_deref() == Some("atlas") {
                    config.mongo_connection_string.as_ref()
                        .ok_or_else(|| anyhow!("Atlas connection string is required"))?
                        .clone()
                } else {
                    let user = config.username.as_ref().ok_or_else(|| anyhow!("Username is required"))?;
                    let pass = config.password.as_ref().ok_or_else(|| anyhow!("Password is required"))?;
                    let encoded_pw = urlencoding::encode(pass);
                    let host = if actual_host.is_empty() { "localhost".to_string() } else { actual_host.clone() };
                    let port = if actual_port == 0 { 27017 } else { actual_port };
                    let db = config.database.as_deref().unwrap_or("admin");
                    let auth_source = config.mongo_auth_source.as_deref().unwrap_or("admin");
                    format!("mongodb://{}:{}@{}:{}/{}?authSource={}", user, encoded_pw, host, port, db, auth_source)
                };
                let client = mongodb::Client::with_uri_str(&uri).await?;
                let database = config.database.clone().or(config.mongo_database.clone()).unwrap_or_else(|| "admin".to_string());
                DatabasePool::MongoDB { client, database }
            }
            DatabaseType::ClickHouse => {
                let host = if actual_host.is_empty() { "localhost".to_string() } else { actual_host };
                let port = if actual_port == 0 { 8123 } else { actual_port };
                let use_ssl = config.clickhouse_use_ssl.unwrap_or(false);
                let scheme = if use_ssl { "https" } else { "http" };
                let base_url = format!("{}://{}:{}", scheme, host, port);

                let mut headers = reqwest::header::HeaderMap::new();
                if let Some(user) = &config.username {
                    if !user.is_empty() {
                        headers.insert("X-ClickHouse-User", reqwest::header::HeaderValue::from_str(user)?);
                    }
                }
                if let Some(pass) = &config.password {
                    if !pass.is_empty() {
                        headers.insert("X-ClickHouse-Key", reqwest::header::HeaderValue::from_str(pass)?);
                    }
                }

                let client = reqwest::Client::builder()
                    .default_headers(headers)
                    .build()?;

                let database = config.database.as_deref().unwrap_or("default").to_string();

                DatabasePool::ClickHouse {
                    client,
                    url: base_url,
                    database,
                }
            }
            DatabaseType::LibSQL => {
                let url = config.libsql_url.as_deref()
                    .or(config.host.as_deref())
                    .ok_or_else(|| anyhow!("LibSQL Connection URI is required"))?
                    .to_string();
                let token = config.libsql_auth_token.as_deref()
                    .or(config.password.as_deref())
                    .unwrap_or_default()
                    .to_string();

                let client = reqwest::Client::builder().build()?;

                DatabasePool::LibSQL {
                    client,
                    url,
                    token,
                }
            }
            DatabaseType::Redis => {
                let host = if actual_host.is_empty() { "localhost".to_string() } else { actual_host };
                let port = if actual_port == 0 { 6379 } else { actual_port };
                let db = config.redis_db.unwrap_or(0);

                let user_pass = match (config.username.as_deref(), config.password.as_deref()) {
                    (Some(u), Some(p)) if !u.is_empty() && !p.is_empty() => format!("{}:{}@", u, urlencoding::encode(p)),
                    (None, Some(p)) if !p.is_empty() => format!(":{}@", urlencoding::encode(p)),
                    (Some(u), None) if !u.is_empty() => format!("{}@", u),
                    _ => "".to_string(),
                };
                let redis_url = format!("redis://{}{}:{}/{}", user_pass, host, port, db);
                let client = redis::Client::open(redis_url)?;
                DatabasePool::Redis { client, db }
            }
        };

        let mut connections = self.connections.write().await;
        connections.insert(config.id.clone(), pool);

        // Store SSH tunnel if one was created
        if let Some(tunnel) = ssh_tunnel {
            let mut tunnels = self.ssh_tunnels.write().await;
            tunnels.insert(config.id.clone(), tunnel);
        }

        Ok(())
    }

    pub async fn disconnect(&self, connection_id: &str) -> Result<()> {
        let mut connections = self.connections.write().await;
        connections
            .remove(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        // Clean up SSH tunnel if exists
        let mut tunnels = self.ssh_tunnels.write().await;
        tunnels.remove(connection_id);

        Ok(())
    }

    pub async fn test_connection(config: ConnectionConfig) -> Result<ConnectionTestResult> {
        let start = std::time::Instant::now();

        // Handle SSH tunnel if configured
        let (actual_host, actual_port, _ssh_tunnel) = if let Some(ref ssh_config) = config.ssh_config {
            if ssh_config.enabled && config.db_type != DatabaseType::SQLite {
                let db_host = config.host.as_ref().ok_or_else(|| anyhow!("Host is required"))?;
                let db_port = config.port.ok_or_else(|| anyhow!("Port is required"))?;

                // Create SSH tunnel for testing
                match SshTunnel::connect(
                    &ssh_config.host,
                    ssh_config.port,
                    &ssh_config.username,
                    ssh_config.password.as_deref(),
                    ssh_config.private_key_path.as_deref(),
                    db_host,
                    db_port,
                ) {
                    Ok(tunnel) => {
                        let local_port = tunnel.local_port();
                        ("127.0.0.1".to_string(), local_port, Some(tunnel))
                    }
                    Err(e) => {
                        return Ok(ConnectionTestResult {
                            success: false,
                            latency_ms: 0,
                            db_version: String::new(),
                            error: Some(format!("SSH tunnel failed: {}", e)),
                        });
                    }
                }
            } else {
                (
                    config.host.clone().unwrap_or_default(),
                    config.port.unwrap_or_default(),
                    None,
                )
            }
        } else {
            (
                config.host.clone().unwrap_or_default(),
                config.port.unwrap_or_default(),
                None,
            )
        };

        let result = match config.db_type {
            DatabaseType::SQLite => {
                if config.provider.as_deref() == Some("cloudflare") {
                    let account_id = config.cloudflare_account_id.as_deref()
                        .ok_or_else(|| anyhow!("Cloudflare Account ID is required"))?;
                    let database_id = config.cloudflare_database_id.as_deref()
                        .ok_or_else(|| anyhow!("Cloudflare Database ID is required"))?;
                    let api_token = config.cloudflare_api_token.as_deref()
                        .ok_or_else(|| anyhow!("Cloudflare API Token is required"))?;

                    match reqwest::Client::builder().build() {
                        Ok(client) => {
                            match Self::cloudflare_d1_query(&client, account_id, database_id, api_token, "SELECT sqlite_version()").await {
                                Ok(res) => {
                                    let version = res.rows.first()
                                        .and_then(|r| r.as_object())
                                        .and_then(|obj| obj.values().next())
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("Unknown");
                                    let latency_ms = start.elapsed().as_millis() as u64;
                                    ConnectionTestResult {
                                        success: true,
                                        latency_ms,
                                        db_version: format!("Cloudflare D1 (SQLite {})", version),
                                        error: None,
                                    }
                                }
                                Err(e) => ConnectionTestResult {
                                    success: false,
                                    latency_ms: 0,
                                    db_version: String::new(),
                                    error: Some(e.to_string()),
                                },
                            }
                        }
                        Err(e) => ConnectionTestResult {
                            success: false,
                            latency_ms: 0,
                            db_version: String::new(),
                            error: Some(e.to_string()),
                        },
                    }
                } else {
                    let path = config
                        .file_path
                        .as_ref()
                        .ok_or_else(|| anyhow!("SQLite file path is required"))?;
                    let connection_string = format!("sqlite://{}", path);

                    match sqlx::SqlitePool::connect(&connection_string).await {
                        Ok(pool) => {
                            let version_query = "SELECT sqlite_version()";
                            let row = sqlx::query(version_query).fetch_one(&pool).await?;
                            let version: String = row.try_get(0).unwrap_or_else(|_| "Unknown".to_string());

                            let latency_ms = start.elapsed().as_millis() as u64;

                            pool.close().await;

                            ConnectionTestResult {
                                success: true,
                                latency_ms,
                                db_version: format!("SQLite {}", version),
                                error: None,
                            }
                        }
                        Err(e) => ConnectionTestResult {
                            success: false,
                            latency_ms: 0,
                            db_version: String::new(),
                            error: Some(e.to_string()),
                        },
                    }
                }
            }
            DatabaseType::PostgreSQL => {
                let username = config.username.as_ref().ok_or_else(|| anyhow!("Username is required"))?;
                let password = config.password.as_ref().ok_or_else(|| anyhow!("Password is required"))?;
                let database = config.database.as_ref().ok_or_else(|| anyhow!("Database is required"))?;

                let ssl_mode = if config.provider.as_deref() == Some("planetscale_postgres") {
                    "?sslmode=require"
                } else {
                    ""
                };
                let connection_string = format!(
                    "postgresql://{}:{}@{}:{}/{}{}",
                    username, password, actual_host, actual_port, database, ssl_mode
                );

                match sqlx::PgPool::connect(&connection_string).await {
                    Ok(pool) => {
                        let version_query = "SELECT version()";
                        let row = sqlx::query(version_query).fetch_one(&pool).await?;
                        let version: String = row.try_get(0).unwrap_or_else(|_| "Unknown".to_string());

                        // Extract just the version number
                        let version_short = version.split_whitespace().take(2).collect::<Vec<_>>().join(" ");

                        let latency_ms = start.elapsed().as_millis() as u64;

                        pool.close().await;

                        ConnectionTestResult {
                            success: true,
                            latency_ms,
                            db_version: version_short,
                            error: None,
                        }
                    }
                    Err(e) => ConnectionTestResult {
                        success: false,
                        latency_ms: 0,
                        db_version: String::new(),
                        error: Some(e.to_string()),
                    },
                }
            }
            DatabaseType::MySQL => {
                let username = config.username.as_ref().ok_or_else(|| anyhow!("Username is required"))?;
                let database = config.database.as_ref().ok_or_else(|| anyhow!("Database is required"))?;

                let is_cloud_auth = matches!(
                    config.auth_method.as_ref(),
                    Some(MariaDBAuthMethod::AwsIam) | Some(MariaDBAuthMethod::AzureAd) | Some(MariaDBAuthMethod::GcpIam)
                );
                let is_planetscale = config.provider.as_deref() == Some("planetscale") || actual_host.contains("psdb.cloud");
                let (password, ssl_suffix) = if is_cloud_auth {
                    let token = Self::fetch_cloud_token(&config).await?;
                    (token, "?ssl-mode=required")
                } else if is_planetscale {
                    let pw = config.password.as_ref().ok_or_else(|| anyhow!("Password is required"))?;
                    (pw.clone(), "?ssl-mode=required")
                } else {
                    let pw = config.password.as_ref().ok_or_else(|| anyhow!("Password is required"))?;
                    (pw.clone(), "")
                };

                let encoded_pw = urlencoding::encode(&password).into_owned();
                let connection_string = format!(
                    "mysql://{}:{}@{}:{}/{}{}",
                    username, encoded_pw, actual_host, actual_port, database, ssl_suffix
                );

                match sqlx::MySqlPool::connect(&connection_string).await {
                    Ok(pool) => {
                        let version_query = "SELECT VERSION()";
                        let row = sqlx::query(version_query).fetch_one(&pool).await?;
                        let version: String = row.try_get(0).unwrap_or_else(|_| "Unknown".to_string());

                        let latency_ms = start.elapsed().as_millis() as u64;

                        pool.close().await;

                        ConnectionTestResult {
                            success: true,
                            latency_ms,
                            db_version: format!("MySQL {}", version),
                            error: None,
                        }
                    }
                    Err(e) => ConnectionTestResult {
                        success: false,
                        latency_ms: 0,
                        db_version: String::new(),
                        error: Some(e.to_string()),
                    },
                }
            }
            DatabaseType::MongoDB => {
                let uri = if config.mongo_auth_method.as_deref() == Some("atlas") {
                    config.mongo_connection_string.as_ref()
                        .ok_or_else(|| anyhow!("Atlas connection string is required"))?
                        .clone()
                } else {
                    let user = config.username.as_ref().ok_or_else(|| anyhow!("Username is required"))?;
                    let pass = config.password.as_ref().ok_or_else(|| anyhow!("Password is required"))?;
                    let encoded_pw = urlencoding::encode(pass);
                    let host = if actual_host.is_empty() { "localhost".to_string() } else { actual_host.clone() };
                    let port = if actual_port == 0 { 27017 } else { actual_port };
                    let db = config.database.as_deref().unwrap_or("admin");
                    let auth_source = config.mongo_auth_source.as_deref().unwrap_or("admin");
                    format!("mongodb://{}:{}@{}:{}/{}?authSource={}", user, encoded_pw, host, port, db, auth_source)
                };
                match mongodb::Client::with_uri_str(&uri).await {
                    Ok(client) => {
                        let ping_res = client.database("admin").run_command(doc! { "ping": 1 }).await;
                        if let Err(e) = ping_res {
                            ConnectionTestResult {
                                success: false,
                                latency_ms: 0,
                                db_version: String::new(),
                                error: Some(e.to_string()),
                            }
                        } else {
                            let latency_ms = start.elapsed().as_millis() as u64;
                            ConnectionTestResult {
                                success: true,
                                latency_ms,
                                db_version: "MongoDB".to_string(),
                                error: None,
                            }
                        }
                    }
                    Err(e) => ConnectionTestResult {
                        success: false,
                        latency_ms: 0,
                        db_version: String::new(),
                        error: Some(e.to_string()),
                    },
                }
            }
            DatabaseType::ClickHouse => {
                let host = if actual_host.is_empty() { "localhost".to_string() } else { actual_host };
                let port = if actual_port == 0 { 8123 } else { actual_port };
                let use_ssl = config.clickhouse_use_ssl.unwrap_or(false);
                let scheme = if use_ssl { "https" } else { "http" };
                let base_url = format!("{}://{}:{}", scheme, host, port);

                let mut headers = reqwest::header::HeaderMap::new();
                if let Some(user) = &config.username {
                    if !user.is_empty() {
                        if let Ok(hv) = reqwest::header::HeaderValue::from_str(user) {
                            headers.insert("X-ClickHouse-User", hv);
                        }
                    }
                }
                if let Some(pass) = &config.password {
                    if !pass.is_empty() {
                        if let Ok(hv) = reqwest::header::HeaderValue::from_str(pass) {
                            headers.insert("X-ClickHouse-Key", hv);
                        }
                    }
                }

                let client_res = reqwest::Client::builder()
                    .default_headers(headers)
                    .build();

                match client_res {
                    Ok(client) => {
                        let database = config.database.as_deref().unwrap_or("default");
                        match Self::clickhouse_http_query(&client, &base_url, database, "SELECT version()").await {
                            Ok(res) => {
                                let version = res.rows.first()
                                    .and_then(|r| r.as_object())
                                    .and_then(|obj| obj.values().next())
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("Unknown");
                                let latency_ms = start.elapsed().as_millis() as u64;
                                ConnectionTestResult {
                                    success: true,
                                    latency_ms,
                                    db_version: format!("ClickHouse {}", version),
                                    error: None,
                                }
                            }
                            Err(e) => ConnectionTestResult {
                                success: false,
                                latency_ms: 0,
                                db_version: String::new(),
                                error: Some(e.to_string()),
                            },
                        }
                    }
                    Err(e) => ConnectionTestResult {
                        success: false,
                        latency_ms: 0,
                        db_version: String::new(),
                        error: Some(e.to_string()),
                    },
                }
            }
            DatabaseType::LibSQL => {
                let url = config.libsql_url.as_deref()
                    .or(config.host.as_deref())
                    .ok_or_else(|| anyhow!("LibSQL Connection URI is required"))?;
                let token = config.libsql_auth_token.as_deref()
                    .or(config.password.as_deref())
                    .unwrap_or_default();

                match reqwest::Client::builder().build() {
                    Ok(client) => {
                        match Self::libsql_http_pipeline(&client, url, token, "SELECT sqlite_version()").await {
                            Ok(res) => {
                                let version = res.rows.first()
                                    .and_then(|r| r.as_object())
                                    .and_then(|obj| obj.values().next())
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("Unknown");
                                let latency_ms = start.elapsed().as_millis() as u64;
                                let provider_label = if config.provider.as_deref() == Some("turso") {
                                    "Turso (LibSQL)"
                                } else if config.provider.as_deref() == Some("valtown") {
                                    "Val Town (LibSQL)"
                                } else {
                                    "LibSQL"
                                };
                                ConnectionTestResult {
                                    success: true,
                                    latency_ms,
                                    db_version: format!("{} v{}", provider_label, version),
                                    error: None,
                                }
                            }
                            Err(e) => ConnectionTestResult {
                                success: false,
                                latency_ms: 0,
                                db_version: String::new(),
                                error: Some(e.to_string()),
                            },
                        }
                    }
                    Err(e) => ConnectionTestResult {
                        success: false,
                        latency_ms: 0,
                        db_version: String::new(),
                        error: Some(e.to_string()),
                    },
                }
            }
            DatabaseType::Redis => {
                let host = if actual_host.is_empty() { "localhost".to_string() } else { actual_host };
                let port = if actual_port == 0 { 6379 } else { actual_port };
                let db = config.redis_db.unwrap_or(0);

                let user_pass = match (config.username.as_deref(), config.password.as_deref()) {
                    (Some(u), Some(p)) if !u.is_empty() && !p.is_empty() => format!("{}:{}@", u, urlencoding::encode(p)),
                    (None, Some(p)) if !p.is_empty() => format!(":{}@", urlencoding::encode(p)),
                    (Some(u), None) if !u.is_empty() => format!("{}@", u),
                    _ => "".to_string(),
                };
                let redis_url = format!("redis://{}{}:{}/{}", user_pass, host, port, db);
                match redis::Client::open(redis_url) {
                    Ok(client) => {
                        match client.get_multiplexed_async_connection().await {
                            Ok(mut conn) => {
                                let info: String = redis::cmd("INFO").arg("server").query_async(&mut conn).await.unwrap_or_default();
                                let redis_ver = info.lines()
                                    .find(|l| l.starts_with("redis_version:"))
                                    .and_then(|l| l.split(':').nth(1))
                                    .unwrap_or("Server");

                                let latency_ms = start.elapsed().as_millis() as u64;
                                ConnectionTestResult {
                                    success: true,
                                    latency_ms,
                                    db_version: format!("Redis v{} (DB {})", redis_ver.trim(), db),
                                    error: None,
                                }
                            }
                            Err(e) => ConnectionTestResult {
                                success: false,
                                latency_ms: 0,
                                db_version: String::new(),
                                error: Some(e.to_string()),
                            },
                        }
                    }
                    Err(e) => ConnectionTestResult {
                        success: false,
                        latency_ms: 0,
                        db_version: String::new(),
                        error: Some(e.to_string()),
                    },
                }
            }
        };

        Ok(result)
    }

    pub async fn list_tables(&self, connection_id: &str, _db_type: &DatabaseType) -> Result<Vec<DatabaseTable>> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        let tables = match pool {
            DatabasePool::Sqlite(pool) => {
                // SQLite: Get table name and type from sqlite_master
                let query = "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name";
                let rows = sqlx::query(query).fetch_all(pool).await?;
                
                let mut tables = Vec::new();
                for row in rows {
                    let name: String = row.try_get(0).unwrap_or_default();
                    let table_type: String = row.try_get(1).unwrap_or_default();
                    
                    // Get row count for tables (not views)
                    let row_count = if table_type == "table" {
                        let count_query = format!("SELECT COUNT(*) FROM \"{}\"", name);
                        sqlx::query(&count_query)
                            .fetch_one(pool)
                            .await
                            .ok()
                            .and_then(|row| row.try_get::<i64, _>(0).ok())
                    } else {
                        None
                    };
                    
                    tables.push(DatabaseTable {
                        name,
                        schema: None,
                        full_name: None,
                        row_count,
                        size_kb: None, // SQLite doesn't easily provide per-table size
                        table_type: Some(table_type.to_uppercase()),
                    });
                }
                tables
            }
            DatabasePool::Postgres(pool) => {
                // PostgreSQL: include user schemas (not only public)
                let query = r#"
                    SELECT 
                        n.nspname AS schema_name,
                        c.relname AS table_name,
                        CASE c.relkind
                            WHEN 'r' THEN 'BASE TABLE'
                            WHEN 'p' THEN 'PARTITIONED TABLE'
                            WHEN 'v' THEN 'VIEW'
                            WHEN 'm' THEN 'MATERIALIZED VIEW'
                            WHEN 'f' THEN 'FOREIGN TABLE'
                            ELSE c.relkind::text
                        END AS table_type,
                        s.n_live_tup::bigint AS row_count,
                        pg_total_relation_size(c.oid)::bigint / 1024 AS size_kb
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
                    WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
                      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
                      AND n.nspname NOT LIKE 'pg_toast%'
                    ORDER BY n.nspname, c.relname
                "#;
                let rows = sqlx::query(query).fetch_all(pool).await?;
                rows.into_iter()
                    .map(|row| {
                        let schema_name: String = row.try_get(0).unwrap_or_else(|_| "public".to_string());
                        let name: String = row.try_get(1).unwrap_or_default();
                        let table_type: String = row.try_get(2).unwrap_or_default();
                        let row_count: Option<i64> = row.try_get(3).ok();
                        let size_kb: Option<i64> = row.try_get(4).ok();
                        
                        DatabaseTable {
                            full_name: Some(format!("{}.{}", schema_name, name)),
                            name,
                            schema: Some(schema_name),
                            row_count,
                            size_kb,
                            table_type: Some(table_type.to_uppercase()),
                        }
                    })
                    .collect()
            }
            DatabasePool::MySql(pool) => {
                // MySQL: Get statistics from information_schema
                let query = r#"
                    SELECT 
                        table_name,
                        table_type,
                        table_rows,
                        CAST(ROUND((data_length + index_length) / 1024, 0) AS UNSIGNED) as size_kb
                    FROM information_schema.tables 
                    WHERE table_schema = DATABASE()
                    ORDER BY table_name
                "#;
                let rows = sqlx::query(query).fetch_all(pool).await?;
                rows.into_iter()
                    .map(|row| {
                        let name: String = row.try_get(0).unwrap_or_default();
                        let table_type: String = row.try_get(1).unwrap_or_default();
                        let row_count: Option<i64> = row.try_get::<Option<u64>, _>(2).ok().flatten().map(|v| v as i64);
                        let size_kb: Option<i64> = row.try_get::<Option<u64>, _>(3).ok().flatten().map(|v| v as i64);
                        
                        DatabaseTable {
                            name,
                            schema: None,
                            full_name: None,
                            row_count,
                            size_kb,
                            table_type: Some(table_type),
                        }
                    })
                    .collect()
            }
            DatabasePool::MongoDB { client, database } => {
                let db = client.database(database);
                let collections = db.list_collection_names().await.unwrap_or_default();
                let mut tables = Vec::new();
                for name in collections {
                    let count = db.collection::<BsonDocument>(&name)
                        .estimated_document_count()
                        .await
                        .ok()
                        .map(|c| c as i64);
                    tables.push(DatabaseTable {
                        name: name.clone(),
                        schema: None,
                        full_name: None,
                        row_count: count,
                        size_kb: None,
                        table_type: Some("COLLECTION".to_string()),
                    });
                }
                tables
            }
            DatabasePool::ClickHouse { client, url, database } => {
                let query = format!(
                    "SELECT name, engine, total_rows FROM system.tables WHERE database = '{}' AND is_temporary = 0 FORMAT JSONCompact",
                    database.replace('\'', "''")
                );
                let res = Self::clickhouse_http_query(client, url, database, &query).await?;
                let mut tables = Vec::new();
                for row in res.rows {
                    if let Some(obj) = row.as_object() {
                        let name = obj.get("name").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                        let engine = obj.get("engine").and_then(|v| v.as_str()).map(|s| s.to_string());
                        let count = obj.get("total_rows").and_then(|v| v.as_u64()).map(|n| n as i64);
                        tables.push(DatabaseTable {
                            name: name.clone(),
                            schema: None,
                            full_name: Some(name),
                            row_count: count,
                            size_kb: None,
                            table_type: engine,
                        });
                    }
                }
                tables
            }
            DatabasePool::LibSQL { client, url, token } => {
                let query = "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name";
                let res = Self::libsql_http_pipeline(client, url, token, query).await?;
                let mut tables = Vec::new();
                for row in res.rows {
                    if let Some(obj) = row.as_object() {
                        let name = obj.get("name").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                        let table_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("table").to_string();
                        tables.push(DatabaseTable {
                            name: name.clone(),
                            schema: None,
                            full_name: Some(name),
                            row_count: None,
                            size_kb: None,
                            table_type: Some(table_type.to_uppercase()),
                        });
                    }
                }
                tables
            }
            DatabasePool::CloudflareD1 { client, account_id, database_id, api_token } => {
                let query = "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name";
                let res = Self::cloudflare_d1_query(client, account_id, database_id, api_token, query).await?;
                let mut tables = Vec::new();
                for row in res.rows {
                    if let Some(obj) = row.as_object() {
                        let name = obj.get("name").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                        let table_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("table").to_string();
                        tables.push(DatabaseTable {
                            name: name.clone(),
                            schema: None,
                            full_name: Some(name),
                            row_count: None,
                            size_kb: None,
                            table_type: Some(table_type.to_uppercase()),
                        });
                    }
                }
                tables
            }
            DatabasePool::Redis { client, db } => {
                let res = Self::redis_execute_cmd(client, *db, "KEYS *").await?;
                let mut tables = Vec::new();
                for row in res.rows {
                    if let Some(obj) = row.as_object() {
                        if let Some(k) = obj.get("key").and_then(|v| v.as_str()) {
                            let k_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("KEY").to_string();
                            tables.push(DatabaseTable {
                                name: k.to_string(),
                                schema: None,
                                full_name: Some(k.to_string()),
                                row_count: Some(1),
                                size_kb: None,
                                table_type: Some(k_type.to_uppercase()),
                            });
                        }
                    }
                }
                tables
            }
        };

        Ok(tables)
    }

    pub async fn get_table_structure(
        &self,
        connection_id: &str,
        table_name: &str,
        db_type: &DatabaseType,
    ) -> Result<Vec<TableColumn>> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        let query = match db_type {
            DatabaseType::SQLite | DatabaseType::LibSQL => {
                format!("PRAGMA table_info({})", table_name)
            }
            DatabaseType::PostgreSQL => String::new(),
            DatabaseType::MySQL => {
                format!(
                    "SELECT c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE, c.COLUMN_DEFAULT, \
                     IF(c.COLUMN_KEY = 'PRI', 1, 0) as is_primary_key \
                     FROM information_schema.columns c \
                     WHERE c.table_name = '{}' AND c.table_schema = DATABASE() \
                     ORDER BY c.ORDINAL_POSITION",
                    table_name
                )
            }
            DatabaseType::MongoDB => String::new(),
            DatabaseType::ClickHouse => String::new(),
            DatabaseType::Redis => String::new(),
        };

        let columns = match pool {
            DatabasePool::Sqlite(pool) => {
                let create_sql: Option<String> = sqlx::query_scalar(
                    "SELECT sql FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?"
                )
                .bind(table_name)
                .fetch_optional(pool)
                .await
                .ok()
                .flatten();

                let json_columns = create_sql
                    .as_deref()
                    .map(extract_sqlite_json_columns_from_ddl)
                    .unwrap_or_default();

                let rows = sqlx::query(&query).fetch_all(pool).await?;
                rows.into_iter()
                    .map(|row| {
                        let name: String = row.try_get(1).unwrap_or_default();
                        let data_type: String = row.try_get(2).unwrap_or_default();
                        let not_null: i64 = row.try_get(3).unwrap_or(0);
                        let default_value: Option<String> = row.try_get(4).ok();
                        let is_pk: i64 = row.try_get(5).unwrap_or(0);
                        let mut family = classify_sqlite_type(&data_type);

                        let has_json_check = json_columns.contains(&name.to_lowercase());
                        if has_json_check && family != ColumnTypeFamily::Json {
                            family = ColumnTypeFamily::Json;
                        }

                        let generation_expression = if has_json_check {
                            Some(format!("CHECK(json_valid({}))", name))
                        } else {
                            None
                        };

                        TableColumn {
                            name,
                            data_type: data_type.clone(),
                            raw_type: Some(data_type.clone()),
                            normalized_type: normalize_type_name(&data_type),
                            type_family: family.clone(),
                            db_type: DatabaseType::SQLite,
                            is_nullable: not_null == 0,
                            default_value,
                            is_primary_key: is_pk > 0,
                            is_boolean_like: matches!(family, ColumnTypeFamily::Boolean),
                            is_array: false,
                            enum_values: None,
                            identity_kind: None,
                            generated_kind: None,
                            generation_expression,
                            column_comment: None,
                            collation_name: None,
                            domain_name: None,
                            domain_schema: None,
                            domain_base_type: None,
                            array_dimensions: None,
                            element_raw_type: None,
                        }
                    })
                    .collect()
            }
            DatabasePool::Postgres(pool) => {
                let rows = sqlx::query(
                    r#"
                    SELECT
                      att.attname AS column_name,
                      pg_catalog.format_type(att.atttypid, att.atttypmod) AS formatted_type,
                      typ.typname AS raw_type_name,
                      typ_ns.nspname AS type_schema,
                      typ.typtype AS type_kind,
                      typ.typcategory AS type_category,
                      att.attnotnull AS not_null,
                      pg_get_expr(def.adbin, def.adrelid) AS default_value,
                      CASE WHEN pk.attnum IS NOT NULL THEN true ELSE false END AS is_primary_key,
                      CASE WHEN att.attndims > 0 OR typ.typcategory = 'A' THEN true ELSE false END AS is_array,
                      att.attndims AS array_dimensions,
                      CASE WHEN typ.typcategory = 'A' THEN elem.typname ELSE NULL END AS element_raw_type,
                      (
                        SELECT array_agg(enumlabel ORDER BY enumsortorder)
                        FROM pg_enum
                        WHERE enumtypid = typ.oid
                      ) AS enum_values,
                      att.attidentity AS identity_kind,
                      att.attgenerated AS generated_kind,
                      CASE WHEN att.attgenerated <> '' THEN pg_get_expr(def.adbin, def.adrelid) ELSE NULL END AS generation_expression,
                      pg_catalog.col_description(att.attrelid, att.attnum) AS column_comment,
                      col.collname AS collation_name,
                      CASE WHEN typ.typtype = 'd' THEN typ.typname ELSE NULL END AS domain_name,
                      CASE WHEN typ.typtype = 'd' THEN typ_ns.nspname ELSE NULL END AS domain_schema,
                      CASE WHEN typ.typtype = 'd' THEN base_typ.typname ELSE NULL END AS domain_base_type
                    FROM pg_attribute att
                    JOIN pg_class cls ON cls.oid = att.attrelid
                    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
                    JOIN pg_type typ ON typ.oid = att.atttypid
                    JOIN pg_namespace typ_ns ON typ_ns.oid = typ.typnamespace
                    LEFT JOIN pg_type elem ON elem.oid = typ.typelem
                    LEFT JOIN pg_type base_typ ON base_typ.oid = typ.typbasetype
                    LEFT JOIN pg_attrdef def ON def.adrelid = att.attrelid AND def.adnum = att.attnum
                    LEFT JOIN pg_collation col ON col.oid = att.attcollation
                    LEFT JOIN (
                        SELECT conrelid, unnest(conkey) AS attnum
                        FROM pg_constraint
                        WHERE contype = 'p'
                    ) pk ON pk.conrelid = att.attrelid AND pk.attnum = att.attnum
                    WHERE att.attnum > 0
                      AND NOT att.attisdropped
                      AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
                      AND ns.nspname NOT LIKE 'pg_toast%'
                      AND (
                        ns.nspname || '.' || cls.relname = $1
                        OR ($1 NOT LIKE '%.%' AND ns.nspname = 'public' AND cls.relname = $1)
                      )
                    ORDER BY att.attnum
                    "#,
                )
                .bind(table_name)
                .fetch_all(pool)
                .await?;
                rows.into_iter()
                    .map(|row| {
                        let name: String = row.try_get(0).unwrap_or_default();
                        let data_type: String = row.try_get(1).unwrap_or_default();
                        let raw_type: String = row.try_get(2).unwrap_or_default();
                        let type_kind: String = row.try_get(4).unwrap_or_default();
                        let not_null: bool = row.try_get(6).unwrap_or(false);
                        let default_value: Option<String> = row.try_get(7).ok();
                        let is_primary_key: bool = row.try_get(8).unwrap_or(false);
                        let is_array: bool = row.try_get(9).unwrap_or(false);
                        let array_dimensions: Option<i32> = row.try_get(10).ok();
                        let element_raw_type: Option<String> = row.try_get(11).ok();
                        let enum_values: Option<Vec<String>> = row.try_get(12).ok();
                        let identity_kind: Option<String> = row.try_get(13).ok();
                        let generated_kind: Option<String> = row.try_get(14).ok();
                        let generation_expression: Option<String> = row.try_get(15).ok();
                        let column_comment: Option<String> = row.try_get(16).ok();
                        let collation_name: Option<String> = row.try_get(17).ok();
                        let domain_name: Option<String> = row.try_get(18).ok();
                        let domain_schema: Option<String> = row.try_get(19).ok();
                        let domain_base_type: Option<String> = row.try_get(20).ok();
                        let family = classify_postgres_type(&data_type, &raw_type, &type_kind, is_array);

                        TableColumn {
                            name,
                            data_type: data_type.clone(),
                            raw_type: Some(raw_type),
                            normalized_type: normalize_type_name(&data_type),
                            type_family: family.clone(),
                            db_type: DatabaseType::PostgreSQL,
                            is_nullable: !not_null,
                            default_value,
                            is_primary_key,
                            is_boolean_like: matches!(family, ColumnTypeFamily::Boolean),
                            is_array,
                            enum_values,
                            identity_kind,
                            generated_kind,
                            generation_expression,
                            column_comment,
                            collation_name,
                            domain_name,
                            domain_schema,
                            domain_base_type,
                            array_dimensions,
                            element_raw_type,
                        }
                    })
                    .collect()
            }
            DatabasePool::MySql(pool) => {
                let rows = sqlx::query(&query).fetch_all(pool).await?;
                rows.into_iter()
                    .map(|row| {
                        let name: String = row.try_get(0).unwrap_or_default();
                        let data_type: String = row.try_get(1).unwrap_or_default();
                        let is_nullable: String = row.try_get(2).unwrap_or_default();
                        let default_value: Option<String> = row.try_get(3).ok();
                        let is_primary_key: i32 = row.try_get(4).unwrap_or(0);
                        let family = classify_mysql_type(&data_type);

                        TableColumn {
                            name,
                            data_type: data_type.clone(),
                            raw_type: Some(data_type.clone()),
                            normalized_type: normalize_type_name(&data_type),
                            type_family: family.clone(),
                            db_type: DatabaseType::MySQL,
                            is_nullable: is_nullable.to_uppercase() == "YES",
                            default_value,
                            is_primary_key: is_primary_key > 0,
                            is_boolean_like: matches!(family, ColumnTypeFamily::Boolean),
                            is_array: false,
                            enum_values: None,
                            identity_kind: None,
                            generated_kind: None,
                            generation_expression: None,
                            column_comment: None,
                            collation_name: None,
                            domain_name: None,
                            domain_schema: None,
                            domain_base_type: None,
                            array_dimensions: None,
                            element_raw_type: None,
                        }
                    })
                    .collect()
            }
            DatabasePool::MongoDB { client, database } => {
                let db = client.database(database);
                let coll = db.collection::<BsonDocument>(table_name);
                let mut cursor = coll.find(doc! {}).limit(100).await?;
                let mut fields_map = std::collections::BTreeMap::new();
                while let Some(doc) = cursor.try_next().await? {
                    for (k, v) in doc.iter() {
                        let type_name = match v {
                            Bson::Double(_) => "double",
                            Bson::String(_) => "string",
                            Bson::Array(_) => "array",
                            Bson::Document(_) => "object",
                            Bson::Boolean(_) => "bool",
                            Bson::Null => "null",
                            Bson::Int32(_) => "int",
                            Bson::Int64(_) => "long",
                            Bson::ObjectId(_) => "objectId",
                            Bson::DateTime(_) => "date",
                            Bson::Binary(_) => "binData",
                            _ => "any",
                        };
                        fields_map.entry(k.clone()).or_insert_with(|| type_name.to_string());
                    }
                }
                let mut columns = Vec::new();
                for (name, data_type) in fields_map {
                    columns.push(TableColumn {
                        name: name.clone(),
                        data_type: data_type.clone(),
                        raw_type: Some(data_type.clone()),
                        normalized_type: data_type.clone(),
                        type_family: ColumnTypeFamily::Json,
                        db_type: DatabaseType::MongoDB,
                        is_nullable: true,
                        default_value: None,
                        is_primary_key: name == "_id",
                        is_boolean_like: data_type == "bool",
                        is_array: data_type == "array",
                        enum_values: None,
                        identity_kind: None,
                        generated_kind: None,
                        generation_expression: None,
                        column_comment: None,
                        collation_name: None,
                        domain_name: None,
                        domain_schema: None,
                        domain_base_type: None,
                        array_dimensions: None,
                        element_raw_type: None,
                    });
                }
                columns
            }
            DatabasePool::ClickHouse { client, url, database } => {
                let ch_query = format!(
                    "SELECT name, type, default_expression, is_in_primary_key FROM system.columns WHERE database = '{}' AND table = '{}' ORDER BY position FORMAT JSONCompact",
                    database.replace('\'', "''"),
                    table_name.replace('\'', "''")
                );
                let res = Self::clickhouse_http_query(client, url, database, &ch_query).await?;
                let mut columns = Vec::new();
                for row in res.rows {
                    if let Some(obj) = row.as_object() {
                        let name = obj.get("name").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                        let data_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("String").to_string();
                        let is_pk = obj.get("is_in_primary_key").and_then(|v| v.as_u64()).unwrap_or(0) == 1;
                        let default_val = obj.get("default_expression").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).map(|s| s.to_string());
                        let normalized_type = normalize_type_name(&data_type);
                        let type_family = classify_sqlite_type(&data_type);

                        columns.push(TableColumn {
                            name,
                            data_type: data_type.clone(),
                            raw_type: Some(data_type),
                            normalized_type,
                            type_family,
                            db_type: DatabaseType::ClickHouse,
                            is_nullable: true,
                            default_value: default_val,
                            is_primary_key: is_pk,
                            is_boolean_like: false,
                            is_array: false,
                            enum_values: None,
                            identity_kind: None,
                            generated_kind: None,
                            generation_expression: None,
                            column_comment: None,
                            collation_name: None,
                            domain_name: None,
                            domain_schema: None,
                            domain_base_type: None,
                            array_dimensions: None,
                            element_raw_type: None,
                        });
                    }
                }
                columns
            }
            DatabasePool::LibSQL { client, url, token } => {
                let ddl_query = format!("SELECT sql FROM sqlite_master WHERE type IN ('table', 'view') AND name = '{}'", table_name.replace('\'', "''"));
                let ddl_res = Self::libsql_http_pipeline(client, url, token, &ddl_query).await.ok();
                let create_sql = ddl_res
                    .and_then(|r| r.rows.into_iter().next())
                    .and_then(|row| row.as_object().and_then(|obj| obj.get("sql").and_then(|s| s.as_str()).map(|s| s.to_string())));
                let json_columns = create_sql
                    .as_deref()
                    .map(extract_sqlite_json_columns_from_ddl)
                    .unwrap_or_default();

                let res = Self::libsql_http_pipeline(client, url, token, &query).await?;
                let mut columns = Vec::new();
                for row in res.rows {
                    if let Some(obj) = row.as_object() {
                        let name = obj.get("name").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                        let data_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("TEXT").to_string();
                        let not_null = obj.get("notnull").and_then(|v| v.as_i64()).unwrap_or(0);
                        let default_value = obj.get("dflt_value").and_then(|v| v.as_str()).map(|s| s.to_string());
                        let is_pk = obj.get("pk").and_then(|v| v.as_i64()).unwrap_or(0) > 0;
                        let normalized_type = normalize_type_name(&data_type);
                        let mut type_family = classify_sqlite_type(&data_type);

                        let has_json_check = json_columns.contains(&name.to_lowercase());
                        if has_json_check && type_family != ColumnTypeFamily::Json {
                            type_family = ColumnTypeFamily::Json;
                        }

                        let generation_expression = if has_json_check {
                            Some(format!("CHECK(json_valid({}))", name))
                        } else {
                            None
                        };

                        columns.push(TableColumn {
                            name,
                            data_type: data_type.clone(),
                            raw_type: Some(data_type),
                            normalized_type,
                            type_family: type_family.clone(),
                            db_type: DatabaseType::LibSQL,
                            is_nullable: not_null == 0,
                            default_value,
                            is_primary_key: is_pk,
                            is_boolean_like: matches!(type_family, ColumnTypeFamily::Boolean),
                            is_array: false,
                            enum_values: None,
                            identity_kind: None,
                            generated_kind: None,
                            generation_expression,
                            column_comment: None,
                            collation_name: None,
                            domain_name: None,
                            domain_schema: None,
                            domain_base_type: None,
                            array_dimensions: None,
                            element_raw_type: None,
                        });
                    }
                }
                columns
            }
            DatabasePool::CloudflareD1 { client, account_id, database_id, api_token } => {
                let ddl_query = format!("SELECT sql FROM sqlite_master WHERE type IN ('table', 'view') AND name = '{}'", table_name.replace('\'', "''"));
                let ddl_res = Self::cloudflare_d1_query(client, account_id, database_id, api_token, &ddl_query).await.ok();
                let create_sql = ddl_res
                    .and_then(|r| r.rows.into_iter().next())
                    .and_then(|row| row.as_object().and_then(|obj| obj.get("sql").and_then(|s| s.as_str()).map(|s| s.to_string())));
                let json_columns = create_sql
                    .as_deref()
                    .map(extract_sqlite_json_columns_from_ddl)
                    .unwrap_or_default();

                let res = Self::cloudflare_d1_query(client, account_id, database_id, api_token, &query).await?;
                let mut columns = Vec::new();
                for row in res.rows {
                    if let Some(obj) = row.as_object() {
                        let name = obj.get("name").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                        let data_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("TEXT").to_string();
                        let not_null = obj.get("notnull").and_then(|v| v.as_i64()).unwrap_or(0);
                        let default_value = obj.get("dflt_value").and_then(|v| v.as_str()).map(|s| s.to_string());
                        let is_pk = obj.get("pk").and_then(|v| v.as_i64()).unwrap_or(0) > 0;
                        let normalized_type = normalize_type_name(&data_type);
                        let mut type_family = classify_sqlite_type(&data_type);

                        let has_json_check = json_columns.contains(&name.to_lowercase());
                        if has_json_check && type_family != ColumnTypeFamily::Json {
                            type_family = ColumnTypeFamily::Json;
                        }

                        let generation_expression = if has_json_check {
                            Some(format!("CHECK(json_valid({}))", name))
                        } else {
                            None
                        };

                        columns.push(TableColumn {
                            name,
                            data_type: data_type.clone(),
                            raw_type: Some(data_type),
                            normalized_type,
                            type_family: type_family.clone(),
                            db_type: DatabaseType::SQLite,
                            is_nullable: not_null == 0,
                            default_value,
                            is_primary_key: is_pk,
                            is_boolean_like: matches!(type_family, ColumnTypeFamily::Boolean),
                            is_array: false,
                            enum_values: None,
                            identity_kind: None,
                            generated_kind: None,
                            generation_expression,
                            column_comment: None,
                            collation_name: None,
                            domain_name: None,
                            domain_schema: None,
                            domain_base_type: None,
                            array_dimensions: None,
                            element_raw_type: None,
                        });
                    }
                }
                columns
            }
            DatabasePool::Redis { client, db } => {
                let res = Self::redis_execute_cmd(client, *db, &format!("GET {}", table_name)).await;
                let k_type = if let Ok(ref r) = res {
                    r.rows.first()
                        .and_then(|row| row.get("type"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("string")
                        .to_string()
                } else {
                    "string".to_string()
                };

                vec![
                    TableColumn {
                        name: "key".to_string(),
                        data_type: "STRING".to_string(),
                        raw_type: Some("STRING".to_string()),
                        normalized_type: "STRING".to_string(),
                        type_family: ColumnTypeFamily::Text,
                        db_type: DatabaseType::Redis,
                        is_nullable: false,
                        default_value: None,
                        is_primary_key: true,
                        is_boolean_like: false,
                        is_array: false,
                        enum_values: None,
                        identity_kind: None,
                        generated_kind: None,
                        generation_expression: None,
                        column_comment: None,
                        collation_name: None,
                        domain_name: None,
                        domain_schema: None,
                        domain_base_type: None,
                        array_dimensions: None,
                        element_raw_type: None,
                    },
                    TableColumn {
                        name: "type".to_string(),
                        data_type: "STRING".to_string(),
                        raw_type: Some("STRING".to_string()),
                        normalized_type: "STRING".to_string(),
                        type_family: ColumnTypeFamily::Text,
                        db_type: DatabaseType::Redis,
                        is_nullable: false,
                        default_value: Some(k_type),
                        is_primary_key: false,
                        is_boolean_like: false,
                        is_array: false,
                        enum_values: None,
                        identity_kind: None,
                        generated_kind: None,
                        generation_expression: None,
                        column_comment: None,
                        collation_name: None,
                        domain_name: None,
                        domain_schema: None,
                        domain_base_type: None,
                        array_dimensions: None,
                        element_raw_type: None,
                    },
                    TableColumn {
                        name: "value".to_string(),
                        data_type: "TEXT".to_string(),
                        raw_type: Some("TEXT".to_string()),
                        normalized_type: "TEXT".to_string(),
                        type_family: ColumnTypeFamily::Text,
                        db_type: DatabaseType::Redis,
                        is_nullable: true,
                        default_value: None,
                        is_primary_key: false,
                        is_boolean_like: false,
                        is_array: false,
                        enum_values: None,
                        identity_kind: None,
                        generated_kind: None,
                        generation_expression: None,
                        column_comment: None,
                        collation_name: None,
                        domain_name: None,
                        domain_schema: None,
                        domain_base_type: None,
                        array_dimensions: None,
                        element_raw_type: None,
                    },
                    TableColumn {
                        name: "ttl".to_string(),
                        data_type: "INTEGER".to_string(),
                        raw_type: Some("INTEGER".to_string()),
                        normalized_type: "INTEGER".to_string(),
                        type_family: ColumnTypeFamily::Integer,
                        db_type: DatabaseType::Redis,
                        is_nullable: false,
                        default_value: None,
                        is_primary_key: false,
                        is_boolean_like: false,
                        is_array: false,
                        enum_values: None,
                        identity_kind: None,
                        generated_kind: None,
                        generation_expression: None,
                        column_comment: None,
                        collation_name: None,
                        domain_name: None,
                        domain_schema: None,
                        domain_base_type: None,
                        array_dimensions: None,
                        element_raw_type: None,
                    },
                ]
            }
        };

        Ok(columns)
    }

    pub async fn execute_query(
        &self,
        connection_id: &str,
        query: &str,
    ) -> Result<QueryResult> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        match pool {
            DatabasePool::Sqlite(pool) => {
                let rows = sqlx::query(query)
                    .fetch_all(pool)
                    .await
                    .map_err(Self::format_sqlx_error)?;
                Ok(process_rows!(rows, common))
            }
            DatabasePool::Postgres(pool) => {
                let rows = sqlx::query(query)
                    .fetch_all(pool)
                    .await
                    .map_err(Self::format_sqlx_error)?;
                Ok(process_rows!(rows, postgres))
            }
            DatabasePool::MySql(pool) => {
                let rows = sqlx::query(query)
                    .fetch_all(pool)
                    .await
                    .map_err(Self::format_sqlx_error)?;
                Ok(process_rows!(rows, common))
            }
            DatabasePool::MongoDB { client, database } => {
                Self::mongo_execute_shell(client, database, query).await
            }
            DatabasePool::ClickHouse { client, url, database } => {
                let trimmed = query.trim();
                if trimmed.to_uppercase().starts_with("SELECT")
                    || trimmed.to_uppercase().starts_with("SHOW")
                    || trimmed.to_uppercase().starts_with("DESCRIBE")
                    || trimmed.to_uppercase().starts_with("EXISTS") {
                    Self::clickhouse_http_query(client, url, database, trimmed).await
                } else {
                    let count = Self::clickhouse_http_execute(client, url, database, trimmed).await?;
                    Ok(QueryResult {
                        columns: vec![],
                        rows: vec![],
                        rows_affected: count,
                    })
                }
            }
            DatabasePool::LibSQL { client, url, token } => {
                Self::libsql_http_pipeline(client, url, token, query).await
            }
            DatabasePool::CloudflareD1 { client, account_id, database_id, api_token } => {
                Self::cloudflare_d1_query(client, account_id, database_id, api_token, query).await
            }
            DatabasePool::Redis { client, db } => {
                Self::redis_execute_cmd(client, *db, query).await
            }
        }
    }

    pub async fn explain_query(
        &self,
        connection_id: &str,
        query: &str,
        analyze: bool,
        db_type: &DatabaseType,
    ) -> Result<ExecutionPlan> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        let start_time = std::time::Instant::now();
        
        let (plan_steps, total_cost) = match (pool, db_type) {
            (DatabasePool::Postgres(pool), DatabaseType::PostgreSQL) => {
                let explain_query = if analyze {
                    format!("EXPLAIN (FORMAT JSON, ANALYZE true, BUFFERS true) {}", query)
                } else {
                    format!("EXPLAIN (FORMAT JSON) {}", query)
                };
                
                let rows = sqlx::query(&explain_query).fetch_all(pool).await?;
                
                if rows.is_empty() {
                    return Err(anyhow!("No execution plan returned"));
                }
                
                let plan_json: String = rows[0].try_get(0)?;
                let parsed: serde_json::Value = serde_json::from_str(&plan_json)?;
                
                let plan_array = parsed.as_array()
                    .ok_or_else(|| anyhow!("Invalid plan format"))?;
                
                if let Some(first_plan) = plan_array.first() {
                    let plan_obj = first_plan.get("Plan")
                        .ok_or_else(|| anyhow!("No Plan field found"))?;
                    
                    let total_cost = plan_obj.get("Total Cost")
                        .and_then(|v| v.as_f64());
                    
                    let steps = self.parse_postgres_plan(plan_obj)?;
                    (steps, total_cost)
                } else {
                    (vec![], None)
                }
            }
            (DatabasePool::MySql(pool), DatabaseType::MySQL) => {
                let explain_query = format!("EXPLAIN FORMAT=JSON {}", query);
                let rows = sqlx::query(&explain_query).fetch_all(pool).await?;
                
                if rows.is_empty() {
                    return Err(anyhow!("No execution plan returned"));
                }
                
                let plan_json: String = rows[0].try_get(0)?;
                let parsed: serde_json::Value = serde_json::from_str(&plan_json)?;
                
                let steps = self.parse_mysql_plan(&parsed)?;
                (steps, None)
            }
            (DatabasePool::Sqlite(pool), DatabaseType::SQLite) => {
                let explain_query = format!("EXPLAIN QUERY PLAN {}", query);
                let rows = sqlx::query(&explain_query).fetch_all(pool).await?;
                
                let mut steps = Vec::new();
                for row in rows {
                    let _detail: String = row.try_get(3).unwrap_or_default();
                    steps.push(PlanStep {
                        step_type: "SQLite Plan".to_string(),
                        table_name: None,
                        rows: None,
                        cost: None,
                        filter_condition: None,
                        index_used: None,
                        children: vec![],
                    });
                }
                
                (steps, None)
            }
            (DatabasePool::LibSQL { client, url, token }, DatabaseType::LibSQL) => {
                let explain_query = format!("EXPLAIN QUERY PLAN {}", query);
                let res = Self::libsql_http_pipeline(client, url, token, &explain_query).await?;

                let mut steps = Vec::new();
                for row in res.rows {
                    if let Some(obj) = row.as_object() {
                        let detail = obj.get("detail").and_then(|v| v.as_str()).unwrap_or("Query Step");
                        steps.push(PlanStep {
                            step_type: detail.to_string(),
                            table_name: None,
                            rows: None,
                            cost: None,
                            filter_condition: None,
                            index_used: None,
                            children: vec![],
                        });
                    }
                }

                (steps, None)
            }
            (DatabasePool::CloudflareD1 { client, account_id, database_id, api_token }, _) => {
                let explain_query = format!("EXPLAIN QUERY PLAN {}", query);
                let res = Self::cloudflare_d1_query(client, account_id, database_id, api_token, &explain_query).await?;

                let mut steps = Vec::new();
                for row in res.rows {
                    if let Some(obj) = row.as_object() {
                        let detail = obj.get("detail").and_then(|v| v.as_str()).unwrap_or("Query Step");
                        steps.push(PlanStep {
                            step_type: detail.to_string(),
                            table_name: None,
                            rows: None,
                            cost: None,
                            filter_condition: None,
                            index_used: None,
                            children: vec![],
                        });
                    }
                }

                (steps, None)
            }
            (DatabasePool::Redis { .. }, _) => (vec![], None),
            _ => return Err(anyhow!("Database type mismatch")),
        };

        let execution_time = if analyze {
            Some(start_time.elapsed().as_millis() as f64)
        } else {
            None
        };

        let recommendations = self.generate_recommendations(&plan_steps);

        Ok(ExecutionPlan {
            query: query.to_string(),
            plan_steps,
            total_cost,
            execution_time_ms: execution_time,
            recommendations,
        })
    }

    fn parse_postgres_plan(&self, plan: &serde_json::Value) -> Result<Vec<PlanStep>> {
        let mut steps = Vec::new();
        
        let step_type = plan.get("Node Type")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown")
            .to_string();
        
        let table_name = plan.get("Relation Name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let rows = plan.get("Plan Rows")
            .and_then(|v| v.as_i64());
        
        let cost = plan.get("Total Cost")
            .and_then(|v| v.as_f64());
        
        let filter_condition = plan.get("Filter")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let index_used = plan.get("Index Name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let mut children = Vec::new();
        if let Some(plans) = plan.get("Plans").and_then(|v| v.as_array()) {
            for child_plan in plans {
                children.extend(self.parse_postgres_plan(child_plan)?);
            }
        }
        
        steps.push(PlanStep {
            step_type,
            table_name,
            rows,
            cost,
            filter_condition,
            index_used,
            children,
        });
        
        Ok(steps)
    }

    fn parse_mysql_plan(&self, plan: &serde_json::Value) -> Result<Vec<PlanStep>> {
        let mut steps = Vec::new();
        
        if let Some(query_block) = plan.get("query_block") {
            if let Some(table) = query_block.get("table") {
                let step_type = table.get("access_type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown")
                    .to_string();
                
                let table_name = table.get("table_name")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                
                let rows = table.get("rows_examined_per_scan")
                    .and_then(|v| v.as_i64());
                
                let index_used = table.get("key")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                
                steps.push(PlanStep {
                    step_type,
                    table_name,
                    rows,
                    cost: None,
                    filter_condition: None,
                    index_used,
                    children: vec![],
                });
            }
        }
        
        Ok(steps)
    }

    fn generate_recommendations(&self, plan_steps: &[PlanStep]) -> Vec<String> {
        let mut recommendations = Vec::new();
        
        for step in plan_steps {
            // Check for sequential scans
            if step.step_type.contains("Seq Scan") || step.step_type.contains("ALL") {
                if let Some(table) = &step.table_name {
                    recommendations.push(format!(
                        "Consider adding an index to table '{}' to avoid sequential scan",
                        table
                    ));
                }
            }
            
            // Check for high row counts
            if let Some(rows) = step.rows {
                if rows > 10000 {
                    recommendations.push(format!(
                        "High row count ({}) detected. Consider adding WHERE clause to filter data",
                        rows
                    ));
                }
            }
            
            // Check for high cost operations
            if let Some(cost) = step.cost {
                if cost > 1000.0 {
                    recommendations.push(format!(
                        "High cost operation detected (cost: {:.2}). Review query optimization",
                        cost
                    ));
                }
            }
            
            // Check children recursively
            for rec in self.generate_recommendations(&step.children) {
                if !recommendations.contains(&rec) {
                    recommendations.push(rec);
                }
            }
        }
        
        if recommendations.is_empty() {
            recommendations.push("Query appears to be well optimized".to_string());
        }
        
        recommendations
    }

    pub async fn insert_row(
        &self,
        connection_id: &str,
        table_name: &str,
        data: serde_json::Value,
        _db_type: &DatabaseType,
    ) -> Result<String> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        if let DatabasePool::MongoDB { client, database } = pool {
            let db = client.database(database);
            let coll = db.collection::<BsonDocument>(table_name);
            let doc: BsonDocument = bson::to_document(&data)?;
            coll.insert_one(doc).await?;
            return Ok(format!("Successfully inserted 1 document into {}", table_name));
        }

        if let DatabasePool::ClickHouse { client, url, database } = pool {
            let json_body = serde_json::to_string(&data)?;
            let query_url = format!("{}/?database={}&query=INSERT%20INTO%20{}%20FORMAT%20JSONEachRow", url, urlencoding::encode(database), urlencoding::encode(table_name));
            let resp = client.post(&query_url).body(json_body).send().await?;
            if !resp.status().is_success() {
                let err_text = resp.text().await.unwrap_or_else(|_| "ClickHouse insert error".to_string());
                return Err(anyhow!("ClickHouse Error: {}", err_text));
            }
            return Ok(format!("Successfully inserted 1 row into {}", table_name));
        }

        let obj = data.as_object()
            .ok_or_else(|| anyhow!("Data must be a JSON object"))?;

        let columns: Vec<&String> = obj.keys().collect();
        let values: Vec<String> = obj.values()
            .map(|v| {
                if v.is_null() {
                    "NULL".to_string()
                } else if v.is_string() {
                    format!("'{}'", v.as_str().unwrap().replace("'", "''"))
                } else {
                    v.to_string()
                }
            })
            .collect();

        let column_list = columns.iter().map(|c| c.as_str()).collect::<Vec<_>>().join(", ");
        let value_list = values.join(", ");

        let query = format!(
            "INSERT INTO {} ({}) VALUES ({})",
            if matches!(pool, DatabasePool::Postgres(_)) {
                Self::quote_pg_table(table_name)
            } else {
                table_name.to_string()
            },
            column_list,
            value_list
        );

        execute_query!(pool, &query)?;

        Ok(format!("Successfully inserted 1 row into {}", table_name))
    }

    pub async fn bulk_insert_rows(
        &self,
        connection_id: &str,
        table_name: &str,
        rows: Vec<serde_json::Value>,
        _db_type: &DatabaseType,
    ) -> Result<String> {
        if rows.is_empty() {
            return Ok("No rows to insert".to_string());
        }

        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        if let DatabasePool::MongoDB { client, database } = pool {
            let db = client.database(database);
            let coll = db.collection::<BsonDocument>(table_name);
            let mut docs = Vec::new();
            for r in &rows {
                docs.push(bson::to_document(r)?);
            }
            coll.insert_many(docs).await?;
            return Ok(format!("Successfully inserted {} documents into {}", rows.len(), table_name));
        }

        if let DatabasePool::ClickHouse { client, url, database } = pool {
            let json_body = serde_json::to_string(&rows)?;
            let query_url = format!("{}/?database={}&query=INSERT%20INTO%20{}%20FORMAT%20JSONEachRow", url, urlencoding::encode(database), urlencoding::encode(table_name));
            let resp = client.post(&query_url).body(json_body).send().await?;
            if !resp.status().is_success() {
                let err_text = resp.text().await.unwrap_or_else(|_| "ClickHouse insert error".to_string());
                return Err(anyhow!("ClickHouse Error: {}", err_text));
            }
            return Ok(format!("Successfully inserted {} rows into {}", rows.len(), table_name));
        }

        // Get columns from first row
        let first_obj = rows[0].as_object()
            .ok_or_else(|| anyhow!("Row data must be a JSON object"))?;
        let columns: Vec<&String> = first_obj.keys().collect();
        let column_list = columns.iter().map(|c| c.as_str()).collect::<Vec<_>>().join(", ");

        // Build value lists for all rows
        let mut value_lists: Vec<String> = Vec::new();
        
        for row in &rows {
            let obj = row.as_object()
                .ok_or_else(|| anyhow!("Row data must be a JSON object"))?;
            
            let values: Vec<String> = columns.iter()
                .map(|col| {
                    let v = obj.get(*col).unwrap_or(&serde_json::Value::Null);
                    if v.is_null() {
                        "NULL".to_string()
                    } else if v.is_string() {
                        format!("'{}'", v.as_str().unwrap().replace("'", "''"))
                    } else {
                        v.to_string()
                    }
                })
                .collect();
            
            value_lists.push(format!("({})", values.join(", ")));
        }

        // Insert all rows in a single query for better performance
        let query = format!(
            "INSERT INTO {} ({}) VALUES {}",
            if matches!(pool, DatabasePool::Postgres(_)) {
                Self::quote_pg_table(table_name)
            } else {
                table_name.to_string()
            },
            column_list,
            value_lists.join(", ")
        );

        execute_query!(pool, &query)?;

        Ok(format!("Successfully inserted {} rows into {}", rows.len(), table_name))
    }

    pub async fn update_row(
        &self,
        connection_id: &str,
        table_name: &str,
        data: serde_json::Value,
        where_clause: &str,
        _db_type: &DatabaseType,
    ) -> Result<String> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        if let DatabasePool::MongoDB { client, database } = pool {
            let db = client.database(database);
            let coll = db.collection::<BsonDocument>(table_name);
            let filter: BsonDocument = if where_clause.trim().starts_with('{') {
                let json_val: serde_json::Value = serde_json::from_str(where_clause)?;
                bson::to_document(&json_val)?
            } else {
                doc! {}
            };
            let update_doc: BsonDocument = bson::to_document(&data)?;
            let res = coll.update_many(filter, doc! { "$set": update_doc }).await?;
            return Ok(format!("Successfully updated {} document(s)", res.modified_count));
        }

        if let DatabasePool::ClickHouse { client, url, database } = pool {
            let obj = data.as_object().ok_or_else(|| anyhow!("Data must be a JSON object"))?;
            let set_clauses: Vec<String> = obj.iter().map(|(k, v)| {
                if v.is_string() {
                    format!("{} = '{}'", k, v.as_str().unwrap().replace('\'', "''"))
                } else {
                    format!("{} = {}", k, v)
                }
            }).collect();
            let sql = format!("ALTER TABLE {} UPDATE {} WHERE {}", table_name, set_clauses.join(", "), where_clause);
            Self::clickhouse_http_execute(client, url, database, &sql).await?;
            return Ok("Update requested via ALTER TABLE UPDATE".to_string());
        }

        let obj = data.as_object()
            .ok_or_else(|| anyhow!("Data must be a JSON object"))?;

        let set_clauses: Vec<String> = obj.iter()
            .map(|(k, v)| {
                if v.as_str() == Some("__NODADB_USE_DEFAULT__") {
                    format!("{} = DEFAULT", k)
                } else if v.as_str() == Some("__NODADB_EMPTY_STRING__") {
                    format!("{} = ''", k)
                } else if v.is_null() {
                    format!("{} = NULL", k)
                } else if v.is_string() {
                    format!("{} = '{}'", k, v.as_str().unwrap().replace("'", "''"))
                } else {
                    format!("{} = {}", k, v)
                }
            })
            .collect();

        let set_clause = set_clauses.join(", ");

        let query = format!(
            "UPDATE {} SET {} WHERE {}",
            if matches!(pool, DatabasePool::Postgres(_)) {
                Self::quote_pg_table(table_name)
            } else {
                table_name.to_string()
            },
            set_clause,
            where_clause
        );

        let rows_affected = execute_query!(pool, &query)?;

        Ok(format!("Successfully updated {} row(s)", rows_affected))
    }

    pub async fn delete_rows(
        &self,
        connection_id: &str,
        table_name: &str,
        where_clause: &str,
    ) -> Result<String> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        if let DatabasePool::MongoDB { client, database } = pool {
            let db = client.database(database);
            let coll = db.collection::<BsonDocument>(table_name);
            let filter: BsonDocument = if where_clause.trim().starts_with('{') {
                let json_val: serde_json::Value = serde_json::from_str(where_clause)?;
                bson::to_document(&json_val)?
            } else {
                doc! {}
            };
            let res = coll.delete_many(filter).await?;
            return Ok(format!("Successfully deleted {} document(s)", res.deleted_count));
        }

        if let DatabasePool::ClickHouse { client, url, database } = pool {
            let sql = format!("ALTER TABLE {} DELETE WHERE {}", table_name, where_clause);
            Self::clickhouse_http_execute(client, url, database, &sql).await?;
            return Ok("Deletion requested via ALTER TABLE DELETE".to_string());
        }

        let query = format!(
            "DELETE FROM {} WHERE {}",
            if matches!(pool, DatabasePool::Postgres(_)) {
                Self::quote_pg_table(table_name)
            } else {
                table_name.to_string()
            },
            where_clause
        );

        let rows_affected = execute_query!(pool, &query)?;

        Ok(format!("Successfully deleted {} row(s)", rows_affected))
    }

    pub async fn create_table(
        &self,
        connection_id: &str,
        table_name: &str,
        columns: Vec<(String, String, bool, bool)>, // (name, type, nullable, primary_key)
        _db_type: &DatabaseType,
    ) -> Result<String> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        if let DatabasePool::MongoDB { client, database } = pool {
            let db = client.database(database);
            db.create_collection(table_name).await?;
            return Ok(format!("Successfully created collection {}", table_name));
        }

        if let DatabasePool::ClickHouse { client, url, database } = pool {
            let mut col_defs = Vec::new();
            let mut pks = Vec::new();
            for (name, data_type, _nullable, is_pk) in columns {
                col_defs.push(format!("{} {}", name, data_type));
                if is_pk {
                    pks.push(name);
                }
            }
            let order_by = if pks.is_empty() { "tuple()".to_string() } else { format!("({})", pks.join(", ")) };
            let sql = format!("CREATE TABLE {} ({}) ENGINE = MergeTree() ORDER BY {}", table_name, col_defs.join(", "), order_by);
            Self::clickhouse_http_execute(client, url, database, &sql).await?;
            return Ok(format!("Successfully created ClickHouse table {}", table_name));
        }

        let mut column_defs: Vec<String> = Vec::new();
        let mut primary_keys: Vec<String> = Vec::new();
        let is_sqlite_like = matches!(
            pool,
            DatabasePool::Sqlite(_) | DatabasePool::LibSQL { .. } | DatabasePool::CloudflareD1 { .. }
        );

        for (name, data_type, nullable, is_pk) in columns {
            let upper_type = data_type.trim().to_uppercase();
            let mut col_def = if is_sqlite_like && (upper_type == "JSON" || upper_type == "JSONB") {
                format!("{} JSON CHECK (json_valid({}))", name, name)
            } else {
                format!("{} {}", name, data_type)
            };
            
            if !nullable {
                col_def.push_str(" NOT NULL");
            }
            
            if is_pk {
                primary_keys.push(name.clone());
            }
            
            column_defs.push(col_def);
        }

        if !primary_keys.is_empty() {
            column_defs.push(format!("PRIMARY KEY ({})", primary_keys.join(", ")));
        }

        let query = format!(
            "CREATE TABLE {} ({})",
            if matches!(pool, DatabasePool::Postgres(_)) {
                Self::quote_pg_table(table_name)
            } else {
                table_name.to_string()
            },
            column_defs.join(", ")
        );

        execute_query!(pool, &query)?;

        Ok(format!("Successfully created table {}", table_name))
    }

    pub async fn drop_table(
        &self,
        connection_id: &str,
        table_name: &str,
    ) -> Result<String> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        if let DatabasePool::MongoDB { client, database } = pool {
            let db = client.database(database);
            db.collection::<BsonDocument>(table_name).drop().await?;
            return Ok(format!("Successfully dropped collection {}", table_name));
        }

        if let DatabasePool::ClickHouse { client, url, database } = pool {
            let sql = format!("DROP TABLE {}", table_name);
            Self::clickhouse_http_execute(client, url, database, &sql).await?;
            return Ok(format!("Successfully dropped table {}", table_name));
        }

        let query = format!(
            "DROP TABLE {}",
            if matches!(pool, DatabasePool::Postgres(_)) {
                Self::quote_pg_table(table_name)
            } else {
                table_name.to_string()
            }
        );

        execute_query!(pool, &query)?;

        Ok(format!("Successfully dropped table {}", table_name))
    }

    pub async fn alter_table_add_column(
        &self,
        connection_id: &str,
        table_name: &str,
        column_name: &str,
        data_type: &str,
        nullable: bool,
        db_type: &DatabaseType,
    ) -> Result<String> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        if matches!(pool, DatabasePool::MongoDB { .. }) {
            return Err(anyhow!("MongoDB is schemaless. Column operations are not applicable."));
        }

        let nullable_clause = if nullable { "" } else { " NOT NULL" };
        
        let query = match db_type {
            DatabaseType::SQLite | DatabaseType::LibSQL => {
                format!("ALTER TABLE {} ADD COLUMN {} {}", table_name, column_name, data_type)
            }
            DatabaseType::PostgreSQL | DatabaseType::MySQL | DatabaseType::ClickHouse => {
                let target_table = if matches!(pool, DatabasePool::Postgres(_)) {
                    Self::quote_pg_table(table_name)
                } else {
                    table_name.to_string()
                };
                let target_column = if matches!(pool, DatabasePool::Postgres(_)) {
                    Self::quote_pg_ident(column_name)
                } else {
                    column_name.to_string()
                };
                format!("ALTER TABLE {} ADD COLUMN {} {}{}", 
                    target_table, target_column, data_type, nullable_clause)
            }
            DatabaseType::MongoDB | DatabaseType::Redis => String::new(),
        };

        execute_query!(pool, &query)?;

        Ok(format!("Successfully added column {} to {}", column_name, table_name))
    }

    pub async fn alter_table_drop_column(
        &self,
        connection_id: &str,
        table_name: &str,
        column_name: &str,
        db_type: &DatabaseType,
    ) -> Result<String> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        if matches!(pool, DatabasePool::MongoDB { .. } | DatabasePool::Redis { .. }) {
            return Err(anyhow!("Schema column operations are not applicable."));
        }

        let query = match db_type {
            DatabaseType::SQLite | DatabaseType::LibSQL => {
                return Err(anyhow!("SQLite/LibSQL does not support dropping columns directly. Please recreate the table."));
            }
            DatabaseType::PostgreSQL | DatabaseType::MySQL | DatabaseType::ClickHouse => {
                let target_table = if matches!(pool, DatabasePool::Postgres(_)) {
                    Self::quote_pg_table(table_name)
                } else {
                    table_name.to_string()
                };
                let target_column = if matches!(pool, DatabasePool::Postgres(_)) {
                    Self::quote_pg_ident(column_name)
                } else {
                    column_name.to_string()
                };
                format!("ALTER TABLE {} DROP COLUMN {}", target_table, target_column)
            }
            DatabaseType::MongoDB | DatabaseType::Redis => String::new(),
        };

        execute_query!(pool, &query)?;

        Ok(format!("Successfully dropped column {} from {}", column_name, table_name))
    }

    pub async fn rename_table(
        &self,
        connection_id: &str,
        old_name: &str,
        new_name: &str,
        db_type: &DatabaseType,
    ) -> Result<String> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        if let DatabasePool::MongoDB { client, database } = pool {
            let admin_db = client.database("admin");
            admin_db.run_command(doc! {
                "renameCollection": format!("{}.{}", database, old_name),
                "to": format!("{}.{}", database, new_name),
            }).await?;
            return Ok(format!("Successfully renamed collection {} to {}", old_name, new_name));
        }

        if let DatabasePool::Redis { client, db } = pool {
            let sql = format!("RENAME {} {}", old_name, new_name);
            Self::redis_execute_cmd(client, *db, &sql).await?;
            return Ok(format!("Successfully renamed key {} to {}", old_name, new_name));
        }

        if let DatabasePool::ClickHouse { client, url, database } = pool {
            let sql = format!("RENAME TABLE {} TO {}", old_name, new_name);
            Self::clickhouse_http_execute(client, url, database, &sql).await?;
            return Ok(format!("Successfully renamed table {} to {}", old_name, new_name));
        }

        let query = match db_type {
            DatabaseType::SQLite | DatabaseType::LibSQL => format!("ALTER TABLE {} RENAME TO {}", old_name, new_name),
            DatabaseType::MySQL | DatabaseType::ClickHouse => format!("RENAME TABLE {} TO {}", old_name, new_name),
            DatabaseType::PostgreSQL => {
                let quoted_old = Self::quote_pg_table(old_name);
                let quoted_new = Self::quote_pg_ident(new_name);
                format!("ALTER TABLE {} RENAME TO {}", quoted_old, quoted_new)
            }
            DatabaseType::MongoDB | DatabaseType::Redis => String::new(),
        };

        execute_query!(pool, &query)?;

        Ok(format!("Successfully renamed table {} to {}", old_name, new_name))
    }

    pub async fn execute_transaction(
        &self,
        connection_id: &str,
        queries: &[String],
    ) -> Result<u64> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        let mut total_rows_affected = 0_u64;

        match pool {
            DatabasePool::Sqlite(pool) => {
                let mut tx = pool.begin().await?;
                for query in queries {
                    total_rows_affected += sqlx::query(query)
                        .execute(&mut *tx)
                        .await
                        .map_err(Self::format_sqlx_error)?
                        .rows_affected();
                }
                tx.commit().await?;
            }
            DatabasePool::Postgres(pool) => {
                let mut tx = pool.begin().await?;
                for query in queries {
                    total_rows_affected += sqlx::query(query)
                        .execute(&mut *tx)
                        .await
                        .map_err(Self::format_sqlx_error)?
                        .rows_affected();
                }
                tx.commit().await?;
            }
            DatabasePool::MySql(pool) => {
                let mut tx = pool.begin().await?;
                for query in queries {
                    total_rows_affected += sqlx::query(query)
                        .execute(&mut *tx)
                        .await
                        .map_err(Self::format_sqlx_error)?
                        .rows_affected();
                }
                tx.commit().await?;
            }
            DatabasePool::MongoDB { .. } => {
                return Err(anyhow!("Transactions are not supported for MongoDB in this tool"));
            }
            DatabasePool::ClickHouse { client, url, database } => {
                for query in queries {
                    Self::clickhouse_http_execute(client, url, database, query).await?;
                    total_rows_affected += 1;
                }
            }
            DatabasePool::LibSQL { client, url, token } => {
                for query in queries {
                    let res = Self::libsql_http_pipeline(client, url, token, query).await?;
                    total_rows_affected += res.rows_affected;
                }
            }
            DatabasePool::CloudflareD1 { client, account_id, database_id, api_token } => {
                for query in queries {
                    let res = Self::cloudflare_d1_query(client, account_id, database_id, api_token, query).await?;
                    total_rows_affected += res.rows_affected;
                }
            }
            DatabasePool::Redis { client, db } => {
                for query in queries {
                    let res = Self::redis_execute_cmd(client, *db, query).await?;
                    total_rows_affected += res.rows_affected;
                }
            }
        }

        Ok(total_rows_affected)
    }

    pub async fn get_table_constraints(
        &self,
        connection_id: &str,
        table_name: &str,
        _db_type: &DatabaseType,
    ) -> Result<Vec<TableConstraint>> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        let constraints = match pool {
            DatabasePool::Sqlite(pool) => {
                let table_quoted = table_name.replace('"', "\"\"");
                let rows = sqlx::query(&format!("PRAGMA foreign_key_list(\"{}\")", table_quoted))
                    .fetch_all(pool)
                    .await?;

                let mut grouped: BTreeMap<i64, Vec<sqlx::sqlite::SqliteRow>> = BTreeMap::new();
                for row in rows {
                    let id: i64 = row.try_get(0).unwrap_or_default();
                    grouped.entry(id).or_default().push(row);
                }

                let mut all_constraints: Vec<TableConstraint> = grouped
                    .into_iter()
                    .map(|(id, rows)| {
                        let first = &rows[0];
                        let foreign_table_name: String = first.try_get(2).unwrap_or_default();
                        let on_update: String = first.try_get(5).unwrap_or_default();
                        let on_delete: String = first.try_get(6).unwrap_or_default();
                        let column_names = rows
                            .iter()
                            .map(|row| row.try_get(3).unwrap_or_default())
                            .collect::<Vec<String>>();
                        let foreign_column_names = rows
                            .iter()
                            .map(|row| row.try_get(4).unwrap_or_default())
                            .collect::<Vec<String>>();

                        TableConstraint {
                            constraint_name: format!("fk_{}_{}", table_name, id),
                            constraint_type: "FOREIGN KEY".to_string(),
                            table_schema: None,
                            table_name: table_name.to_string(),
                            column_names,
                            foreign_table_schema: None,
                            foreign_table_name: Some(foreign_table_name),
                            foreign_column_names: Some(foreign_column_names),
                            check_expression: Some(format!(
                                "ON UPDATE {} ON DELETE {}",
                                on_update.to_uppercase(),
                                on_delete.to_uppercase()
                            )),
                            is_deferrable: None,
                            initially_deferred: None,
                        }
                    })
                    .collect();

                let create_sql: Option<String> = sqlx::query_scalar(
                    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?"
                )
                .bind(table_name)
                .fetch_optional(pool)
                .await
                .ok()
                .flatten();

                if let Some(ddl) = create_sql {
                    all_constraints.extend(extract_sqlite_check_constraints(table_name, &ddl));
                }

                all_constraints
            }
            DatabasePool::Postgres(pool) => {
                let query = r#"
                    SELECT
                      c.conname,
                      c.contype,
                      ns.nspname,
                      cl.relname,
                      COALESCE(array_agg(att.attname ORDER BY u.ordinality) FILTER (WHERE att.attname IS NOT NULL), ARRAY[]::text[]) AS column_names,
                      fns.nspname AS foreign_schema,
                      fcl.relname AS foreign_table,
                      COALESCE(array_agg(fatt.attname ORDER BY fu.ordinality) FILTER (WHERE fatt.attname IS NOT NULL), NULL) AS foreign_column_names,
                      CASE
                        WHEN c.contype IN ('c', 'f') THEN pg_get_constraintdef(c.oid, true)
                        ELSE NULL
                      END AS check_expr,
                      c.condeferrable,
                      c.condeferred
                    FROM pg_constraint c
                    JOIN pg_class cl ON cl.oid = c.conrelid
                    JOIN pg_namespace ns ON ns.oid = cl.relnamespace
                    LEFT JOIN pg_class fcl ON fcl.oid = c.confrelid
                    LEFT JOIN pg_namespace fns ON fns.oid = fcl.relnamespace
                    LEFT JOIN LATERAL unnest(c.conkey) WITH ORDINALITY u(attnum, ordinality) ON true
                    LEFT JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = u.attnum
                    LEFT JOIN LATERAL unnest(c.confkey) WITH ORDINALITY fu(attnum, ordinality) ON true
                    LEFT JOIN pg_attribute fatt ON fatt.attrelid = c.confrelid AND fatt.attnum = fu.attnum
                    WHERE c.conrelid = to_regclass($1)
                    GROUP BY c.oid, ns.nspname, cl.relname, fns.nspname, fcl.relname
                    ORDER BY c.conname
                "#;

                let rows = sqlx::query(query).bind(table_name).fetch_all(pool).await?;
                rows.into_iter()
                    .map(|row| {
                        let constraint_type_code: String = row.try_get(1).unwrap_or_default();
                        let constraint_type = match constraint_type_code.as_str() {
                            "p" => "PRIMARY KEY",
                            "f" => "FOREIGN KEY",
                            "u" => "UNIQUE",
                            "c" => "CHECK",
                            "x" => "EXCLUSION",
                            _ => "OTHER",
                        };
                        TableConstraint {
                            constraint_name: row.try_get(0).unwrap_or_default(),
                            constraint_type: constraint_type.to_string(),
                            table_schema: row.try_get(2).ok(),
                            table_name: row.try_get(3).unwrap_or_default(),
                            column_names: row.try_get(4).unwrap_or_default(),
                            foreign_table_schema: row.try_get(5).ok(),
                            foreign_table_name: row.try_get(6).ok(),
                            foreign_column_names: row.try_get(7).ok(),
                            check_expression: row.try_get(8).ok(),
                            is_deferrable: row.try_get(9).ok(),
                            initially_deferred: row.try_get(10).ok(),
                        }
                    })
                    .collect()
            }
            DatabasePool::MySql(pool) => {
                let query = r#"
                    SELECT
                      kcu.CONSTRAINT_NAME,
                      kcu.TABLE_NAME,
                      kcu.COLUMN_NAME,
                      kcu.REFERENCED_TABLE_SCHEMA,
                      kcu.REFERENCED_TABLE_NAME,
                      kcu.REFERENCED_COLUMN_NAME,
                      rc.UPDATE_RULE,
                      rc.DELETE_RULE,
                      kcu.ORDINAL_POSITION
                    FROM information_schema.KEY_COLUMN_USAGE kcu
                    LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
                      ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
                     AND rc.TABLE_NAME = kcu.TABLE_NAME
                     AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                    WHERE kcu.TABLE_SCHEMA = DATABASE()
                      AND kcu.TABLE_NAME = ?
                      AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
                    ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
                "#;

                let rows = sqlx::query(query).bind(table_name).fetch_all(pool).await?;
                let mut grouped: BTreeMap<String, Vec<sqlx::mysql::MySqlRow>> = BTreeMap::new();
                for row in rows {
                    let name: String = row.try_get(0).unwrap_or_default();
                    grouped.entry(name).or_default().push(row);
                }

                grouped
                    .into_iter()
                    .map(|(constraint_name, rows)| {
                        let first = &rows[0];
                        let column_names = rows
                            .iter()
                            .map(|row| row.try_get(2).unwrap_or_default())
                            .collect::<Vec<String>>();
                        let foreign_column_names = rows
                            .iter()
                            .map(|row| row.try_get(5).unwrap_or_default())
                            .collect::<Vec<String>>();
                        TableConstraint {
                            constraint_name,
                            constraint_type: "FOREIGN KEY".to_string(),
                            table_schema: None,
                            table_name: first.try_get(1).unwrap_or_default(),
                            column_names,
                            foreign_table_schema: first.try_get(3).ok(),
                            foreign_table_name: first.try_get(4).ok(),
                            foreign_column_names: Some(foreign_column_names),
                            check_expression: Some(format!(
                                "ON UPDATE {} ON DELETE {}",
                                first
                                    .try_get::<String, _>(6)
                                    .unwrap_or_else(|_| "RESTRICT".to_string())
                                    .to_uppercase(),
                                first
                                    .try_get::<String, _>(7)
                                    .unwrap_or_else(|_| "RESTRICT".to_string())
                                    .to_uppercase()
                            )),
                            is_deferrable: None,
                            initially_deferred: None,
                        }
                    })
                    .collect()
            }
            DatabasePool::MongoDB { .. } => vec![],
            DatabasePool::ClickHouse { .. } => vec![],
            DatabasePool::LibSQL { .. } | DatabasePool::CloudflareD1 { .. } | DatabasePool::Redis { .. } => vec![],
        };

        Ok(constraints)
    }

    pub async fn get_table_indexes(
        &self,
        connection_id: &str,
        table_name: &str,
        db_type: &DatabaseType,
    ) -> Result<Vec<TableIndex>> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        if !matches!(db_type, DatabaseType::PostgreSQL) {
            return Ok(vec![]);
        }

        let query = r#"
            SELECT
              i.relname AS index_name,
              am.amname AS method,
              ix.indisunique,
              ix.indisprimary,
              ix.indisvalid,
              COALESCE(array_agg(a.attname ORDER BY k.ordinality) FILTER (WHERE a.attname IS NOT NULL), ARRAY[]::text[]) AS columns,
              pg_get_expr(ix.indexprs, ix.indrelid) AS expression,
              pg_get_expr(ix.indpred, ix.indrelid) AS predicate,
              pg_get_indexdef(ix.indexrelid) AS definition
            FROM pg_index ix
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_class t ON t.oid = ix.indrelid
            JOIN pg_am am ON am.oid = i.relam
            LEFT JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY k(attnum, ordinality) ON true
            LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum AND a.attnum > 0
            WHERE ix.indrelid = to_regclass($1)
            GROUP BY i.relname, am.amname, ix.indisunique, ix.indisprimary, ix.indisvalid, ix.indexprs, ix.indpred, ix.indexrelid, ix.indrelid
            ORDER BY i.relname
        "#;

        let indexes = match pool {
            DatabasePool::Postgres(pool) => {
                let rows = sqlx::query(query).bind(table_name).fetch_all(pool).await?;
                rows.into_iter()
                    .map(|row| TableIndex {
                        index_name: row.try_get(0).unwrap_or_default(),
                        method: row.try_get(1).ok(),
                        is_unique: row.try_get(2).unwrap_or(false),
                        is_primary: row.try_get(3).unwrap_or(false),
                        is_valid: row.try_get(4).ok(),
                        columns: row.try_get(5).unwrap_or_default(),
                        expression: row.try_get(6).ok(),
                        predicate: row.try_get(7).ok(),
                        definition: row.try_get(8).ok(),
                    })
                    .collect()
            }
            _ => vec![],
        };

        Ok(indexes)
    }

    pub async fn create_foreign_key(
        &self,
        connection_id: &str,
        foreign_key: ForeignKeyDefinition,
        db_type: &DatabaseType,
    ) -> Result<String> {
        self.validate_foreign_key_definition(connection_id, &foreign_key, db_type)
            .await?;

        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        let source_table = Self::quote_table_name(&foreign_key.table_name, db_type);
        let referenced_table = Self::quote_table_name(&foreign_key.referenced_table_name, db_type);
        let source_columns = foreign_key
            .column_names
            .iter()
            .map(|column| Self::quote_identifier(column, db_type))
            .collect::<Vec<_>>()
            .join(", ");
        let referenced_columns = foreign_key
            .referenced_column_names
            .iter()
            .map(|column| Self::quote_identifier(column, db_type))
            .collect::<Vec<_>>()
            .join(", ");

        let on_delete_clause = Self::normalize_referential_action(foreign_key.on_delete.as_deref())
            .map(|action| format!(" ON DELETE {}", action))
            .unwrap_or_default();
        let on_update_clause = Self::normalize_referential_action(foreign_key.on_update.as_deref())
            .map(|action| format!(" ON UPDATE {}", action))
            .unwrap_or_default();

        match db_type {
            DatabaseType::SQLite => {
                let mut constraints = self
                    .get_table_constraints(connection_id, &foreign_key.table_name, db_type)
                    .await?
                    .into_iter()
                    .filter(|constraint| constraint.constraint_type == "FOREIGN KEY")
                    .collect::<Vec<_>>();

                constraints.push(TableConstraint {
                    constraint_name: foreign_key.constraint_name.clone(),
                    constraint_type: "FOREIGN KEY".to_string(),
                    table_schema: None,
                    table_name: foreign_key.table_name.clone(),
                    column_names: foreign_key.column_names.clone(),
                    foreign_table_schema: None,
                    foreign_table_name: Some(foreign_key.referenced_table_name.clone()),
                    foreign_column_names: Some(foreign_key.referenced_column_names.clone()),
                    check_expression: Some(
                        format!(
                            "ON UPDATE {} ON DELETE {}",
                            Self::normalize_referential_action(foreign_key.on_update.as_deref())
                                .unwrap_or_else(|| "NO ACTION".to_string()),
                            Self::normalize_referential_action(foreign_key.on_delete.as_deref())
                                .unwrap_or_else(|| "NO ACTION".to_string())
                        ),
                    ),
                    is_deferrable: None,
                    initially_deferred: None,
                });

                self.rebuild_sqlite_table_with_constraints(
                    connection_id,
                    &foreign_key.table_name,
                    constraints,
                )
                .await?;
            }
            DatabaseType::PostgreSQL | DatabaseType::MySQL => {
                let sql = format!(
                    "ALTER TABLE {} ADD CONSTRAINT {} FOREIGN KEY ({}) REFERENCES {} ({}){}{}",
                    source_table,
                    Self::quote_identifier(&foreign_key.constraint_name, db_type),
                    source_columns,
                    referenced_table,
                    referenced_columns,
                    on_delete_clause,
                    on_update_clause
                );
                execute_query!(pool, &sql)?;
            }
            DatabaseType::MongoDB | DatabaseType::Redis => {
                return Err(anyhow!("Foreign keys are not supported for MongoDB/Redis"));
            }
            DatabaseType::ClickHouse => {
                return Err(anyhow!("Foreign keys are not supported for ClickHouse"));
            }
            DatabaseType::LibSQL => {
                return Err(anyhow!("Foreign keys are not supported for LibSQL"));
            }
        }

        Ok(format!(
            "Successfully created foreign key {} on {}",
            foreign_key.constraint_name, foreign_key.table_name
        ))
    }

    pub async fn drop_foreign_key(
        &self,
        connection_id: &str,
        table_name: &str,
        constraint_name: &str,
        db_type: &DatabaseType,
    ) -> Result<String> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        match db_type {
            DatabaseType::SQLite => {
                let constraints = self
                    .get_table_constraints(connection_id, table_name, db_type)
                    .await?
                    .into_iter()
                    .filter(|constraint| {
                        constraint.constraint_type == "FOREIGN KEY"
                            && constraint.constraint_name != constraint_name
                    })
                    .collect::<Vec<_>>();

                self.rebuild_sqlite_table_with_constraints(connection_id, table_name, constraints)
                    .await?;
            }
            DatabaseType::PostgreSQL => {
                let sql = format!(
                    "ALTER TABLE {} DROP CONSTRAINT {}",
                    Self::quote_table_name(table_name, db_type),
                    Self::quote_identifier(constraint_name, db_type)
                );
                execute_query!(pool, &sql)?;
            }
            DatabaseType::MySQL => {
                let sql = format!(
                    "ALTER TABLE {} DROP FOREIGN KEY {}",
                    Self::quote_table_name(table_name, db_type),
                    Self::quote_identifier(constraint_name, db_type)
                );
                execute_query!(pool, &sql)?;
            }
            DatabaseType::MongoDB | DatabaseType::Redis => {
                return Err(anyhow!("Foreign keys are not supported for MongoDB/Redis"));
            }
            DatabaseType::ClickHouse => {
                return Err(anyhow!("Foreign keys are not supported for ClickHouse"));
            }
            DatabaseType::LibSQL => {
                return Err(anyhow!("Foreign keys are not supported for LibSQL"));
            }
        }

        Ok(format!(
            "Successfully dropped foreign key {} from {}",
            constraint_name, table_name
        ))
    }

    pub async fn list_applied_migrations(
        &self,
        connection_id: &str,
        db_type: &DatabaseType,
    ) -> Result<Vec<AppliedMigration>> {
        self.ensure_schema_migrations_table(connection_id, db_type).await?;

        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        let sql = match db_type {
            DatabaseType::PostgreSQL | DatabaseType::SQLite | DatabaseType::MySQL | DatabaseType::ClickHouse | DatabaseType::LibSQL => {
                "SELECT id, name, applied_at, checksum FROM schema_migrations ORDER BY id"
            }
            DatabaseType::MongoDB | DatabaseType::Redis => "",
        };

        let migrations = match pool {
            DatabasePool::Sqlite(pool) => sqlx::query(sql)
                .fetch_all(pool)
                .await?
                .into_iter()
                .map(|row| AppliedMigration {
                    id: row.try_get(0).unwrap_or_default(),
                    name: row.try_get(1).unwrap_or_default(),
                    applied_at: row.try_get(2).unwrap_or_default(),
                    checksum: row.try_get(3).ok(),
                })
                .collect(),
            DatabasePool::Postgres(pool) => sqlx::query(sql)
                .fetch_all(pool)
                .await?
                .into_iter()
                .map(|row| AppliedMigration {
                    id: row.try_get(0).unwrap_or_default(),
                    name: row.try_get(1).unwrap_or_default(),
                    applied_at: row.try_get(2).unwrap_or_default(),
                    checksum: row.try_get(3).ok(),
                })
                .collect(),
            DatabasePool::MySql(pool) => sqlx::query(sql)
                .fetch_all(pool)
                .await?
                .into_iter()
                .map(|row| AppliedMigration {
                    id: row.try_get(0).unwrap_or_default(),
                    name: row.try_get(1).unwrap_or_default(),
                    applied_at: row.try_get(2).unwrap_or_default(),
                    checksum: row.try_get(3).ok(),
                })
                .collect(),
            DatabasePool::MongoDB { .. } => vec![],
            DatabasePool::ClickHouse { client, url, database } => {
                let res = Self::clickhouse_http_query(client, url, database, "SELECT id, name, toString(applied_at) as applied_at, checksum FROM schema_migrations ORDER BY id FORMAT JSONCompact").await?;
                res.rows.into_iter().filter_map(|r| {
                    let obj = r.as_object()?;
                    let id = obj.get("id")?.as_str()?.to_string();
                    let name = obj.get("name")?.as_str()?.to_string();
                    let applied_at = obj.get("applied_at")?.as_str().unwrap_or_default().to_string();
                    let checksum = obj.get("checksum").and_then(|v| v.as_str()).map(|s| s.to_string());
                    Some(AppliedMigration { id, name, applied_at, checksum })
                }).collect()
            }
            DatabasePool::LibSQL { client, url, token } => {
                let res = Self::libsql_http_pipeline(client, url, token, sql).await;
                match res {
                    Ok(r) => r.rows.into_iter().filter_map(|row| {
                        let obj = row.as_object()?;
                        let id = obj.get("id")?.as_str()?.to_string();
                        let name = obj.get("name")?.as_str()?.to_string();
                        let applied_at = obj.get("applied_at").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                        let checksum = obj.get("checksum").and_then(|v| v.as_str()).map(|s| s.to_string());
                        Some(AppliedMigration { id, name, applied_at, checksum })
                    }).collect(),
                    Err(_) => vec![],
                }
            }
            DatabasePool::CloudflareD1 { client, account_id, database_id, api_token } => {
                let res = Self::cloudflare_d1_query(client, account_id, database_id, api_token, sql).await;
                match res {
                    Ok(r) => r.rows.into_iter().filter_map(|row| {
                        let obj = row.as_object()?;
                        let id = obj.get("id")?.as_str()?.to_string();
                        let name = obj.get("name")?.as_str()?.to_string();
                        let applied_at = obj.get("applied_at").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                        let checksum = obj.get("checksum").and_then(|v| v.as_str()).map(|s| s.to_string());
                        Some(AppliedMigration { id, name, applied_at, checksum })
                    }).collect(),
                    Err(_) => vec![],
                }
            }
            DatabasePool::Redis { .. } => vec![],
        };

        Ok(migrations)
    }

    pub async fn apply_migration(
        &self,
        connection_id: &str,
        migration_id: &str,
        migration_name: &str,
        up_sql: &str,
        checksum: Option<&str>,
        db_type: &DatabaseType,
    ) -> Result<String> {
        self.ensure_schema_migrations_table(connection_id, db_type).await?;
        let statements = Self::split_sql_statements(up_sql);
        if statements.is_empty() {
            return Err(anyhow!("Migration SQL is empty"));
        }

        let applied = self.list_applied_migrations(connection_id, db_type).await?;
        if applied.iter().any(|migration| migration.id == migration_id) {
            return Err(anyhow!("Migration {} has already been applied", migration_id));
        }

        let mut transactional_statements = statements;
        let insert_sql = format!(
            "INSERT INTO schema_migrations (id, name, checksum) VALUES ({}, {}, {})",
            Self::sql_string_literal(migration_id),
            Self::sql_string_literal(migration_name),
            checksum
                .map(Self::sql_string_literal)
                .unwrap_or_else(|| "NULL".to_string())
        );
        transactional_statements.push(insert_sql);
        self.execute_transaction(connection_id, &transactional_statements)
            .await?;

        Ok(format!("Applied migration {}", migration_id))
    }

    pub async fn rollback_migration(
        &self,
        connection_id: &str,
        migration_id: &str,
        down_sql: &str,
        db_type: &DatabaseType,
    ) -> Result<String> {
        self.ensure_schema_migrations_table(connection_id, db_type).await?;

        let applied = self.list_applied_migrations(connection_id, db_type).await?;
        let latest = applied
            .last()
            .ok_or_else(|| anyhow!("There are no applied migrations to rollback"))?;

        if latest.id != migration_id {
            return Err(anyhow!(
                "Only the latest applied migration can be rolled back (latest: {})",
                latest.id
            ));
        }

        let mut transactional_statements = Self::split_sql_statements(down_sql);
        if transactional_statements.is_empty() {
            return Err(anyhow!("Rollback SQL is empty"));
        }
        transactional_statements.push(format!(
            "DELETE FROM schema_migrations WHERE id = {}",
            Self::sql_string_literal(migration_id)
        ));

        self.execute_transaction(connection_id, &transactional_statements)
            .await?;

        Ok(format!("Rolled back migration {}", migration_id))
    }

    pub async fn get_postgres_connection_info(
        &self,
        connection_id: &str,
    ) -> Result<PostgresConnectionInfo> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        let info = match pool {
            DatabasePool::Postgres(pool) => {
                let row = sqlx::query(
                    r#"
                    SELECT
                      version()::text AS version,
                      current_setting('server_version')::text AS server_version,
                      current_database()::text AS current_database,
                      current_user::text AS current_user,
                      current_setting('search_path')::text AS search_path,
                      current_setting('TimeZone')::text AS timezone,
                      pg_backend_pid()::int4 AS backend_pid
                    "#,
                )
                .fetch_one(pool)
                .await?;

                PostgresConnectionInfo {
                    version: row.try_get(0).unwrap_or_default(),
                    server_version: row.try_get(1).unwrap_or_default(),
                    current_database: row.try_get(2).unwrap_or_default(),
                    current_user: row.try_get(3).unwrap_or_default(),
                    search_path: row.try_get(4).unwrap_or_default(),
                    timezone: row.try_get(5).unwrap_or_default(),
                    backend_pid: row.try_get(6).unwrap_or_default(),
                }
            }
            _ => return Err(anyhow!("Connection is not PostgreSQL")),
        };

        Ok(info)
    }

    pub async fn cancel_postgres_backend_query(
        &self,
        connection_id: &str,
        backend_pid: i32,
    ) -> Result<bool> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        match pool {
            DatabasePool::Postgres(pool) => {
                let row = sqlx::query("SELECT pg_cancel_backend($1)")
                    .bind(backend_pid)
                    .fetch_one(pool)
                    .await?;
                let cancelled: bool = row.try_get(0).unwrap_or(false);
                Ok(cancelled)
            }
            _ => Err(anyhow!("Connection is not PostgreSQL")),
        }
    }

    pub async fn get_postgres_extensions(&self, connection_id: &str) -> Result<Vec<PostgresExtension>> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        match pool {
            DatabasePool::Postgres(pool) => {
                let rows = sqlx::query("SELECT extname, extversion FROM pg_extension ORDER BY extname")
                    .fetch_all(pool)
                    .await?;
                Ok(rows
                    .into_iter()
                    .map(|row| PostgresExtension {
                        extname: row.try_get(0).unwrap_or_default(),
                        extversion: row.try_get(1).unwrap_or_default(),
                    })
                    .collect())
            }
            _ => Err(anyhow!("Connection is not PostgreSQL")),
        }
    }

    pub async fn get_postgres_table_privileges(
        &self,
        connection_id: &str,
        table_name: &str,
    ) -> Result<PostgresTablePrivileges> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        match pool {
            DatabasePool::Postgres(pool) => {
                let row = sqlx::query(
                    r#"
                    SELECT
                      has_table_privilege(current_user, to_regclass($1), 'SELECT'),
                      has_table_privilege(current_user, to_regclass($1), 'INSERT'),
                      has_table_privilege(current_user, to_regclass($1), 'UPDATE'),
                      has_table_privilege(current_user, to_regclass($1), 'DELETE'),
                      has_table_privilege(current_user, to_regclass($1), 'TRUNCATE'),
                      has_table_privilege(current_user, to_regclass($1), 'REFERENCES'),
                      has_table_privilege(current_user, to_regclass($1), 'TRIGGER')
                    "#,
                )
                .bind(table_name)
                .fetch_one(pool)
                .await?;

                Ok(PostgresTablePrivileges {
                    can_select: row.try_get(0).unwrap_or(false),
                    can_insert: row.try_get(1).unwrap_or(false),
                    can_update: row.try_get(2).unwrap_or(false),
                    can_delete: row.try_get(3).unwrap_or(false),
                    can_truncate: row.try_get(4).unwrap_or(false),
                    can_references: row.try_get(5).unwrap_or(false),
                    can_trigger: row.try_get(6).unwrap_or(false),
                })
            }
            _ => Err(anyhow!("Connection is not PostgreSQL")),
        }
    }

    async fn validate_foreign_key_definition(
        &self,
        connection_id: &str,
        foreign_key: &ForeignKeyDefinition,
        db_type: &DatabaseType,
    ) -> Result<()> {
        if foreign_key.constraint_name.trim().is_empty() {
            return Err(anyhow!("Constraint name is required"));
        }
        if foreign_key.column_names.is_empty() || foreign_key.referenced_column_names.is_empty() {
            return Err(anyhow!("Source and referenced columns are required"));
        }
        if foreign_key.column_names.len() != foreign_key.referenced_column_names.len() {
            return Err(anyhow!("Source and referenced column counts must match"));
        }

        let source_columns = self
            .get_table_structure(connection_id, &foreign_key.table_name, db_type)
            .await?;
        let source_by_name = source_columns
            .iter()
            .map(|column| (column.name.clone(), column))
            .collect::<HashMap<_, _>>();
        for column_name in &foreign_key.column_names {
            if !source_by_name.contains_key(column_name) {
                return Err(anyhow!("Source column {} does not exist", column_name));
            }
        }

        let referenced_columns = self
            .get_table_structure(connection_id, &foreign_key.referenced_table_name, db_type)
            .await?;
        let referenced_by_name = referenced_columns
            .iter()
            .map(|column| (column.name.clone(), column))
            .collect::<HashMap<_, _>>();
        for column_name in &foreign_key.referenced_column_names {
            if !referenced_by_name.contains_key(column_name) {
                return Err(anyhow!("Referenced column {} does not exist", column_name));
            }
        }

        let existing_constraints = self
            .get_table_constraints(connection_id, &foreign_key.table_name, db_type)
            .await?;
        if existing_constraints.iter().any(|constraint| {
            constraint.constraint_name.eq_ignore_ascii_case(&foreign_key.constraint_name)
        }) {
            return Err(anyhow!(
                "Constraint {} already exists on {}",
                foreign_key.constraint_name,
                foreign_key.table_name
            ));
        }

        for (source_name, target_name) in foreign_key
            .column_names
            .iter()
            .zip(foreign_key.referenced_column_names.iter())
        {
            let source_column = source_by_name
                .get(source_name)
                .ok_or_else(|| anyhow!("Source column {} does not exist", source_name))?;
            let referenced_column = referenced_by_name
                .get(target_name)
                .ok_or_else(|| anyhow!("Referenced column {} does not exist", target_name))?;

            if source_column.type_family != referenced_column.type_family
                && source_column.normalized_type != referenced_column.normalized_type
            {
                return Err(anyhow!(
                    "Column type mismatch: {} ({}) cannot reference {} ({})",
                    source_name,
                    source_column.data_type,
                    target_name,
                    referenced_column.data_type
                ));
            }
        }

        Ok(())
    }

    async fn ensure_schema_migrations_table(
        &self,
        connection_id: &str,
        db_type: &DatabaseType,
    ) -> Result<()> {
        if db_type == &DatabaseType::MongoDB || db_type == &DatabaseType::Redis {
            return Ok(());
        }

        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        let create_sql = match db_type {
            DatabaseType::SQLite | DatabaseType::LibSQL => r#"
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    checksum TEXT,
                    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            "#,
            DatabaseType::PostgreSQL => r#"
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    checksum TEXT,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            "#,
            DatabaseType::MySQL => r#"
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    id VARCHAR(255) PRIMARY KEY,
                    name TEXT NOT NULL,
                    checksum TEXT NULL,
                    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            "#,
            DatabaseType::MongoDB | DatabaseType::Redis => "",
            DatabaseType::ClickHouse => r#"
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    id String,
                    name String,
                    checksum Nullable(String),
                    applied_at DateTime DEFAULT now()
                ) ENGINE = MergeTree() ORDER BY id
            "#,
        };

        execute_query!(pool, create_sql)?;
        Ok(())
    }

    fn sql_string_literal(value: &str) -> String {
        format!("'{}'", value.replace('\'', "''"))
    }

    fn sqlite_constraint_actions(constraint: &TableConstraint) -> (String, String) {
        let expression = constraint
            .check_expression
            .as_deref()
            .unwrap_or_default()
            .to_uppercase();

        let on_delete = ["NO ACTION", "RESTRICT", "SET NULL", "SET DEFAULT", "CASCADE"]
            .into_iter()
            .find(|action| expression.contains(&format!("ON DELETE {}", action)))
            .unwrap_or("NO ACTION")
            .to_string();
        let on_update = ["NO ACTION", "RESTRICT", "SET NULL", "SET DEFAULT", "CASCADE"]
            .into_iter()
            .find(|action| expression.contains(&format!("ON UPDATE {}", action)))
            .unwrap_or("NO ACTION")
            .to_string();
        (on_delete, on_update)
    }

    fn constraint_action_suffix(constraint: &TableConstraint) -> String {
        let expression = constraint.check_expression.as_deref().unwrap_or_default();
        let upper = expression.to_uppercase();
        let on_delete_index = upper.find("ON DELETE");
        let on_update_index = upper.find("ON UPDATE");
        let start = match (on_delete_index, on_update_index) {
            (Some(delete_index), Some(update_index)) => delete_index.min(update_index),
            (Some(delete_index), None) => delete_index,
            (None, Some(update_index)) => update_index,
            (None, None) => return String::new(),
        };
        expression[start..].trim().to_string()
    }

    async fn rebuild_sqlite_table_with_constraints(
        &self,
        connection_id: &str,
        table_name: &str,
        foreign_keys: Vec<TableConstraint>,
    ) -> Result<()> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        let DatabasePool::Sqlite(pool) = pool else {
            return Err(anyhow!("SQLite rebuild is only available for SQLite connections"));
        };

        let columns = self
            .get_table_structure(connection_id, table_name, &DatabaseType::SQLite)
            .await?;
        let primary_keys = self
            .get_primary_keys(&DatabasePool::Sqlite(pool.clone()), table_name, &DatabaseType::SQLite)
            .await?;
        let indexes = self
            .get_indexes(&DatabasePool::Sqlite(pool.clone()), table_name, &DatabaseType::SQLite)
            .await?;

        let mut column_defs = Vec::new();
        for column in &columns {
            let mut definition = format!(
                "{} {}",
                Self::quote_identifier(&column.name, &DatabaseType::SQLite),
                column.data_type
            );
            if !column.is_nullable {
                definition.push_str(" NOT NULL");
            }
            if let Some(default_value) = &column.default_value {
                if !default_value.trim().is_empty() {
                    definition.push_str(" DEFAULT ");
                    definition.push_str(default_value);
                }
            }
            column_defs.push(definition);
        }

        if !primary_keys.is_empty() {
            column_defs.push(format!(
                "PRIMARY KEY ({})",
                primary_keys
                    .iter()
                    .map(|column| Self::quote_identifier(column, &DatabaseType::SQLite))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }

        for constraint in &foreign_keys {
            let Some(foreign_table_name) = &constraint.foreign_table_name else {
                continue;
            };
            let referenced_columns = constraint
                .foreign_column_names
                .clone()
                .unwrap_or_default()
                .into_iter()
                .map(|column| Self::quote_identifier(&column, &DatabaseType::SQLite))
                .collect::<Vec<_>>()
                .join(", ");
            let source_columns = constraint
                .column_names
                .iter()
                .map(|column| Self::quote_identifier(column, &DatabaseType::SQLite))
                .collect::<Vec<_>>()
                .join(", ");
            let (on_delete, on_update) = Self::sqlite_constraint_actions(constraint);
            column_defs.push(format!(
                "FOREIGN KEY ({}) REFERENCES {} ({}) ON DELETE {} ON UPDATE {}",
                source_columns,
                Self::quote_table_name(foreign_table_name, &DatabaseType::SQLite),
                referenced_columns,
                on_delete,
                on_update
            ));
        }

        let temp_table_name = format!("__nodadb_rebuild_{}", table_name);
        let quoted_table = Self::quote_table_name(table_name, &DatabaseType::SQLite);
        let quoted_temp = Self::quote_table_name(&temp_table_name, &DatabaseType::SQLite);
        let create_sql = format!(
            "CREATE TABLE {} (\n  {}\n)",
            quoted_table,
            column_defs.join(",\n  ")
        );
        let column_list = columns
            .iter()
            .map(|column| Self::quote_identifier(&column.name, &DatabaseType::SQLite))
            .collect::<Vec<_>>()
            .join(", ");

        let mut tx = pool.begin().await?;
        sqlx::query("PRAGMA foreign_keys = OFF")
            .execute(&mut *tx)
            .await
            .map_err(Self::format_sqlx_error)?;
        sqlx::query(&format!("ALTER TABLE {} RENAME TO {}", quoted_table, quoted_temp))
            .execute(&mut *tx)
            .await
            .map_err(Self::format_sqlx_error)?;
        sqlx::query(&create_sql)
            .execute(&mut *tx)
            .await
            .map_err(Self::format_sqlx_error)?;
        sqlx::query(&format!(
            "INSERT INTO {} ({}) SELECT {} FROM {}",
            quoted_table, column_list, column_list, quoted_temp
        ))
        .execute(&mut *tx)
        .await
        .map_err(Self::format_sqlx_error)?;
        sqlx::query(&format!("DROP TABLE {}", quoted_temp))
            .execute(&mut *tx)
            .await
            .map_err(Self::format_sqlx_error)?;

        for index_sql in indexes {
            sqlx::query(&index_sql)
                .execute(&mut *tx)
                .await
                .map_err(Self::format_sqlx_error)?;
        }

        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&mut *tx)
            .await
            .map_err(Self::format_sqlx_error)?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn export_table_structure(
        &self,
        connection_id: &str,
        table_name: &str,
        db_type: &DatabaseType,
    ) -> Result<String> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        // Get table structure
        let columns = self.get_table_structure(connection_id, table_name, db_type).await?;
        
        if columns.is_empty() {
            return Err(anyhow!("Table has no columns or does not exist"));
        }

        // Get primary keys
        let primary_keys = self.get_primary_keys(pool, table_name, db_type).await?;
        
        // Get foreign keys
        let foreign_keys = self
            .get_table_constraints(connection_id, table_name, db_type)
            .await?
            .into_iter()
            .filter(|constraint| constraint.constraint_type == "FOREIGN KEY")
            .collect::<Vec<_>>();

        // Get indexes
        let indexes = self.get_indexes(pool, table_name, db_type).await?;

        // Generate CREATE TABLE statement
        let mut sql = format!("CREATE TABLE {} (\n", table_name);
        
        // Add columns
        for (i, col) in columns.iter().enumerate() {
            sql.push_str("  ");
            sql.push_str(&col.name);
            sql.push(' ');
            sql.push_str(&col.data_type);
            
            if !col.is_nullable {
                sql.push_str(" NOT NULL");
            }
            
            if let Some(ref default) = col.default_value {
                if !default.is_empty() {
                    sql.push_str(" DEFAULT ");
                    sql.push_str(default);
                }
            }
            
            if i < columns.len() - 1 || !primary_keys.is_empty() || !foreign_keys.is_empty() {
                sql.push(',');
            }
            sql.push('\n');
        }
        
        // Add primary key constraint
        if !primary_keys.is_empty() {
            sql.push_str("  PRIMARY KEY (");
            sql.push_str(&primary_keys.join(", "));
            if !foreign_keys.is_empty() {
                sql.push_str("),\n");
            } else {
                sql.push_str(")\n");
            }
        }

        for (index, constraint) in foreign_keys.iter().enumerate() {
            let Some(foreign_table_name) = &constraint.foreign_table_name else {
                continue;
            };
            let foreign_columns = constraint
                .foreign_column_names
                .clone()
                .unwrap_or_default()
                .join(", ");
            let actions = Self::constraint_action_suffix(constraint);
            sql.push_str(&format!(
                "  FOREIGN KEY ({}) REFERENCES {} ({})",
                constraint.column_names.join(", "),
                foreign_table_name,
                foreign_columns
            ));
            if !actions.is_empty() {
                sql.push(' ');
                sql.push_str(&actions);
            }
            if index < foreign_keys.len() - 1 {
                sql.push(',');
            }
            sql.push('\n');
        }
        
        sql.push_str(");\n");
        
        // Add indexes
        for index in indexes {
            sql.push('\n');
            sql.push_str(&index);
            sql.push(';');
        }

        Ok(sql)
    }

    async fn get_primary_keys(
        &self,
        pool: &DatabasePool,
        table_name: &str,
        db_type: &DatabaseType,
    ) -> Result<Vec<String>> {
        let query = match db_type {
            DatabaseType::SQLite | DatabaseType::LibSQL => {
                format!("PRAGMA table_info({})", table_name)
            }
            DatabaseType::PostgreSQL => {
                format!(
                    "SELECT a.attname \
                     FROM pg_index i \
                     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) \
                     WHERE i.indrelid = '{}'::regclass AND i.indisprimary",
                    table_name
                )
            }
            DatabaseType::MySQL => {
                format!(
                    "SELECT COLUMN_NAME \
                     FROM information_schema.KEY_COLUMN_USAGE \
                     WHERE TABLE_NAME = '{}' AND TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'PRIMARY' \
                     ORDER BY ORDINAL_POSITION",
                    table_name
                )
            }
            DatabaseType::MongoDB | DatabaseType::Redis => String::new(),
            DatabaseType::ClickHouse => String::new(),
        };

        let primary_keys = match pool {
            DatabasePool::Sqlite(pool) => {
                let rows = sqlx::query(&query).fetch_all(pool).await?;
                rows.into_iter()
                    .filter_map(|row| {
                        let pk: i64 = row.try_get(5).unwrap_or(0);
                        if pk > 0 {
                            let name: String = row.try_get(1).unwrap_or_default();
                            Some(name)
                        } else {
                            None
                        }
                    })
                    .collect()
            }
            DatabasePool::Postgres(pool) => {
                let rows = sqlx::query(&query).fetch_all(pool).await?;
                rows.into_iter()
                    .map(|row| row.try_get(0).unwrap_or_default())
                    .collect()
            }
            DatabasePool::MySql(pool) => {
                let rows = sqlx::query(&query).fetch_all(pool).await?;
                rows.into_iter()
                    .map(|row| row.try_get(0).unwrap_or_default())
                    .collect()
            }
            DatabasePool::MongoDB { .. } => vec!["_id".to_string()],
            DatabasePool::ClickHouse { client, url, database } => {
                let q = format!("SELECT name FROM system.columns WHERE database = '{}' AND table = '{}' AND is_in_primary_key = 1 FORMAT JSONCompact", database.replace('\'', "''"), table_name.replace('\'', "''"));
                let res = Self::clickhouse_http_query(client, url, database, &q).await?;
                res.rows.into_iter().filter_map(|r| {
                    r.as_object()?.get("name")?.as_str().map(|s| s.to_string())
                }).collect()
            }
            DatabasePool::LibSQL { client, url, token } => {
                let res = Self::libsql_http_pipeline(client, url, token, &query).await?;
                let mut pks = Vec::new();
                for r in res.rows {
                    if let Some(obj) = r.as_object() {
                        let pk = obj.get("pk").and_then(|v| v.as_i64()).unwrap_or(0);
                        if pk > 0 {
                            if let Some(name) = obj.get("name").and_then(|v| v.as_str()) {
                                pks.push(name.to_string());
                            }
                        }
                    }
                }
                pks
            }
            DatabasePool::CloudflareD1 { client, account_id, database_id, api_token } => {
                let res = Self::cloudflare_d1_query(client, account_id, database_id, api_token, &query).await?;
                let mut pks = Vec::new();
                for r in res.rows {
                    if let Some(obj) = r.as_object() {
                        let pk = obj.get("pk").and_then(|v| v.as_i64()).unwrap_or(0);
                        if pk > 0 {
                            if let Some(name) = obj.get("name").and_then(|v| v.as_str()) {
                                pks.push(name.to_string());
                            }
                        }
                    }
                }
                pks
            }
            DatabasePool::Redis { .. } => vec!["key".to_string()],
        };

        Ok(primary_keys)
    }

    async fn get_indexes(
        &self,
        pool: &DatabasePool,
        table_name: &str,
        db_type: &DatabaseType,
    ) -> Result<Vec<String>> {
        let query = match db_type {
            DatabaseType::SQLite | DatabaseType::LibSQL => {
                format!("PRAGMA index_list({})", table_name)
            }
            DatabaseType::PostgreSQL => {
                format!(
                    "SELECT indexname, indexdef \
                     FROM pg_indexes \
                     WHERE tablename = '{}' AND indexname NOT LIKE '%_pkey'",
                    table_name
                )
            }
            DatabaseType::MySQL => {
                format!(
                    "SELECT DISTINCT INDEX_NAME, COLUMN_NAME \
                     FROM information_schema.STATISTICS \
                     WHERE TABLE_NAME = '{}' AND TABLE_SCHEMA = DATABASE() AND INDEX_NAME != 'PRIMARY' \
                     ORDER BY INDEX_NAME, SEQ_IN_INDEX",
                    table_name
                )
            }
            DatabaseType::MongoDB | DatabaseType::Redis => String::new(),
            DatabaseType::ClickHouse => String::new(),
        };

        let indexes = match pool {
            DatabasePool::Sqlite(pool) => {
                let rows = sqlx::query(&query).fetch_all(pool).await?;
                let mut index_sqls = Vec::new();
                
                for row in rows {
                    let index_name: String = row.try_get(1).unwrap_or_default();
                    let is_unique: i64 = row.try_get(2).unwrap_or(0);
                    if index_name.starts_with("sqlite_autoindex") {
                        continue;
                    }
                    
                    // Get index columns
                    let index_info_query = format!("PRAGMA index_info({})", index_name);
                    let info_rows = sqlx::query(&index_info_query).fetch_all(pool).await?;
                    let columns: Vec<String> = info_rows
                        .into_iter()
                        .map(|r| r.try_get(2).unwrap_or_default())
                        .collect();
                    
                    if !columns.is_empty() {
                        let unique = if is_unique == 1 { "UNIQUE " } else { "" };
                        let sql = format!(
                            "CREATE {}INDEX {} ON {} ({})",
                            unique,
                            index_name,
                            table_name,
                            columns.join(", ")
                        );
                        index_sqls.push(sql);
                    }
                }
                
                index_sqls
            }
            DatabasePool::Postgres(pool) => {
                let rows = sqlx::query(&query).fetch_all(pool).await?;
                rows.into_iter()
                    .map(|row| {
                        let indexdef: String = row.try_get(1).unwrap_or_default();
                        indexdef
                    })
                    .collect()
            }
            DatabasePool::MySql(pool) => {
                let rows = sqlx::query(&query).fetch_all(pool).await?;
                let mut index_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
                
                for row in rows {
                    let index_name: String = row.try_get(0).unwrap_or_default();
                    let column_name: String = row.try_get(1).unwrap_or_default();
                    
                    index_map.entry(index_name)
                        .or_default()
                        .push(column_name);
                }
                
                index_map.into_iter()
                    .map(|(index_name, columns)| {
                        format!(
                            "CREATE INDEX {} ON {} ({})",
                            index_name,
                            table_name,
                            columns.join(", ")
                        )
                    })
                    .collect()
            }
            DatabasePool::MongoDB { .. } => vec![],
            DatabasePool::ClickHouse { .. } => vec![],
            DatabasePool::LibSQL { .. } => vec![],
            DatabasePool::CloudflareD1 { client, account_id, database_id, api_token } => {
                let rows = Self::cloudflare_d1_query(client, account_id, database_id, api_token, &query).await?;
                let mut index_sqls = Vec::new();
                for row in rows.rows {
                    if let Some(obj) = row.as_object() {
                        let index_name = obj.get("name").and_then(|v| v.as_str()).unwrap_or_default();
                        let is_unique = obj.get("unique").and_then(|v| v.as_i64()).unwrap_or(0);
                        if index_name.starts_with("sqlite_autoindex") {
                            continue;
                        }
                        let info_query = format!("PRAGMA index_info({})", index_name);
                        let info_res = Self::cloudflare_d1_query(client, account_id, database_id, api_token, &info_query).await;
                        if let Ok(info_rows) = info_res {
                            let columns: Vec<String> = info_rows.rows.into_iter().filter_map(|r| {
                                r.as_object()?.get("name")?.as_str().map(|s| s.to_string())
                            }).collect();
                            if !columns.is_empty() {
                                let unique = if is_unique == 1 { "UNIQUE " } else { "" };
                                index_sqls.push(format!("CREATE {}INDEX {} ON {} ({})", unique, index_name, table_name, columns.join(", ")));
                            }
                        }
                    }
                }
                index_sqls
            }
            DatabasePool::Redis { .. } => vec![],
        };

        Ok(indexes)
    }

    pub async fn trace_id_relations(
        &self,
        connection_id: &str,
        value: &str,
        _db_type: &DatabaseType,
    ) -> Result<Vec<RelationMatch>> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        let mut matches = Vec::new();

        // 1. Detect if the value is a UUID or numeric ID
        let clean_value = value.trim();
        if clean_value.is_empty() {
            return Ok(matches);
        }

        let is_uuid = clean_value.len() == 36 && clean_value.chars().all(|c| c.is_ascii_hexdigit() || c == '-');
        let is_numeric = clean_value.chars().all(|c| c.is_ascii_digit());

        // Helper to check if column matches naming conventions
        let is_identifier_name = |name: &str| {
            let n = name.to_lowercase();
            n == "id" || n == "uuid" || n == "key" || n == "code" || n == "ref" ||
            n.ends_with("_id") || n.ends_with("_uuid") || n.ends_with("_key") || n.ends_with("_code") || n.ends_with("_ref") ||
            n.ends_with("id") || n.ends_with("uuid") || n.ends_with("key") ||
            n.starts_with("id_") || n.starts_with("uuid_") || n.starts_with("key_")
        };

        // 2. Fetch all columns of all tables and check candidates
        match pool {
            DatabasePool::Sqlite(pool) => {
                // Fetch tables
                let tables_query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
                let table_rows = sqlx::query(tables_query).fetch_all(pool).await?;
                
                let mut table_names = std::collections::HashSet::new();
                for t_row in &table_rows {
                    let table_name: String = t_row.try_get(0).unwrap_or_default();
                    table_names.insert(table_name);
                }

                let mut set: tokio::task::JoinSet<Result<Option<RelationMatch>>> = tokio::task::JoinSet::new();
                let sem = std::sync::Arc::new(tokio::sync::Semaphore::new(5));
                
                for table_name in &table_names {
                    // Fetch table column info
                    let col_query = format!("PRAGMA table_info(\"{}\")", table_name.replace('"', "\"\""));
                    let col_rows = sqlx::query(&col_query).fetch_all(pool).await?;
                    
                    for c_row in col_rows {
                        let col_name: String = c_row.try_get(1).unwrap_or_default();
                        let col_type: String = c_row.try_get(2).unwrap_or_default();
                        let is_pk: i64 = c_row.try_get(5).unwrap_or(0);
                        
                        let col_type_lower = col_type.to_lowercase();
                        let col_name_lower = col_name.to_lowercase();
                        
                        // Check table names matching (including singular/plural)
                        let mut matches_table_name = false;
                        for t_name in &table_names {
                            let t_name_lower = t_name.to_lowercase();
                            if col_name_lower == t_name_lower || 
                               col_name_lower == format!("{}s", t_name_lower) ||
                               t_name_lower == format!("{}s", col_name_lower) {
                                matches_table_name = true;
                                break;
                            }
                        }

                        // Decide if column is a candidate based on primary key or identifier naming conventions
                        let is_candidate = if is_pk > 0 {
                            true
                        } else if matches_table_name {
                            true
                        } else if is_uuid {
                            col_type_lower.contains("uuid") || 
                            ((col_type_lower.contains("text") || col_type_lower.contains("char") || col_type_lower.contains("varchar") || col_type_lower.is_empty()) && is_identifier_name(&col_name))
                        } else if is_numeric {
                            ((col_type_lower.contains("int") || col_type_lower.contains("num") || col_type_lower.is_empty()) && (is_identifier_name(&col_name) || col_name_lower == "id" || col_name_lower.ends_with("id"))) ||
                            ((col_type_lower.contains("text") || col_type_lower.contains("char") || col_type_lower.contains("varchar")) && is_identifier_name(&col_name))
                        } else {
                            (col_type_lower.contains("text") || col_type_lower.contains("char") || col_type_lower.is_empty()) && is_identifier_name(&col_name)
                        };
                        
                        if is_candidate {
                            let pool_clone = pool.clone();
                            let table_name_clone = table_name.clone();
                            let col_name_clone = col_name.clone();
                            let clean_value_clone = clean_value.to_string();
                            let sem_clone = sem.clone();
                            
                            set.spawn(async move {
                                let _permit = sem_clone.acquire().await.unwrap();
                                // Check count
                                let count_query = format!(
                                    "SELECT COUNT(*) FROM \"{}\" WHERE \"{}\" = ?",
                                    table_name_clone.replace('"', "\"\""),
                                    col_name_clone.replace('"', "\"\"")
                                );
                                
                                if let Ok(count_row) = sqlx::query(&count_query).bind(&clean_value_clone).fetch_one(&pool_clone).await {
                                    let count: i64 = count_row.try_get(0).unwrap_or(0);
                                    if count > 0 {
                                        // Fetch sample rows
                                        let sample_query = format!(
                                            "SELECT * FROM \"{}\" WHERE \"{}\" = ? LIMIT 10",
                                            table_name_clone.replace('"', "\"\""),
                                            col_name_clone.replace('"', "\"\"")
                                        );
                                        if let Ok(rows) = sqlx::query(&sample_query).bind(&clean_value_clone).fetch_all(&pool_clone).await {
                                            let sample_rows = {
                                                let converter = |r: Vec<sqlx::sqlite::SqliteRow>| -> Result<QueryResult> {
                                                    Ok(process_rows!(r, common))
                                                };
                                                converter(rows).unwrap_or(QueryResult {
                                                    columns: vec![],
                                                    rows: vec![],
                                                    rows_affected: 0,
                                                })
                                            };
                                            return Ok(Some(RelationMatch {
                                                table_name: table_name_clone,
                                                column_name: col_name_clone,
                                                is_primary_key: is_pk > 0,
                                                count: count as u64,
                                                sample_rows,
                                            }));
                                        }
                                    }
                                }
                                Ok(None)
                            });
                        }
                    }
                }

                while let Some(res) = set.join_next().await {
                    if let Ok(Ok(Some(relation_match))) = res {
                        matches.push(relation_match);
                    }
                }
            }
            DatabasePool::Postgres(pool) => {
                // Fetch columns of all user tables in postgres in a single query
                let cols_query = r#"
                    SELECT
                      cls.relname AS table_name,
                      a.attname AS column_name,
                      pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
                      CASE WHEN pk.attname IS NOT NULL THEN true ELSE false END AS is_pk,
                      ns.nspname AS schema_name
                    FROM pg_attribute a
                    JOIN pg_class cls ON cls.oid = a.attrelid
                    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
                    LEFT JOIN (
                      SELECT co.conrelid, att.attname
                      FROM pg_constraint co
                      JOIN pg_attribute att ON att.attrelid = co.conrelid AND att.attnum = ANY(co.conkey)
                      WHERE co.contype = 'p'
                    ) pk ON pk.conrelid = a.attrelid AND pk.attname = a.attname
                    WHERE a.attnum > 0
                      AND NOT a.attisdropped
                      AND cls.relkind = 'r'
                      AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
                      AND ns.nspname NOT LIKE 'pg_toast%'
                    ORDER BY cls.relname, a.attnum
                "#;
                
                let col_rows = sqlx::query(cols_query).fetch_all(pool).await?;

                let mut table_names = std::collections::HashSet::new();
                for row in &col_rows {
                    let table_name: String = row.try_get(0).unwrap_or_default();
                    table_names.insert(table_name);
                }

                let mut set: tokio::task::JoinSet<Result<Option<RelationMatch>>> = tokio::task::JoinSet::new();
                let sem = std::sync::Arc::new(tokio::sync::Semaphore::new(5));

                for row in col_rows {
                    let table_name: String = row.try_get(0).unwrap_or_default();
                    let col_name: String = row.try_get(1).unwrap_or_default();
                    let col_type: String = row.try_get(2).unwrap_or_default();
                    let is_pk: bool = row.try_get(3).unwrap_or(false);
                    let schema_name: String = row.try_get(4).unwrap_or_default();
                    
                    let col_type_lower = col_type.to_lowercase();
                    let col_name_lower = col_name.to_lowercase();

                    // Check table names matching (including singular/plural)
                    let mut matches_table_name = false;
                    for t_name in &table_names {
                        let t_name_lower = t_name.to_lowercase();
                        if col_name_lower == t_name_lower || 
                           col_name_lower == format!("{}s", t_name_lower) ||
                           t_name_lower == format!("{}s", col_name_lower) {
                            matches_table_name = true;
                            break;
                        }
                    }
                    
                    // Postgres type safety: only query compatible columns
                    let is_candidate = if is_pk {
                        true
                    } else if matches_table_name {
                        true
                    } else if is_uuid {
                        col_type_lower.contains("uuid") || 
                        ((col_type_lower.contains("text") || col_type_lower.contains("char") || col_type_lower.contains("varchar")) && is_identifier_name(&col_name))
                    } else if is_numeric {
                        ((col_type_lower.contains("int") || col_type_lower.contains("num") || col_type_lower.contains("double") || col_type_lower.contains("real") || col_type_lower.contains("serial")) && (is_identifier_name(&col_name) || col_name_lower == "id" || col_name_lower.ends_with("id"))) ||
                        ((col_type_lower.contains("text") || col_type_lower.contains("char") || col_type_lower.contains("varchar")) && is_identifier_name(&col_name))
                    } else {
                        (col_type_lower.contains("text") || col_type_lower.contains("char") || col_type_lower.contains("varchar")) && is_identifier_name(&col_name)
                    };
                    
                    if is_candidate {
                        let pool_clone = pool.clone();
                        let schema_name_clone = schema_name.clone();
                        let table_name_clone = table_name.clone();
                        let col_name_clone = col_name.clone();
                        let clean_value_clone = clean_value.to_string();

                        let count_query = if col_type_lower.contains("uuid") {
                            format!(
                                "SELECT COUNT(*) FROM \"{}\".\"{}\" WHERE \"{}\" = $1::uuid",
                                schema_name.replace('"', "\"\""),
                                table_name.replace('"', "\"\""),
                                col_name.replace('"', "\"\"")
                            )
                        } else if col_type_lower.contains("int") || col_type_lower.contains("serial") {
                            format!(
                                "SELECT COUNT(*) FROM \"{}\".\"{}\" WHERE \"{}\" = $1::bigint",
                                schema_name.replace('"', "\"\""),
                                table_name.replace('"', "\"\""),
                                col_name.replace('"', "\"\"")
                            )
                        } else {
                            format!(
                                "SELECT COUNT(*) FROM \"{}\".\"{}\" WHERE \"{}\" = $1",
                                schema_name.replace('"', "\"\""),
                                table_name.replace('"', "\"\""),
                                col_name.replace('"', "\"\"")
                            )
                        };

                        let sample_query = if col_type_lower.contains("uuid") {
                            format!(
                                "SELECT * FROM \"{}\".\"{}\" WHERE \"{}\" = $1::uuid LIMIT 10",
                                schema_name.replace('"', "\"\""),
                                table_name.replace('"', "\"\""),
                                col_name.replace('"', "\"\"")
                            )
                        } else if col_type_lower.contains("int") || col_type_lower.contains("serial") {
                            format!(
                                "SELECT * FROM \"{}\".\"{}\" WHERE \"{}\" = $1::bigint LIMIT 10",
                                schema_name.replace('"', "\"\""),
                                table_name.replace('"', "\"\""),
                                col_name.replace('"', "\"\"")
                            )
                        } else {
                            format!(
                                "SELECT * FROM \"{}\".\"{}\" WHERE \"{}\" = $1 LIMIT 10",
                                schema_name.replace('"', "\"\""),
                                table_name.replace('"', "\"\""),
                                col_name.replace('"', "\"\"")
                            )
                        };

                        let sem_clone = sem.clone();
                        set.spawn(async move {
                            let _permit = sem_clone.acquire().await.unwrap();
                            // Check count
                            if let Ok(count_row) = sqlx::query(&count_query).bind(&clean_value_clone).fetch_one(&pool_clone).await {
                                let count: i64 = count_row.try_get(0).unwrap_or(0);
                                if count > 0 {
                                    // Fetch sample rows
                                    if let Ok(rows) = sqlx::query(&sample_query).bind(&clean_value_clone).fetch_all(&pool_clone).await {
                                        let sample_rows = {
                                            let converter = |r: Vec<sqlx::postgres::PgRow>| -> Result<QueryResult> {
                                                Ok(process_rows!(r, postgres))
                                            };
                                            converter(rows).unwrap_or(QueryResult {
                                                columns: vec![],
                                                rows: vec![],
                                                rows_affected: 0,
                                            })
                                        };
                                        return Ok(Some(RelationMatch {
                                            table_name: format!("{}.{}", schema_name_clone, table_name_clone),
                                            column_name: col_name_clone,
                                            is_primary_key: is_pk,
                                            count: count as u64,
                                            sample_rows,
                                        }));
                                    }
                                }
                            }
                            Ok(None)
                        });
                    }
                }

                while let Some(res) = set.join_next().await {
                    if let Ok(Ok(Some(relation_match))) = res {
                        matches.push(relation_match);
                    }
                }
            }
            DatabasePool::MySql(pool) => {
                // Fetch columns for MySQL
                let cols_query = r#"
                    SELECT
                      TABLE_NAME,
                      COLUMN_NAME,
                      DATA_TYPE,
                      IF(COLUMN_KEY = 'PRI', 1, 0) as is_pk
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                    ORDER BY TABLE_NAME, ORDINAL_POSITION
                "#;
                
                let col_rows = sqlx::query(cols_query).fetch_all(pool).await?;

                let mut table_names = std::collections::HashSet::new();
                for row in &col_rows {
                    let table_name: String = row.try_get(0).unwrap_or_default();
                    table_names.insert(table_name);
                }

                let mut set: tokio::task::JoinSet<Result<Option<RelationMatch>>> = tokio::task::JoinSet::new();
                let sem = std::sync::Arc::new(tokio::sync::Semaphore::new(5));

                for row in col_rows {
                    let table_name: String = row.try_get(0).unwrap_or_default();
                    let col_name: String = row.try_get(1).unwrap_or_default();
                    let col_type: String = row.try_get(2).unwrap_or_default();
                    let is_pk: i64 = row.try_get(3).unwrap_or(0);
                    
                    let col_type_lower = col_type.to_lowercase();
                    let col_name_lower = col_name.to_lowercase();

                    // Check table names matching (including singular/plural)
                    let mut matches_table_name = false;
                    for t_name in &table_names {
                        let t_name_lower = t_name.to_lowercase();
                        if col_name_lower == t_name_lower || 
                           col_name_lower == format!("{}s", t_name_lower) ||
                           t_name_lower == format!("{}s", col_name_lower) {
                            matches_table_name = true;
                            break;
                        }
                    }
                    
                    let is_candidate = if is_pk > 0 {
                        true
                    } else if matches_table_name {
                        true
                    } else if is_uuid {
                        col_type_lower.contains("char") || col_type_lower.contains("varchar") || col_type_lower.contains("text")
                    } else if is_numeric {
                        ((col_type_lower.contains("int") || col_type_lower.contains("num") || col_type_lower.contains("decimal")) && (is_identifier_name(&col_name) || col_name_lower == "id" || col_name_lower.ends_with("id"))) ||
                        ((col_type_lower.contains("char") || col_type_lower.contains("varchar") || col_type_lower.contains("text")) && is_identifier_name(&col_name))
                    } else {
                        (col_type_lower.contains("char") || col_type_lower.contains("varchar") || col_type_lower.contains("text")) && is_identifier_name(&col_name)
                    };
                    
                    if is_candidate {
                        let pool_clone = pool.clone();
                        let table_name_clone = table_name.clone();
                        let col_name_clone = col_name.clone();
                        let clean_value_clone = clean_value.to_string();

                        let sem_clone = sem.clone();
                        set.spawn(async move {
                            let _permit = sem_clone.acquire().await.unwrap();
                            // Check count using backticks for MySQL identifiers
                            let count_query = format!(
                                "SELECT COUNT(*) FROM `{}` WHERE `{}` = ?",
                                table_name_clone.replace('`', "``"),
                                col_name_clone.replace('`', "``")
                            );
                            
                            if let Ok(count_row) = sqlx::query(&count_query).bind(&clean_value_clone).fetch_one(&pool_clone).await {
                                let count: i64 = count_row.try_get(0).unwrap_or(0);
                                if count > 0 {
                                    // Fetch sample rows
                                    let sample_query = format!(
                                        "SELECT * FROM `{}` WHERE `{}` = ? LIMIT 10",
                                        table_name_clone.replace('`', "``"),
                                        col_name_clone.replace('`', "``")
                                    );
                                    if let Ok(rows) = sqlx::query(&sample_query).bind(&clean_value_clone).fetch_all(&pool_clone).await {
                                        let sample_rows = {
                                            let converter = |r: Vec<sqlx::mysql::MySqlRow>| -> Result<QueryResult> {
                                                Ok(process_rows!(r, common))
                                            };
                                            converter(rows).unwrap_or(QueryResult {
                                                columns: vec![],
                                                rows: vec![],
                                                rows_affected: 0,
                                            })
                                        };
                                        return Ok(Some(RelationMatch {
                                            table_name: table_name_clone,
                                            column_name: col_name_clone,
                                            is_primary_key: is_pk > 0,
                                            count: count as u64,
                                            sample_rows,
                                        }));
                                    }
                                }
                            }
                            Ok(None)
                        });
                    }
                }

                while let Some(res) = set.join_next().await {
                    if let Ok(Ok(Some(relation_match))) = res {
                        matches.push(relation_match);
                    }
                }
            }
            DatabasePool::MongoDB { .. } => {}
            DatabasePool::ClickHouse { .. } => {}
            DatabasePool::LibSQL { .. } | DatabasePool::CloudflareD1 { .. } | DatabasePool::Redis { .. } => {}
        }

        Ok(matches)
    }

    pub async fn get_relation_rows(
        &self,
        connection_id: &str,
        table_name: &str,
        column_name: &str,
        value: &str,
        page: u32,
        page_size: u32,
        _db_type: &DatabaseType,
    ) -> Result<QueryResult> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        let limit = page_size;
        let offset = (page.saturating_sub(1)) * page_size;
        let clean_value = value.trim();

        match pool {
            DatabasePool::Sqlite(pool) => {
                let query = format!(
                    "SELECT * FROM \"{}\" WHERE \"{}\" = ? LIMIT ? OFFSET ?",
                    table_name.replace('"', "\"\""),
                    column_name.replace('"', "\"\"")
                );
                
                let rows = sqlx::query(&query)
                    .bind(clean_value)
                    .bind(limit as i64)
                    .bind(offset as i64)
                    .fetch_all(pool)
                    .await?;
                
                let converter = |r: Vec<sqlx::sqlite::SqliteRow>| -> Result<QueryResult> {
                    Ok(process_rows!(r, common))
                };
                converter(rows)
            }
            DatabasePool::Postgres(pool) => {
                // Determine schema name and table name
                let parts: Vec<&str> = table_name.split('.').collect();
                let (schema, table) = if parts.len() == 2 {
                    (parts[0], parts[1])
                } else {
                    ("public", table_name)
                };

                // Fetch column type
                let col_query = r#"
                    SELECT data_type 
                    FROM information_schema.columns 
                    WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
                "#;
                let col_type_row = sqlx::query(col_query)
                    .bind(schema)
                    .bind(table)
                    .bind(column_name)
                    .fetch_optional(pool)
                    .await?;
                
                let col_type = col_type_row
                    .map(|r| r.try_get::<String, _>(0).unwrap_or_default())
                    .unwrap_or_default();
                
                let col_type_lower = col_type.to_lowercase();

                let query = if col_type_lower.contains("uuid") {
                    format!(
                        "SELECT * FROM \"{}\".\"{}\" WHERE \"{}\" = $1::uuid LIMIT $2 OFFSET $3",
                        schema.replace('"', "\"\""),
                        table.replace('"', "\"\""),
                        column_name.replace('"', "\"\"")
                    )
                } else if col_type_lower.contains("int") || col_type_lower.contains("serial") {
                    format!(
                        "SELECT * FROM \"{}\".\"{}\" WHERE \"{}\" = $1::bigint LIMIT $2 OFFSET $3",
                        schema.replace('"', "\"\""),
                        table.replace('"', "\"\""),
                        column_name.replace('"', "\"\"")
                    )
                } else {
                    format!(
                        "SELECT * FROM \"{}\".\"{}\" WHERE \"{}\" = $1 LIMIT $2 OFFSET $3",
                        schema.replace('"', "\"\""),
                        table.replace('"', "\"\""),
                        column_name.replace('"', "\"\"")
                    )
                };

                let rows = sqlx::query(&query)
                    .bind(clean_value)
                    .bind(limit as i64)
                    .bind(offset as i64)
                    .fetch_all(pool)
                    .await?;

                let converter = |r: Vec<sqlx::postgres::PgRow>| -> Result<QueryResult> {
                    Ok(process_rows!(r, postgres))
                };
                converter(rows)
            }
            DatabasePool::MySql(pool) => {
                let query = format!(
                    "SELECT * FROM `{}` WHERE `{}` = ? LIMIT ? OFFSET ?",
                    table_name.replace('`', "``"),
                    column_name.replace('`', "``")
                );
                
                let rows = sqlx::query(&query)
                    .bind(clean_value)
                    .bind(limit as i64)
                    .bind(offset as i64)
                    .fetch_all(pool)
                    .await?;

                let converter = |r: Vec<sqlx::mysql::MySqlRow>| -> Result<QueryResult> {
                    Ok(process_rows!(r, common))
                };
                converter(rows)
            }
            DatabasePool::MongoDB { client, database } => {
                let query = format!("db.{}.find({{\"{}\": \"{}\"}})", table_name, column_name, clean_value);
                Self::mongo_execute_shell(client, database, &query).await
            }
            DatabasePool::ClickHouse { client, url, database } => {
                let query = format!(
                    "SELECT * FROM {} WHERE {} = '{}' LIMIT {} OFFSET {}",
                    table_name,
                    column_name,
                    clean_value.replace('\'', "''"),
                    limit,
                    offset
                );
                Self::clickhouse_http_query(client, url, database, &query).await
            }
            DatabasePool::LibSQL { client, url, token } => {
                let query = format!(
                    "SELECT * FROM \"{}\" WHERE \"{}\" = '{}' LIMIT {} OFFSET {}",
                    table_name.replace('"', "\"\""),
                    column_name.replace('"', "\"\""),
                    clean_value.replace('\'', "''"),
                    limit,
                    offset
                );
                Self::libsql_http_pipeline(client, url, token, &query).await
            }
            DatabasePool::CloudflareD1 { client, account_id, database_id, api_token } => {
                let query = format!(
                    "SELECT * FROM \"{}\" WHERE \"{}\" = '{}' LIMIT {} OFFSET {}",
                    table_name.replace('"', "\"\""),
                    column_name.replace('"', "\"\""),
                    clean_value.replace('\'', "''"),
                    limit,
                    offset
                );
                Self::cloudflare_d1_query(client, account_id, database_id, api_token, &query).await
            }
            DatabasePool::Redis { client, db } => {
                Self::redis_execute_cmd(client, *db, &format!("GET {}", table_name)).await
            }
        }
    }
}

