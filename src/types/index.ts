export type DatabaseType = 'sqlite' | 'postgresql' | 'mysql' | 'mongodb' | 'clickhouse' | 'libsql' | 'redis';
export type DatabaseProvider = 'supabase' | 'neon' | 'mariadb' | 'planetscale' | 'planetscale_postgres' | 'prisma' | 'turso' | 'valtown' | 'cloudflare';
export type MariaDBAuthMethod = 'password' | 'aws_iam' | 'azure_ad' | 'gcp_iam';
export type MongoDBAuthMethod = 'password' | 'atlas';

export type ColumnTypeFamily =
  | 'boolean'
  | 'integer'
  | 'float'
  | 'decimal'
  | 'text'
  | 'date_time'
  | 'date'
  | 'time'
  | 'json'
  | 'uuid'
  | 'binary'
  | 'enum'
  | 'array'
  | 'network'
  | 'range'
  | 'full_text'
  | 'extension'
  | 'domain'
  | 'custom'
  | 'unknown';

export type SSHAuthMethod = 'password' | 'privateKey';

export interface SSHConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  authMethod: SSHAuthMethod;
  privateKeyPath?: string;
  password?: string;
  localPort?: number;
}

export interface ConnectionConfig {
  id: string;
  name: string;
  db_type: DatabaseType;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  file_path?: string;
  ssh_config?: SSHConfig;
  /** Set for cloud providers (supabase, neon, planetscale, prisma, turso, valtown, cloudflare) or mariadb. */
  provider?: DatabaseProvider;
  /** Auth method — only relevant when provider === 'mariadb' */
  auth_method?: MariaDBAuthMethod;
  /** AWS IAM auth */
  aws_region?: string;
  aws_db_user?: string;
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  /** Azure AD auth */
  azure_tenant_id?: string;
  /** GCP IAM auth */
  gcp_project?: string;
  /** MongoDB auth method */
  mongo_auth_method?: MongoDBAuthMethod;
  /** MongoDB: full atlas connection string */
  mongo_connection_string?: string;
  /** MongoDB: auth source database (defaults to 'admin') */
  mongo_auth_source?: string;
  /** MongoDB: target database name (defaults to 'admin' or extracted from connection string) */
  mongo_database?: string;
  /** ClickHouse SSL/TLS requirement */
  clickhouse_use_ssl?: boolean;
  /** LibSQL / Turso / Val Town Connection URI */
  libsql_url?: string;
  /** LibSQL / Turso / Val Town Auth Token */
  libsql_auth_token?: string;
  /** Redis database index (0 - 15) */
  redis_db?: number;
  /** Cloudflare D1 Account ID */
  cloudflare_account_id?: string;
  /** Cloudflare D1 Database ID (UUID) */
  cloudflare_database_id?: string;
  /** Cloudflare D1 API Token */
  cloudflare_api_token?: string;
}

export interface DatabaseTable {
  name: string;
  schema?: string;
  full_name?: string;
  row_count?: number;
  size_kb?: number;
  table_type?: string; // "TABLE" or "VIEW"
}

export interface SQLiteBooleanSuggestion {
  columnName: string;
  sampleSize: number;
}

export interface SQLiteJsonSuggestion {
  columnName: string;
  sampleSize: number;
}

export interface TableColumn {
  name: string;
  data_type: string;
  raw_type?: string | null;
  normalized_type: string;
  type_family: ColumnTypeFamily;
  db_type: DatabaseType;
  is_nullable: boolean;
  default_value?: string;
  is_primary_key: boolean;
  is_boolean_like: boolean;
  is_array: boolean;
  enum_values?: string[] | null;
  identity_kind?: string | null;
  generated_kind?: string | null;
  generation_expression?: string | null;
  column_comment?: string | null;
  collation_name?: string | null;
  domain_name?: string | null;
  domain_schema?: string | null;
  domain_base_type?: string | null;
  array_dimensions?: number | null;
  element_raw_type?: string | null;
}


export interface ForeignKeyDefinition {
  constraint_name: string;
  table_name: string;
  column_names: string[];
  referenced_table_name: string;
  referenced_column_names: string[];
  on_delete?: string | null;
  on_update?: string | null;
}

export interface MigrationRecord {
  id: string;
  connectionId: string;
  name: string;
  upSql: string;
  downSql: string;
  createdAt: number;
}

