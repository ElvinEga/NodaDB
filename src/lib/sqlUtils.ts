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
  const hasQualifier = tableName.includes(".");

  if (type === "postgresql" && hasQualifier) {
    const [existingSchema, existingTable] = tableName.split(".", 2);
    return `${quoteIdentifier(
      existingSchema.replace(/^"|"$/g, ""),
      type
    )}.${quoteIdentifier(existingTable.replace(/^"|"$/g, ""), type)}`;
  }

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

function buildTextSearchExpression(
  columnId: string,
  value: string,
  dbType: DatabaseType,
  caseInsensitive = false
): string {
  const quotedColumn = quoteIdentifier(columnId, dbType);
  const quotedValue = quoteValue(value, dbType);

  switch (dbType) {
    case "postgresql":
      return `CAST(${quotedColumn} AS TEXT) ${caseInsensitive ? "ILIKE" : "LIKE"} ${quotedValue}`;
    case "mysql":
      return `CAST(${quotedColumn} AS CHAR) LIKE ${quotedValue}`;
    case "sqlite":
    default:
      return `CAST(${quotedColumn} AS TEXT) LIKE ${quotedValue}`;
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

      if (typeof value === "object" && value !== null && "operator" in value && "value" in value) {
        const valObj = value as { operator: string; value: string };
        const op = valObj.operator;
        const val = valObj.value;

        if (op === "between") {
          const parts = val.split(",");
          const val1 = quoteValue(parts[0] || "", dbType || "sqlite");
          if (parts.length > 1 && parts[1]) {
            const val2 = quoteValue(parts[1], dbType || "sqlite");
            conditions.push(`${quotedColumn} BETWEEN ${val1} AND ${val2}`);
          } else {
            conditions.push(`${quotedColumn} >= ${val1}`);
          }
        } else if (op === "is_null") {
          conditions.push(`${quotedColumn} IS NULL`);
        } else if (op === "is_not_null") {
          conditions.push(`${quotedColumn} IS NOT NULL`);
        } else {
          let sqlOperator = "=";
          switch (op) {
            case "equals": sqlOperator = "="; break;
            case "not_equals": sqlOperator = "!="; break;
            case "greater_than": sqlOperator = ">"; break;
            case "greater_than_or_equal": sqlOperator = ">="; break;
            case "less_than": sqlOperator = "<"; break;
            case "less_than_or_equal": sqlOperator = "<="; break;
            case "like": sqlOperator = "LIKE"; break;
            case "not_like": sqlOperator = "NOT LIKE"; break;
            case "in": sqlOperator = "IN"; break;
            case "not_in": sqlOperator = "NOT IN"; break;
          }

          let formattedVal = "";
          if (op === "in" || op === "not_in") {
            const values = val.split(",").map(v => v.trim());
            formattedVal = `(${values.map(v => quoteValue(v, dbType || "sqlite")).join(", ")})`;
          } else if (op === "like" || op === "not_like") {
            const escaped = val.replace(/'/g, "''");
            const finalVal = escaped.includes("%") ? escaped : `%${escaped}%`;
            formattedVal = `'${finalVal}'`;
          } else {
            formattedVal = quoteValue(val, dbType || "sqlite");
          }

          conditions.push(`${quotedColumn} ${sqlOperator} ${formattedVal}`);
        }
      } else {
        // Fallback for simple string/primitive values (legacy or right-click filter by value)
        if (typeof value === "string" && value.includes("%")) {
          conditions.push(
            buildTextSearchExpression(columnId, value, dbType || "sqlite")
          );
        } else {
          conditions.push(
            `${quotedColumn} = ${quoteValue(value, dbType || "sqlite")}`
          );
        }
      }
    }
  });

  // Add global filter (search across all string columns)
  if (globalFilter && columns) {
    const globalConditions: string[] = [];
    columns.forEach((column) => {
      globalConditions.push(
        buildTextSearchExpression(
          column,
          `%${globalFilter}%`,
          dbType || "sqlite",
          dbType === "postgresql"
        )
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
