pub mod types;

use crate::models::{ColumnTypeFamily, ConnectionConfig, ConnectionTestResult, DatabaseTable, DatabaseType, ExecutionPlan, PlanStep, PostgresConnectionInfo, PostgresExtension, PostgresTablePrivileges, QueryResult, TableColumn, TableConstraint, TableIndex};
use crate::ssh_tunnel::SshTunnel;
use self::types::{classify_mysql_type, classify_postgres_type, classify_sqlite_type, normalize_type_name};
use anyhow::{anyhow, Result};
use base64::Engine;
use sqlx::{Row, TypeInfo, Column};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{NaiveDateTime, NaiveDate, NaiveTime, DateTime, Utc};

pub enum DatabasePool {
    Sqlite(sqlx::SqlitePool),
    Postgres(sqlx::PgPool),
    MySql(sqlx::MySqlPool),
}

macro_rules! process_rows {
    ($rows:expr) => {{
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
                        "NUMERIC" | "DECIMAL" | "MONEY" => row
                            .try_get::<Option<String>, _>(idx)
                            .map(|v| v.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null))
                            .or_else(|_| {
                                row.try_get::<Option<f64>, _>(idx).map(|v| {
                                    v.map(|n| serde_json::json!(n))
                                        .unwrap_or(serde_json::Value::Null)
                                })
                            })
                            .unwrap_or(serde_json::Value::Null),
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
                let path = config
                    .file_path
                    .as_ref()
                    .ok_or_else(|| anyhow!("SQLite file path is required"))?;
                let connection_string = format!("sqlite://{}", path);
                let pool = sqlx::SqlitePool::connect(&connection_string).await?;
                DatabasePool::Sqlite(pool)
            }
            DatabaseType::PostgreSQL => {
                let username = config.username.as_ref().ok_or_else(|| anyhow!("Username is required"))?;
                let password = config.password.as_ref().ok_or_else(|| anyhow!("Password is required"))?;
                let database = config.database.as_ref().ok_or_else(|| anyhow!("Database is required"))?;

                let connection_string = format!(
                    "postgresql://{}:{}@{}:{}/{}",
                    username, password, actual_host, actual_port, database
                );
                let pool = sqlx::PgPool::connect(&connection_string).await?;
                DatabasePool::Postgres(pool)
            }
            DatabaseType::MySQL => {
                let username = config.username.as_ref().ok_or_else(|| anyhow!("Username is required"))?;
                let password = config.password.as_ref().ok_or_else(|| anyhow!("Password is required"))?;
                let database = config.database.as_ref().ok_or_else(|| anyhow!("Database is required"))?;

                let connection_string = format!(
                    "mysql://{}:{}@{}:{}/{}",
                    username, password, actual_host, actual_port, database
                );
                let pool = sqlx::MySqlPool::connect(&connection_string).await?;
                DatabasePool::MySql(pool)
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
            DatabaseType::PostgreSQL => {
                let username = config.username.as_ref().ok_or_else(|| anyhow!("Username is required"))?;
                let password = config.password.as_ref().ok_or_else(|| anyhow!("Password is required"))?;
                let database = config.database.as_ref().ok_or_else(|| anyhow!("Database is required"))?;

                let connection_string = format!(
                    "postgresql://{}:{}@{}:{}/{}",
                    username, password, actual_host, actual_port, database
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
                let password = config.password.as_ref().ok_or_else(|| anyhow!("Password is required"))?;
                let database = config.database.as_ref().ok_or_else(|| anyhow!("Database is required"))?;

                let connection_string = format!(
                    "mysql://{}:{}@{}:{}/{}",
                    username, password, actual_host, actual_port, database
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
                        ROUND((data_length + index_length) / 1024, 0) as size_kb
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
                        let size_kb: Option<i64> = row.try_get::<Option<f64>, _>(3).ok().flatten().map(|v| v as i64);
                        
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
            DatabaseType::SQLite => {
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
        };

        let columns = match pool {
            DatabasePool::Sqlite(pool) => {
                let rows = sqlx::query(&query).fetch_all(pool).await?;
                rows.into_iter()
                    .map(|row| {
                        let name: String = row.try_get(1).unwrap_or_default();
                        let data_type: String = row.try_get(2).unwrap_or_default();
                        let not_null: i64 = row.try_get(3).unwrap_or(0);
                        let default_value: Option<String> = row.try_get(4).ok();
                        let is_pk: i64 = row.try_get(5).unwrap_or(0);
                        let family = classify_sqlite_type(&data_type);

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
                      CASE WHEN pk.attname IS NOT NULL THEN true ELSE false END AS is_primary_key,
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
                    LEFT JOIN pg_attrdef def
                      ON def.adrelid = att.attrelid
                     AND def.adnum = att.attnum
                    LEFT JOIN pg_collation col ON col.oid = att.attcollation
                    LEFT JOIN (
                      SELECT a.attname
                      FROM pg_index i
                      JOIN pg_attribute a
                        ON a.attrelid = i.indrelid
                       AND a.attnum = ANY(i.indkey)
                      WHERE i.indrelid = to_regclass($1)
                        AND i.indisprimary
                    ) pk ON pk.attname = att.attname
                    WHERE cls.oid = to_regclass($1)
                      AND att.attnum > 0
                      AND NOT att.attisdropped
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
                        let _type_schema: String = row.try_get(3).unwrap_or_default();
                        let type_kind: String = row.try_get(4).unwrap_or_default();
                        let _type_category: String = row.try_get(5).unwrap_or_default();
                        let not_null: bool = row.try_get(6).unwrap_or(false);
                        let default_value: Option<String> = row.try_get(7).ok();
                        let is_primary_key: bool = row.try_get(8).unwrap_or(false);
                        let is_array: bool = row.try_get(9).unwrap_or(false);
                        let array_dimensions: Option<i32> = row.try_get(10).ok();
                        let element_raw_type: Option<String> = row.try_get(11).ok();
                        let enum_values: Option<Vec<String>> = row.try_get(12).ok().flatten();
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
                Ok(process_rows!(rows))
            }
            DatabasePool::Postgres(pool) => {
                let rows = sqlx::query(query)
                    .fetch_all(pool)
                    .await
                    .map_err(Self::format_sqlx_error)?;
                Ok(process_rows!(rows))
            }
            DatabasePool::MySql(pool) => {
                let rows = sqlx::query(query)
                    .fetch_all(pool)
                    .await
                    .map_err(Self::format_sqlx_error)?;
                Ok(process_rows!(rows))
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

        let mut column_defs: Vec<String> = Vec::new();
        let mut primary_keys: Vec<String> = Vec::new();

        for (name, data_type, nullable, is_pk) in columns {
            let mut col_def = format!("{} {}", name, data_type);
            
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

        let nullable_clause = if nullable { "" } else { " NOT NULL" };
        
        let query = match db_type {
            DatabaseType::SQLite => {
                // SQLite doesn't support NOT NULL in ALTER TABLE ADD COLUMN without default
                format!("ALTER TABLE {} ADD COLUMN {} {}", table_name, column_name, data_type)
            }
            _ => {
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

        let query = match db_type {
            DatabaseType::SQLite => {
                // SQLite doesn't support DROP COLUMN directly
                return Err(anyhow!("SQLite does not support dropping columns directly. Please recreate the table."));
            }
            _ => {
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

        let query = match db_type {
            DatabaseType::SQLite => format!("ALTER TABLE {} RENAME TO {}", old_name, new_name),
            DatabaseType::MySQL => format!("RENAME TABLE {} TO {}", old_name, new_name),
            DatabaseType::PostgreSQL => {
                let quoted_old = Self::quote_pg_table(old_name);
                let quoted_new = Self::quote_pg_ident(new_name);
                format!("ALTER TABLE {} RENAME TO {}", quoted_old, quoted_new)
            }
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
        }

        Ok(total_rows_affected)
    }

    pub async fn get_table_constraints(
        &self,
        connection_id: &str,
        table_name: &str,
        db_type: &DatabaseType,
    ) -> Result<Vec<TableConstraint>> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        if !matches!(db_type, DatabaseType::PostgreSQL) {
            return Ok(vec![]);
        }

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
              CASE WHEN c.contype = 'c' THEN pg_get_constraintdef(c.oid, true) ELSE NULL END AS check_expr,
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

        let constraints = match pool {
            DatabasePool::Postgres(pool) => {
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
            _ => vec![],
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
            
            if i < columns.len() - 1 || !primary_keys.is_empty() {
                sql.push(',');
            }
            sql.push('\n');
        }
        
        // Add primary key constraint
        if !primary_keys.is_empty() {
            sql.push_str("  PRIMARY KEY (");
            sql.push_str(&primary_keys.join(", "));
            sql.push_str(")\n");
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
            DatabaseType::SQLite => {
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
            DatabaseType::SQLite => {
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
        };

        let indexes = match pool {
            DatabasePool::Sqlite(pool) => {
                let rows = sqlx::query(&query).fetch_all(pool).await?;
                let mut index_sqls = Vec::new();
                
                for row in rows {
                    let index_name: String = row.try_get(1).unwrap_or_default();
                    let is_unique: i64 = row.try_get(2).unwrap_or(0);
                    
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
        };

        Ok(indexes)
    }
}
