use crate::models::{ConnectionConfig, DatabaseTable, DatabaseType, QueryResult, TableColumn};
use anyhow::{anyhow, Result};
use sqlx::{AnyPool, Column, Row, TypeInfo};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct ConnectionManager {
    connections: Arc<RwLock<HashMap<String, AnyPool>>>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    fn build_connection_string(config: &ConnectionConfig) -> Result<String> {
        match config.db_type {
            DatabaseType::SQLite => {
                let path = config
                    .file_path
                    .as_ref()
                    .ok_or_else(|| anyhow!("SQLite file path is required"))?;
                Ok(format!("sqlite://{}", path))
            }
            DatabaseType::PostgreSQL => {
                let host = config.host.as_ref().ok_or_else(|| anyhow!("Host is required"))?;
                let port = config.port.ok_or_else(|| anyhow!("Port is required"))?;
                let username = config.username.as_ref().ok_or_else(|| anyhow!("Username is required"))?;
                let password = config.password.as_ref().ok_or_else(|| anyhow!("Password is required"))?;
                let database = config.database.as_ref().ok_or_else(|| anyhow!("Database is required"))?;
                Ok(format!(
                    "postgresql://{}:{}@{}:{}/{}",
                    username, password, host, port, database
                ))
            }
            DatabaseType::MySQL => {
                let host = config.host.as_ref().ok_or_else(|| anyhow!("Host is required"))?;
                let port = config.port.ok_or_else(|| anyhow!("Port is required"))?;
                let username = config.username.as_ref().ok_or_else(|| anyhow!("Username is required"))?;
                let password = config.password.as_ref().ok_or_else(|| anyhow!("Password is required"))?;
                let database = config.database.as_ref().ok_or_else(|| anyhow!("Database is required"))?;
                Ok(format!(
                    "mysql://{}:{}@{}:{}/{}",
                    username, password, host, port, database
                ))
            }
        }
    }

    pub async fn connect(&self, config: ConnectionConfig) -> Result<()> {
        let connection_string = Self::build_connection_string(&config)?;
        let pool = AnyPool::connect(&connection_string).await?;
        
        let mut connections = self.connections.write().await;
        connections.insert(config.id.clone(), pool);
        
        Ok(())
    }

    pub async fn disconnect(&self, connection_id: &str) -> Result<()> {
        let mut connections = self.connections.write().await;
        connections
            .remove(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;
        Ok(())
    }

    pub async fn list_tables(&self, connection_id: &str, db_type: &DatabaseType) -> Result<Vec<DatabaseTable>> {
        let connections = self.connections.read().await;
        let pool = connections
            .get(connection_id)
            .ok_or_else(|| anyhow!("Connection not found"))?;

        let query = match db_type {
            DatabaseType::SQLite => {
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            }
            DatabaseType::PostgreSQL => {
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
            }
            DatabaseType::MySQL => {
                "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name"
            }
        };

        let rows = sqlx::query(query).fetch_all(pool).await?;

        let tables = rows
            .into_iter()
            .map(|row| {
                let name: String = row.try_get(0).unwrap_or_default();
                DatabaseTable {
                    name,
                    schema: None,
                }
            })
            .collect();

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
            DatabaseType::PostgreSQL => {
                format!(
                    "SELECT column_name, data_type, is_nullable, column_default \
                     FROM information_schema.columns WHERE table_name = '{}' ORDER BY ordinal_position",
                    table_name
                )
            }
            DatabaseType::MySQL => {
                format!(
                    "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT \
                     FROM information_schema.columns WHERE table_name = '{}' AND table_schema = DATABASE() \
                     ORDER BY ORDINAL_POSITION",
                    table_name
                )
            }
        };

        let rows = sqlx::query(&query).fetch_all(pool).await?;

        let columns = match db_type {
            DatabaseType::SQLite => {
                rows.into_iter()
                    .map(|row| {
                        let name: String = row.try_get(1).unwrap_or_default();
                        let data_type: String = row.try_get(2).unwrap_or_default();
                        let not_null: i64 = row.try_get(3).unwrap_or(0);
                        let default_value: Option<String> = row.try_get(4).ok();
                        let is_pk: i64 = row.try_get(5).unwrap_or(0);

                        TableColumn {
                            name,
                            data_type,
                            is_nullable: not_null == 0,
                            default_value,
                            is_primary_key: is_pk > 0,
                        }
                    })
                    .collect()
            }
            DatabaseType::PostgreSQL | DatabaseType::MySQL => {
                rows.into_iter()
                    .map(|row| {
                        let name: String = row.try_get(0).unwrap_or_default();
                        let data_type: String = row.try_get(1).unwrap_or_default();
                        let is_nullable: String = row.try_get(2).unwrap_or_default();
                        let default_value: Option<String> = row.try_get(3).ok();

                        TableColumn {
                            name,
                            data_type,
                            is_nullable: is_nullable.to_uppercase() == "YES",
                            default_value,
                            is_primary_key: false, // TODO: Add PK detection
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

        let rows = sqlx::query(query).fetch_all(pool).await?;

        if rows.is_empty() {
            return Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                rows_affected: 0,
            });
        }

        let columns: Vec<String> = rows[0]
            .columns()
            .iter()
            .map(|col| col.name().to_string())
            .collect();

        let result_rows: Vec<serde_json::Value> = rows
            .into_iter()
            .map(|row| {
                let mut map = serde_json::Map::new();
                for (idx, col) in row.columns().iter().enumerate() {
                    let value = match col.type_info().name() {
                        "TEXT" | "VARCHAR" | "CHAR" => {
                            row.try_get::<String, _>(idx)
                                .map(|v| serde_json::Value::String(v))
                                .unwrap_or(serde_json::Value::Null)
                        }
                        "INTEGER" | "INT" | "BIGINT" => {
                            row.try_get::<i64, _>(idx)
                                .map(|v| serde_json::Value::Number(v.into()))
                                .unwrap_or(serde_json::Value::Null)
                        }
                        "REAL" | "FLOAT" | "DOUBLE" => {
                            row.try_get::<f64, _>(idx)
                                .map(|v| serde_json::json!(v))
                                .unwrap_or(serde_json::Value::Null)
                        }
                        "BOOLEAN" | "BOOL" => {
                            row.try_get::<bool, _>(idx)
                                .map(|v| serde_json::Value::Bool(v))
                                .unwrap_or(serde_json::Value::Null)
                        }
                        _ => serde_json::Value::Null,
                    };
                    map.insert(col.name().to_string(), value);
                }
                serde_json::Value::Object(map)
            })
            .collect();

        Ok(QueryResult {
            columns,
            rows: result_rows,
            rows_affected: 0,
        })
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
            table_name, column_list, value_list
        );

        sqlx::query(&query).execute(pool).await?;

        Ok(format!("Successfully inserted 1 row into {}", table_name))
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
                if v.is_null() {
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
            table_name, set_clause, where_clause
        );

        let result = sqlx::query(&query).execute(pool).await?;

        Ok(format!("Successfully updated {} row(s)", result.rows_affected()))
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
            table_name, where_clause
        );

        let result = sqlx::query(&query).execute(pool).await?;

        Ok(format!("Successfully deleted {} row(s)", result.rows_affected()))
    }
}
