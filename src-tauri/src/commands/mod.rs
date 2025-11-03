use crate::database::ConnectionManager;
use crate::models::{ConnectionConfig, DatabaseTable, DatabaseType, QueryResult, TableColumn, ExecutionPlan, ConnectionTestResult};
use tauri::State;

#[tauri::command]
pub async fn test_connection(
    config: ConnectionConfig,
) -> Result<ConnectionTestResult, String> {
    ConnectionManager::test_connection(config)
        .await
        .map_err(|e| format!("Connection test failed: {}", e))
}

#[tauri::command]
pub async fn connect_database(
    config: ConnectionConfig,
    manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    manager
        .connect(config.clone())
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;
    
    Ok(format!("Successfully connected to {}", config.name))
}

#[tauri::command]
pub async fn disconnect_database(
    connection_id: String,
    manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    manager
        .disconnect(&connection_id)
        .await
        .map_err(|e| format!("Failed to disconnect: {}", e))?;
    
    Ok("Successfully disconnected".to_string())
}

#[tauri::command]
pub async fn list_tables(
    connection_id: String,
    db_type: DatabaseType,
    manager: State<'_, ConnectionManager>,
) -> Result<Vec<DatabaseTable>, String> {
    manager
        .list_tables(&connection_id, &db_type)
        .await
        .map_err(|e| format!("Failed to list tables: {}", e))
}

#[tauri::command]
pub async fn get_table_structure(
    connection_id: String,
    table_name: String,
    db_type: DatabaseType,
    manager: State<'_, ConnectionManager>,
) -> Result<Vec<TableColumn>, String> {
    manager
        .get_table_structure(&connection_id, &table_name, &db_type)
        .await
        .map_err(|e| format!("Failed to get table structure: {}", e))
}

#[tauri::command]
pub async fn execute_query(
    connection_id: String,
    query: String,
    manager: State<'_, ConnectionManager>,
) -> Result<QueryResult, String> {
    manager
        .execute_query(&connection_id, &query)
        .await
        .map_err(|e| format!("Failed to execute query: {}", e))
}

#[tauri::command]
pub async fn explain_query(
    connection_id: String,
    query: String,
    analyze: bool,
    db_type: DatabaseType,
    manager: State<'_, ConnectionManager>,
) -> Result<ExecutionPlan, String> {
    manager
        .explain_query(&connection_id, &query, analyze, &db_type)
        .await
        .map_err(|e| format!("Failed to explain query: {}", e))
}

#[tauri::command]
pub async fn insert_row(
    connection_id: String,
    table_name: String,
    data: serde_json::Value,
    db_type: DatabaseType,
    manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    manager
        .insert_row(&connection_id, &table_name, data, &db_type)
        .await
        .map_err(|e| format!("Failed to insert row: {}", e))
}

#[tauri::command]
pub async fn bulk_insert_rows(
    connection_id: String,
    table_name: String,
    rows: Vec<serde_json::Value>,
    db_type: DatabaseType,
    manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    manager
        .bulk_insert_rows(&connection_id, &table_name, rows, &db_type)
        .await
        .map_err(|e| format!("Failed to bulk insert rows: {}", e))
}

#[tauri::command]
pub async fn update_row(
    connection_id: String,
    table_name: String,
    data: serde_json::Value,
    where_clause: String,
    db_type: DatabaseType,
    manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    manager
        .update_row(&connection_id, &table_name, data, &where_clause, &db_type)
        .await
        .map_err(|e| format!("Failed to update row: {}", e))
}

#[tauri::command]
pub async fn delete_rows(
    connection_id: String,
    table_name: String,
    where_clause: String,
    manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    manager
        .delete_rows(&connection_id, &table_name, &where_clause)
        .await
        .map_err(|e| format!("Failed to delete rows: {}", e))
}

#[tauri::command]
pub async fn create_table(
    connection_id: String,
    table_name: String,
    columns: Vec<(String, String, bool, bool)>,
    db_type: DatabaseType,
    manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    manager
        .create_table(&connection_id, &table_name, columns, &db_type)
        .await
        .map_err(|e| format!("Failed to create table: {}", e))
}

#[tauri::command]
pub async fn drop_table(
    connection_id: String,
    table_name: String,
    manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    manager
        .drop_table(&connection_id, &table_name)
        .await
        .map_err(|e| format!("Failed to drop table: {}", e))
}

#[tauri::command]
pub async fn alter_table_add_column(
    connection_id: String,
    table_name: String,
    column_name: String,
    data_type: String,
    nullable: bool,
    db_type: DatabaseType,
    manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    manager
        .alter_table_add_column(&connection_id, &table_name, &column_name, &data_type, nullable, &db_type)
        .await
        .map_err(|e| format!("Failed to add column: {}", e))
}

#[tauri::command]
pub async fn alter_table_drop_column(
    connection_id: String,
    table_name: String,
    column_name: String,
    db_type: DatabaseType,
    manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    manager
        .alter_table_drop_column(&connection_id, &table_name, &column_name, &db_type)
        .await
        .map_err(|e| format!("Failed to drop column: {}", e))
}

#[tauri::command]
pub async fn execute_transaction(
    connection_id: String,
    queries: Vec<String>,
    manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    for query in queries {
        manager
            .execute_query(&connection_id, &query)
            .await
            .map_err(|e| format!("Transaction failed: {}", e))?;
    }
    Ok(format!("Successfully executed {} queries", queries.len()))
}

#[tauri::command]
pub async fn rename_table(
    connection_id: String,
    old_name: String,
    new_name: String,
    db_type: DatabaseType,
    manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    manager
        .rename_table(&connection_id, &old_name, &new_name, &db_type)
        .await
        .map_err(|e| format!("Failed to rename table: {}", e))
}

#[tauri::command]
pub async fn export_table_structure(
    connection_id: String,
    table_name: String,
    db_type: DatabaseType,
    manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    manager
        .export_table_structure(&connection_id, &table_name, &db_type)
        .await
        .map_err(|e| format!("Failed to export table structure: {}", e))
}
