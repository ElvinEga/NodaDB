use crate::models::{ConnectionConfig, DatabaseTable, DatabaseType, QueryResult, TableColumn, ExecutionPlan, PlanStep, ConnectionTestResult};
use anyhow::{anyhow, Result};
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
                    let value = match col.type_info().name() {
                        "TEXT" | "VARCHAR" | "CHAR" | "BPCHAR" => {
                            row.try_get::<String, _>(idx)
                                .map(|v| serde_json::Value::String(v))
                                .unwrap_or(serde_json::Value::Null)
                        }
                        "INTEGER" | "INT" | "BIGINT" | "INT2" | "INT4" | "INT8" => {
                            row.try_get::<i64, _>(idx)
                                .map(|v| serde_json::Value::Number(v.into()))
                                .unwrap_or(serde_json::Value::Null)
                        }
                        "REAL" | "FLOAT" | "DOUBLE" | "FLOAT4" | "FLOAT8" => {
                            row.try_get::<f64, _>(idx)
                                .map(|v| serde_json::json!(v))
                                .unwrap_or(serde_json::Value::Null)
                        }
                        "BOOLEAN" | "BOOL" => {
                            row.try_get::<bool, _>(idx)
                                .map(|v| serde_json::Value::Bool(v))
                                .unwrap_or(serde_json::Value::Null)
                        }
                        "DATETIME" | "TIMESTAMP" => {
                            row.try_get::<NaiveDateTime, _>(idx)
                                .map(|v| serde_json::Value::String(v.format("%Y-%m-%d %H:%M:%S").to_string()))
                                .unwrap_or(serde_json::Value::Null)
                        }
                        "TIMESTAMPTZ" => {
                            row.try_get::<DateTime<Utc>, _>(idx)
                                .map(|v| serde_json::Value::String(v.format("%Y-%m-%d %H:%M:%S %Z").to_string()))
                                .or_else(|_| {
                                    row.try_get::<NaiveDateTime, _>(idx)
                                        .map(|v| serde_json::Value::String(v.format("%Y-%m-%d %H:%M:%S").to_string()))
                                })
                                .unwrap_or(serde_json::Value::Null)
                        }
                        "DATE" => {
                            row.try_get::<NaiveDate, _>(idx)
                                .map(|v| serde_json::Value::String(v.format("%Y-%m-%d").to_string()))
                                .unwrap_or(serde_json::Value::Null)
                        }
                        "TIME" => {
                            row.try_get::<NaiveTime, _>(idx)
                                .map(|v| serde_json::Value::String(v.format("%H:%M:%S").to_string()))
                                .unwrap_or(serde_json::Value::Null)
                        }
                        _ => {
                            // Fallback: try to get as string
                            row.try_get::<String, _>(idx)
                                .map(|v| serde_json::Value::String(v))
                                .unwrap_or(serde_json::Value::Null)
                        }
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
            &DatabasePool::Sqlite(ref pool) => {
                sqlx::query($query).execute(pool).await?.rows_affected()
            }
            &DatabasePool::Postgres(ref pool) => {
                sqlx::query($query).execute(pool).await?.rows_affected()
            }
            &DatabasePool::MySql(ref pool) => {
                sqlx::query($query).execute(pool).await?.rows_affected()
            }
        };
        Ok::<u64, anyhow::Error>(rows_affected)
    }};
}

