use crate::agents::adapter::AgentDbContext;
use crate::database::ConnectionManager;
use crate::models::DatabaseType;
use anyhow::Result;

pub async fn build_agent_db_context(
    manager: &ConnectionManager,
    connection_id: &str,
    db_type: &DatabaseType,
    active_table: Option<String>,
    custom_instructions: Option<String>,
) -> Result<AgentDbContext> {
    let tables = manager.list_tables(connection_id, db_type).await.unwrap_or_default();

    let mut tables_summary = String::new();
    tables_summary.push_str(&format!("Total Tables / Views: {}\n\n", tables.len()));

    for t in tables.iter().take(40) {
        let rows_str = t.row_count.map(|r| format!(" (approx {} rows)", r)).unwrap_or_default();
        let type_str = t.table_type.as_deref().unwrap_or("TABLE");
        tables_summary.push_str(&format!("- `{}` [{}] {}\n", t.name, type_str, rows_str));
    }

    if tables.len() > 40 {
        tables_summary.push_str(&format!("\n... and {} more tables.\n", tables.len() - 40));
    }

    // If active table is specified, get its detailed structure and DDL
    let mut schema_ddl = None;
    if let Some(ref table_name) = active_table {
        if let Ok(ddl) = manager.export_table_structure(connection_id, table_name, db_type).await {
            schema_ddl = Some(ddl);
        } else if let Ok(cols) = manager.get_table_structure(connection_id, table_name, db_type).await {
            let mut summary = format!("Table: {}\nColumns:\n", table_name);
            for c in cols {
                let pk = if c.is_primary_key { " [PRIMARY KEY]" } else { "" };
                let null = if c.is_nullable { "NULL" } else { "NOT NULL" };
                summary.push_str(&format!("  - {} {}{}, {}\n", c.name, c.normalized_type, pk, null));
            }
            schema_ddl = Some(summary);
        }
    }

    let db_type_str = format!("{:?}", db_type);

    Ok(AgentDbContext {
        connection_name: connection_id.to_string(),
        db_type: db_type_str,
        host: None,
        database: None,
        tables_summary,
        active_table,
        schema_ddl,
        custom_instructions,
    })
}
