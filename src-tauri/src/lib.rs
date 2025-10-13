mod commands;
mod database;
mod models;

use database::ConnectionManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let connection_manager = ConnectionManager::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(connection_manager)
        .invoke_handler(tauri::generate_handler![
            commands::connect_database,
            commands::disconnect_database,
            commands::list_tables,
            commands::get_table_structure,
            commands::execute_query,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
