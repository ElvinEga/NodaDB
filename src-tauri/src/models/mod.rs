use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseType {
    SQLite,
    PostgreSQL,
    MySQL,
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

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SSHAuthMethod {
    Password,
    PrivateKey,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
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

#[derive(Debug, Serialize)]
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