export interface AppliedMigration {
  id: string;
  name: string;
  applied_at: string;
  checksum?: string | null;
}

export interface MigrationStatus {
  migration: MigrationRecord;
  appliedAt?: string | null;
  isApplied: boolean;
  isLatestApplied: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rows_affected: number;
}


export interface DatabaseExportTableData {
  table: DatabaseTable;
  result: QueryResult;
}

export interface DatabaseExportData {
  connectionName: string;
  dbType: DatabaseType;
  exportedAt: string;
  tables: DatabaseExportTableData[];
}
export interface TableConstraint {
  constraint_name: string;
  constraint_type: string;
  table_schema?: string | null;
  table_name: string;
  column_names: string[];
  foreign_table_schema?: string | null;
  foreign_table_name?: string | null;
  foreign_column_names?: string[] | null;
  check_expression?: string | null;
  is_deferrable?: boolean | null;
  initially_deferred?: boolean | null;
}

export interface TableIndex {
  index_name: string;
  method?: string | null;
  is_unique: boolean;
  is_primary: boolean;
  is_valid?: boolean | null;
  columns: string[];
  expression?: string | null;
  predicate?: string | null;
  definition?: string | null;
}

export interface PostgresConnectionInfo {
  version: string;
  server_version: string;
  current_database: string;
  current_user: string;
  search_path: string;
  timezone: string;
  backend_pid: number;
}

export interface PostgresExtension {
  extname: string;
  extversion: string;
}

export interface PostgresTablePrivileges {
  can_select: boolean;
  can_insert: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_truncate: boolean;
  can_references: boolean;
  can_trigger: boolean;
}

export interface ExecutionPlan {
  query: string;
  planSteps: PlanStep[];
  totalCost?: number;
  executionTimeMs?: number;
  recommendations: string[];
}

export interface PlanStep {
  stepType: string;
  tableName?: string;
  rows?: number;
  cost?: number;
  filterCondition?: string;
  indexUsed?: string;
  children: PlanStep[];
}

export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter';
export type AggregationType = 'count' | 'sum' | 'avg' | 'min' | 'max';

export interface ChartConfig {
  chartType: ChartType;
  xAxis: string;
  yAxis: string[];
  aggregation?: AggregationType;
  groupBy?: string;
  title?: string;
  colors?: string[];
}

export interface ChartDataPoint {
  [key: string]: string | number;
}

export interface ChartData {
  data: ChartDataPoint[];
  xAxisKey: string;
  yAxisKeys: string[];
}

// Query Builder Types
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
export type OrderDirection = 'ASC' | 'DESC';

export interface QueryTable {
  id: string;
  tableName: string;
  alias?: string;
  position: { x: number; y: number };
  columns: TableColumn[];
}

export interface QueryJoin {
  id: string;
  leftTable: string;
  leftColumn: string;
  rightTable: string;
  rightColumn: string;
  joinType: JoinType;
}

export interface SelectedColumn {
  id: string;
  tableId: string;
  columnName: string;
  alias?: string;
  aggregation?: AggregationType;
}

export interface WhereCondition {
  id: string;
  column: string;
  operator: string;
  value: string;
  logicalOperator?: 'AND' | 'OR';
}

export interface OrderByClause {
  column: string;
  direction: OrderDirection;
}

export interface QueryBuilderState {
  tables: QueryTable[];
  joins: QueryJoin[];
  selectedColumns: SelectedColumn[];
  whereConditions: WhereCondition[];
  orderBy: OrderByClause[];
  limit?: number;
  distinct: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  latency_ms: number;
  db_version: string;
  error?: string;
}

export interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  duration?: number; // milliseconds
  status: 'success' | 'error';
  rowsAffected?: number;
  error?: string;
  connectionId: string;
  connectionName: string;
}

// Tag Types
export type TagColor =
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'fuchsia'
  | 'pink'
  | 'rose'
  | 'slate'
  | 'gray'
  | 'zinc'
  | 'neutral'
  | 'stone';

export interface TableTag {
  id: string;
  name: string;
  color: TagColor;
  createdAt: number;
}

export interface TableTagAssignment {
  tableName: string;
  tagId: string;
  connectionId: string;
}

export interface RelationMatch {
  table_name: string;
  column_name: string;
  is_primary_key: boolean;
  count: number;
  sample_rows: QueryResult;
}

export interface TabFilter {
  id: string;
  value: unknown;
}

