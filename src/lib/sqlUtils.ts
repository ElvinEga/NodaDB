import { DatabaseType } from "@/types";
import { SortingState, ColumnFiltersState } from "@tanstack/react-table";

/**
 * Quote an SQL identifier based on the database type
 */
export function quoteIdentifier(
  identifier: string,
  dbType: DatabaseType
): string {
  switch (dbType) {
    case "postgresql":
      // PostgreSQL uses double quotes for identifiers
      return `"${identifier.replace(/"/g, '""')}"`;
    case "mysql":
      // MySQL uses backticks for identifiers
      return `\`${identifier.replace(/`/g, "``")}\``;
    case "sqlite":
      // SQLite can use double quotes or backticks
      return `"${identifier.replace(/"/g, '""')}"`;
    default:
      return identifier;
  }
}

/**
 * Quote an SQL string value based on the database type
 */
export function quoteValue(value: any, dbType: DatabaseType): string {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "string") {
    // Escape single quotes by doubling them
    const escapedValue = value.replace(/'/g, "''");
    return `'${escapedValue}'`;
  }

  if (typeof value === "boolean") {
    return dbType === "mysql" ? (value ? "1" : "0") : value ? "TRUE" : "FALSE";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }

  // For other types, convert to string and quote
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Build a fully qualified table name (schema.table) with proper quoting
 */
export function qualifyTableName(
  tableName: string,
  schema?: string,
  dbType?: DatabaseType
): string {
  const type = dbType || "sqlite";

  if (schema && type === "postgresql") {
    // For PostgreSQL, use schema.table format
    return `${quoteIdentifier(schema, type)}.${quoteIdentifier(
      tableName,
      type
    )}`;
  } else if (schema && type === "mysql") {
    // For MySQL, use database.table format
    return `${quoteIdentifier(schema, type)}.${quoteIdentifier(
      tableName,
      type
    )}`;
  } else {
    // For SQLite or when no schema is provided
    return quoteIdentifier(tableName, type);
  }
}

/**
 * Build WHERE clause from column filters
 */
function buildWhereClause(
  columnFilters: ColumnFiltersState,
  globalFilter?: string,
  columns?: string[],
  dbType?: DatabaseType
): { whereClause: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];

  // Add column filters
  columnFilters.forEach((filter) => {
    const { id: columnId, value } = filter;
    if (value !== undefined && value !== null && value !== "") {
      const quotedColumn = quoteIdentifier(columnId, dbType || "sqlite");

      if (typeof value === "string" && value.includes("%")) {
        // Handle LIKE operations
        conditions.push(
          `${quotedColumn} LIKE ${quoteValue(value, dbType || "sqlite")}`
        );
      } else {
        // Handle exact matches
        conditions.push(
          `${quotedColumn} = ${quoteValue(value, dbType || "sqlite")}`
        );
      }
    }
  });

  // Add global filter (search across all string columns)
  if (globalFilter && columns) {
    const globalConditions: string[] = [];
    columns.forEach((column) => {
      const quotedColumn = quoteIdentifier(column, dbType || "sqlite");
      globalConditions.push(
        `${quotedColumn} LIKE ${quoteValue(
          `%${globalFilter}%`,
          dbType || "sqlite"
        )}`
      );
    });

    if (globalConditions.length > 0) {
      conditions.push(`(${globalConditions.join(" OR ")})`);
    }
  }

  const whereClause =
    conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  return { whereClause, params };
}

/**
 * Build ORDER BY clause from sorting state
 */
function buildOrderByClause(
  sorting: SortingState,
  dbType?: DatabaseType
): string {
  if (sorting.length === 0) {
    return "";
  }

  const orderClauses = sorting.map((sort) => {
    const quotedColumn = quoteIdentifier(sort.id, dbType || "sqlite");
    const direction = sort.desc ? "DESC" : "ASC";
    return `${quotedColumn} ${direction}`;
  });

  return ` ORDER BY ${orderClauses.join(", ")}`;
}

/**
 * Build a dynamic SELECT query with sorting, filtering, and pagination
 */
export function buildSelectQuery(options: {
  tableName: string;
  schema?: string;
  dbType?: DatabaseType;
  limit?: number;
  offset?: number;
  sorting?: SortingState;
  filters?: ColumnFiltersState;
  globalFilter?: string;
  columns?: string[];
}): string {
  const {
    tableName,
    schema,
    dbType = "sqlite",
    limit,
    offset,
    sorting = [],
    filters = [],
    globalFilter,
    columns,
  } = options;

  const qualifiedTable = qualifyTableName(tableName, schema, dbType);
  const { whereClause } = buildWhereClause(
    filters,
    globalFilter,
    columns,
    dbType
  );
  const orderByClause = buildOrderByClause(sorting, dbType);

  let query = `SELECT * FROM ${qualifiedTable}${whereClause}${orderByClause}`;

  // Add LIMIT and OFFSET for pagination
  if (limit !== undefined) {
    query += ` LIMIT ${limit}`;
    if (offset !== undefined && offset > 0) {
      query += ` OFFSET ${offset}`;
    }
  }

  return query;
}

/**
 * Build a COUNT query to get the total number of rows
 */
export function buildCountQuery(options: {
  tableName: string;
  schema?: string;
  dbType?: DatabaseType;
  filters?: ColumnFiltersState;
  globalFilter?: string;
  columns?: string[];
}): string {
  const {
    tableName,
    schema,
    dbType = "sqlite",
    filters = [],
    globalFilter,
    columns,
  } = options;

  const qualifiedTable = qualifyTableName(tableName, schema, dbType);
  const { whereClause } = buildWhereClause(
    filters,
    globalFilter,
    columns,
    dbType
  );

  // Use COUNT(1) which is more reliable across databases
  return `SELECT COUNT(1) as count FROM ${qualifiedTable}${whereClause}`;
}

/**
 * Build a SELECT query with proper table qualification (legacy version for backward compatibility)
 */
export function buildSimpleSelectQuery(
  tableName: string,
  schema?: string,
  dbType?: DatabaseType,
  limit?: number
): string {
  const qualifiedTable = qualifyTableName(tableName, schema, dbType);
  const limitClause = limit ? ` LIMIT ${limit}` : "";
  return `SELECT * FROM ${qualifiedTable}${limitClause}`;
}
