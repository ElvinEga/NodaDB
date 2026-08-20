use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub binary_name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub capabilities: Vec<String>,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDbContext {
    pub connection_name: String,
    pub db_type: String,
    pub host: Option<String>,
    pub database: Option<String>,
    pub tables_summary: String,
    pub active_table: Option<String>,
    pub schema_ddl: Option<String>,
    pub custom_instructions: Option<String>,
}

impl AgentDbContext {
    pub fn to_prompt_context(&self) -> String {
        let mut out = String::new();
        out.push_str("# Database Context (provided by NodaDB)\n\n");
        out.push_str(&format!("- **Database Type**: {}\n", self.db_type));
        out.push_str(&format!("- **Connection**: {}\n", self.connection_name));
        if let Some(ref db) = self.database {
            out.push_str(&format!("- **Database / Schema**: {}\n", db));
        }
        if let Some(ref host) = self.host {
            out.push_str(&format!("- **Host**: {}\n", host));
        }
        if let Some(ref tbl) = self.active_table {
            out.push_str(&format!("- **Active Table in View**: {}\n", tbl));
        }
        out.push_str("\n## Tables & Structure\n\n");
        out.push_str(&self.tables_summary);

        if let Some(ref ddl) = self.schema_ddl {
            out.push_str("\n\n## Schema DDL\n\n```sql\n");
            out.push_str(ddl);
            out.push_str("\n```\n");
        }

        out.push_str("\n## NodaDB Commands Available\n");
        out.push_str("You can suggest the user execute NodaDB slash commands, such as:\n");
        out.push_str("- `/query <sql>`: execute SQL query in editor\n");
        out.push_str("- `/explain <sql>`: explain execution plan\n");
        out.push_str("- `/schema <table_name>`: view visual schema & ERD\n");
        out.push_str("- `/flow <entity_or_id>`: trace foreign key relations\n");
        out.push_str("- `/table <table_name>`: inspect columns, indexes & constraints\n");

        if let Some(ref custom) = self.custom_instructions {
            out.push_str("\n## Additional Instructions\n\n");
            out.push_str(custom);
        }

        out
    }
}

pub trait AgentAdapter: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn binary_name(&self) -> &str;
    fn description(&self) -> &str;
    fn detect(&self) -> Result<AgentInfo>;
    fn build_command(&self, prompt: &str, context: &AgentDbContext) -> Result<tokio::process::Command>;
    fn capabilities(&self) -> Vec<String>;
}

/// Helper function to check if a binary exists in PATH and return its path
pub fn find_binary_in_path(name: &str) -> Option<String> {
    let output = std::process::Command::new("which")
        .arg(name)
        .output()
        .ok()?;

    if output.status.success() {
        let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path_str.is_empty() {
            return Some(path_str);
        }
    }

    // Common standard locations check
    let home = std::env::var("HOME").unwrap_or_default();
    let candidates = [
        format!("{}/.local/bin/{}", home, name),
        format!("{}/.bun/bin/{}", home, name),
        format!("{}/.cargo/bin/{}", home, name),
        format!("/opt/homebrew/bin/{}", name),
        format!("/usr/local/bin/{}", name),
        format!("/usr/bin/{}", name),
    ];

    for candidate in candidates {
        if std::path::Path::new(&candidate).is_file() {
            return Some(candidate);
        }
    }

    None
}