pub struct ConnectionManager {
    connections: Arc<RwLock<HashMap<String, DatabasePool>>>,
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
                let connection_string = Self::build_connection_string(&config)?;
                let pool = sqlx::PgPool::connect(&connection_string).await?;
                DatabasePool::Postgres(pool)
            }
            DatabaseType::MySQL => {
                let connection_string = Self::build_connection_string(&config)?;
                let pool = sqlx::MySqlPool::connect(&connection_string).await?;
                DatabasePool::MySql(pool)
            }
        };
        
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

    pub async fn test_connection(config: ConnectionConfig) -> Result<ConnectionTestResult> {
        let start = std::time::Instant::now();
        
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
                let connection_string = Self::build_connection_string(&config)?;
                
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
                let connection_string = Self::build_connection_string(&config)?;
                
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
            &DatabasePool::Sqlite(ref pool) => {
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
                        row_count,
                        size_kb: None, // SQLite doesn't easily provide per-table size
                        table_type: Some(table_type.to_uppercase()),
                    });
                }
                tables
            }
            &DatabasePool::Postgres(ref pool) => {
                // PostgreSQL: Get statistics from pg_stat_user_tables and pg_class
                let query = r#"
                    SELECT 
                        t.table_name,
                        t.table_type,
                        pg_stat.n_live_tup as row_count,
                        pg_total_relation_size(quote_ident(t.table_schema)||'.'||quote_ident(t.table_name))::bigint / 1024 as size_kb
                    FROM information_schema.tables t
                    LEFT JOIN pg_stat_user_tables pg_stat ON pg_stat.relname = t.table_name
                    WHERE t.table_schema = 'public'
                    ORDER BY t.table_name
                "#;
                let rows = sqlx::query(query).fetch_all(pool).await?;
                rows.into_iter()
                    .map(|row| {
                        let name: String = row.try_get(0).unwrap_or_default();
                        let table_type: String = row.try_get(1).unwrap_or_default();
                        let row_count: Option<i64> = row.try_get(2).ok();
                        let size_kb: Option<i64> = row.try_get(3).ok();
                        
                        DatabaseTable {
                            name,
                            schema: Some("public".to_string()),
                            row_count,
                            size_kb,
                            table_type: Some(table_type.to_uppercase()),
                        }
                    })
                    .collect()
            }
            &DatabasePool::MySql(ref pool) => {
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

        let columns = match pool {
            &DatabasePool::Sqlite(ref pool) => {
                let rows = sqlx::query(&query).fetch_all(pool).await?;
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
            &DatabasePool::Postgres(ref pool) => {
                let rows = sqlx::query(&query).fetch_all(pool).await?;
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
                            is_primary_key: false,
                        }
                    })
                    .collect()
            }
            &DatabasePool::MySql(ref pool) => {
                let rows = sqlx::query(&query).fetch_all(pool).await?;
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
                            is_primary_key: false,
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
            &DatabasePool::Sqlite(ref pool) => {
                let rows = sqlx::query(query).fetch_all(pool).await?;
                Ok(process_rows!(rows))
            }
            &DatabasePool::Postgres(ref pool) => {
                let rows = sqlx::query(query).fetch_all(pool).await?;
                Ok(process_rows!(rows))
            }
            &DatabasePool::MySql(ref pool) => {
                let rows = sqlx::query(query).fetch_all(pool).await?;
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
            (&DatabasePool::Postgres(ref pool), DatabaseType::PostgreSQL) => {
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
                
                if let Some(first_plan) = plan_array.get(0) {
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
            (&DatabasePool::MySql(ref pool), DatabaseType::MySQL) => {
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
            (&DatabasePool::Sqlite(ref pool), DatabaseType::SQLite) => {
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

        let recommendations = self.generate_recommendations(&plan_steps, db_type);

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

    fn generate_recommendations(&self, plan_steps: &[PlanStep], db_type: &DatabaseType) -> Vec<String> {
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
            for rec in self.generate_recommendations(&step.children, db_type) {
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
            table_name, column_list, value_list
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
            table_name,
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
            table_name, where_clause
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
            table_name,
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

        let query = format!("DROP TABLE {}", table_name);

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
                format!("ALTER TABLE {} ADD COLUMN {} {}{}", 
                    table_name, column_name, data_type, nullable_clause)
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
                format!("ALTER TABLE {} DROP COLUMN {}", table_name, column_name)
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
            DatabaseType::PostgreSQL => format!("ALTER TABLE {} RENAME TO {}", old_name, new_name),
        };

        execute_query!(pool, &query)?;

        Ok(format!("Successfully renamed table {} to {}", old_name, new_name))
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
                        .or_insert_with(Vec::new)
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
