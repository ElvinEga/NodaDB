use serde::{Deserialize, Deserializer, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseType {
    SQLite,
    PostgreSQL,
    MySQL,
    MongoDB,
    ClickHouse,
    LibSQL,
    Redis,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MariaDBAuthMethod {
    Password,
    AwsIam,
    AzureAd,
    GcpIam,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ColumnTypeFamily {
    Boolean,
    Integer,
    Float,
    Decimal,
    Text,
    DateTime,
    Date,
    Time,
    Json,
    Uuid,
    Binary,
    Enum,
    Array,
    Network,
    Range,
    FullText,
    Extension,
    Domain,
    Custom,
    Unknown,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SSHAuthMethod {
    Password,
    #[serde(alias = "privateKey", alias = "private_key")]
    PrivateKey,
}

impl Default for SSHAuthMethod {
    fn default() -> Self {
        Self::Password
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct SSHConfig {
    pub enabled: bool,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: SSHAuthMethod,
    pub private_key_path: Option<String>,
    pub password: Option<String>,
    pub local_port: Option<u16>,
}

impl<'de> Deserialize<'de> for SSHConfig {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let val = serde_json::Value::deserialize(deserializer)?;
        let enabled = val.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);
        let host = val.get("host").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let port = val.get("port").and_then(|v| v.as_u64()).unwrap_or(22) as u16;
        let username = val.get("username").and_then(|v| v.as_str()).unwrap_or_default().to_string();

        let auth_str = val
            .get("auth_method")
            .or_else(|| val.get("authMethod"))
            .and_then(|v| v.as_str())
            .unwrap_or("password");
        let auth_method = match auth_str.to_lowercase().as_str() {
            "privatekey" | "private_key" => SSHAuthMethod::PrivateKey,
            _ => SSHAuthMethod::Password,
        };

        let private_key_path = val
            .get("private_key_path")
            .or_else(|| val.get("privateKeyPath"))
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());

        let password = val
            .get("password")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());

        let local_port = val
            .get("local_port")
            .or_else(|| val.get("localPort"))
            .and_then(|v| v.as_u64())
            .map(|v| v as u16);

        Ok(SSHConfig {
            enabled,
            host,
            port,
            username,
            auth_method,
            private_key_path,
            password,
            local_port,
        })
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub db_type: DatabaseType,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub database: Option<String>,
    pub file_path: Option<String>, // For SQLite
    pub ssh_config: Option<SSHConfig>,
    pub provider: Option<String>,
    pub auth_method: Option<MariaDBAuthMethod>,
    // AWS IAM
    pub aws_region: Option<String>,
    pub aws_db_user: Option<String>,
    pub aws_access_key_id: Option<String>,
    pub aws_secret_access_key: Option<String>,
    // Azure AD
    pub azure_tenant_id: Option<String>,
    // GCP IAM
    pub gcp_project: Option<String>,
    // MongoDB
    pub mongo_auth_method: Option<String>,
    pub mongo_connection_string: Option<String>,
    pub mongo_auth_source: Option<String>,
    pub mongo_database: Option<String>,
    // ClickHouse
    pub clickhouse_use_ssl: Option<bool>,
    // LibSQL / Turso / Val Town
    pub libsql_url: Option<String>,
    pub libsql_auth_token: Option<String>,
    // Redis
    pub redis_db: Option<u8>,
    // Cloudflare D1
    pub cloudflare_account_id: Option<String>,
    pub cloudflare_database_id: Option<String>,
    pub cloudflare_api_token: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DatabaseTable {
    pub name: String,
    pub schema: Option<String>,
    pub full_name: Option<String>,
    pub row_count: Option<i64>,
    pub size_kb: Option<i64>,
    pub table_type: Option<String>, // "TABLE" or "VIEW"
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TableColumn {
    pub name: String,
    pub data_type: String,
    pub raw_type: Option<String>,
    pub normalized_type: String,
    pub type_family: ColumnTypeFamily,
    pub db_type: DatabaseType,
    pub is_nullable: bool,
    pub default_value: Option<String>,
    pub is_primary_key: bool,
    pub is_boolean_like: bool,
    pub is_array: bool,
    pub enum_values: Option<Vec<String>>,
    pub identity_kind: Option<String>,
    pub generated_kind: Option<String>,
    pub generation_expression: Option<String>,
    pub column_comment: Option<String>,
    pub collation_name: Option<String>,
    pub domain_name: Option<String>,
    pub domain_schema: Option<String>,
    pub domain_base_type: Option<String>,
    pub array_dimensions: Option<i32>,
    pub element_raw_type: Option<String>,
}


#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ForeignKeyDefinition {
    pub constraint_name: String,
    pub table_name: String,
    pub column_names: Vec<String>,
    pub referenced_table_name: String,
    pub referenced_column_names: Vec<String>,
    pub on_delete: Option<String>,
    pub on_update: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AppliedMigration {
    pub id: String,
    pub name: String,
    pub applied_at: String,
    pub checksum: Option<String>,
}


#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ExportArchiveEntry {
    pub path: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<serde_json::Value>,
    pub rows_affected: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionPlan {
    pub query: String,
    pub plan_steps: Vec<PlanStep>,
    pub total_cost: Option<f64>,
    pub execution_time_ms: Option<f64>,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlanStep {
    pub step_type: String,
    pub table_name: Option<String>,
    pub rows: Option<i64>,
    pub cost: Option<f64>,
    pub filter_condition: Option<String>,
    pub index_used: Option<String>,
    pub children: Vec<PlanStep>,
}

#[derive(Debug, Serialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub latency_ms: u64,
    pub db_version: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TableConstraint {
    pub constraint_name: String,
    pub constraint_type: String,
    pub table_schema: Option<String>,
    pub table_name: String,
    pub column_names: Vec<String>,
    pub foreign_table_schema: Option<String>,
    pub foreign_table_name: Option<String>,
    pub foreign_column_names: Option<Vec<String>>,
    pub check_expression: Option<String>,
    pub is_deferrable: Option<bool>,
    pub initially_deferred: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TableIndex {
    pub index_name: String,
    pub method: Option<String>,
    pub is_unique: bool,
    pub is_primary: bool,
    pub is_valid: Option<bool>,
    pub columns: Vec<String>,
    pub expression: Option<String>,
    pub predicate: Option<String>,
    pub definition: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PostgresConnectionInfo {
    pub version: String,
    pub server_version: String,
    pub current_database: String,
    pub current_user: String,
    pub search_path: String,
    pub timezone: String,
    pub backend_pid: i32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PostgresExtension {
    pub extname: String,
    pub extversion: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PostgresTablePrivileges {
    pub can_select: bool,
    pub can_insert: bool,
    pub can_update: bool,
    pub can_delete: bool,
    pub can_truncate: bool,
    pub can_references: bool,
    pub can_trigger: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationMatch {
    pub table_name: String,
    pub column_name: String,
    pub is_primary_key: bool,
    pub count: u64,
    pub sample_rows: QueryResult,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserializes_ssh_config_camel_case() {
        let json = r#"{
            "enabled": true,
            "host": "127.0.0.1",
            "port": 22,
            "username": "root",
            "authMethod": "privateKey",
            "privateKeyPath": "/path/to/key",
            "password": null,
            "localPort": 12345
        }"#;

        let config: SSHConfig = serde_json::from_str(json).unwrap();
        assert!(config.enabled);
        assert_eq!(config.auth_method, SSHAuthMethod::PrivateKey);
        assert_eq!(config.private_key_path.as_deref(), Some("/path/to/key"));
        assert_eq!(config.local_port, Some(12345));
    }

    #[test]
    fn deserializes_ssh_config_snake_case_and_defaults() {
        let json = r#"{
            "enabled": true,
            "host": "127.0.0.1",
            "port": 22,
            "username": "ubuntu"
        }"#;

        let config: SSHConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.auth_method, SSHAuthMethod::Password);
        assert_eq!(config.private_key_path, None);
    }

    #[test]
    fn deserializes_ssh_config_with_duplicate_and_mixed_fields() {
        let json = r#"{
            "enabled": true,
            "host": "127.0.0.1",
            "port": 22,
            "username": "root",
            "authMethod": "privateKey",
            "auth_method": "privateKey",
            "privateKeyPath": "/path/to/key",
            "private_key_path": "/path/to/key",
            "password": null
        }"#;

        let config: SSHConfig = serde_json::from_str(json).unwrap();
        assert!(config.enabled);
        assert_eq!(config.auth_method, SSHAuthMethod::PrivateKey);
        assert_eq!(config.private_key_path.as_deref(), Some("/path/to/key"));
    }
}


