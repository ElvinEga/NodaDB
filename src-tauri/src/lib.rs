pub mod acp;
pub mod agents;
mod commands;
mod database;
mod models;
mod ssh_tunnel;

use acp::AcpHostManager;
use agents::{AgentRegistry, AgentSessionManager};
use database::ConnectionManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let connection_manager = ConnectionManager::new();
    let agent_registry = AgentRegistry::new();
    let agent_session_manager = AgentSessionManager::new();
    let acp_manager = AcpHostManager::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(connection_manager)
        .manage(agent_registry)
        .manage(agent_session_manager)
        .manage(acp_manager)
        .invoke_handler(tauri::generate_handler![
            commands::test_connection,
            commands::connect_database,
            commands::disconnect_database,
            commands::list_tables,
            commands::get_table_structure,
            commands::execute_query,
            commands::explain_query,
            commands::insert_row,
            commands::bulk_insert_rows,
            commands::update_row,
            commands::delete_rows,
            commands::create_table,
            commands::drop_table,
            commands::alter_table_add_column,
            commands::alter_table_drop_column,
            commands::execute_transaction,
            commands::rename_table,
            commands::export_table_structure,
            commands::get_table_constraints,
            commands::get_table_indexes,
            commands::create_foreign_key,
            commands::drop_foreign_key,
            commands::list_applied_migrations,
            commands::apply_migration,
            commands::rollback_migration,
            commands::get_postgres_connection_info,
            commands::cancel_postgres_backend_query,
            commands::get_postgres_extensions,
            commands::get_postgres_table_privileges,
            commands::create_new_window,
            commands::create_window_from_label,
            commands::open_sub_window,
            commands::save_export_file,
            commands::create_export_archive,
            commands::trace_id_relations,
            commands::get_relation_rows,
            commands::detect_installed_agents,
            commands::get_agent_db_context,
            commands::run_agent_session,
            commands::stop_agent_session,
            commands::start_acp_session,
            commands::send_acp_prompt,
            commands::approve_acp_tool,
            commands::stop_acp_session,
            commands::get_acp_capabilities,
            commands::get_acp_connected_agents,
            commands::get_acp_recent_commands,
            commands::execute_acp_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
