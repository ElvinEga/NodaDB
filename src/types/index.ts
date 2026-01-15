export type DatabaseType = 'sqlite' | 'postgresql' | 'mysql';

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
}

export interface DatabaseTable {
  name: string;
  schema?: string;
  row_count?: number;
  size_kb?: number;
  table_type?: string; // "TABLE" or "VIEW"
}

export interface TableColumn {
  name: string;
  data_type: string;
  is_nullable: boolean;
  default_value?: string;
  is_primary_key: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rows_affected: number;
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
