use crate::database::ConnectionManager;
use crate::models::{ConnectionConfig, DatabaseTable, DatabaseType, QueryResult, TableColumn};
use tauri::State;

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
pub async fn open_file_dialog() -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    
    // This will be called from the app handle in lib.rs
    // For now, return placeholder
    Ok(None)
}
