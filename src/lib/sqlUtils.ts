import { DatabaseType } from "@/types";

/**
 * Quote an SQL identifier based on the database type
 */
export function quoteIdentifier(identifier: string, dbType: DatabaseType): string {
  switch (dbType) {
    case 'postgresql':
      // PostgreSQL uses double quotes for identifiers
      return `"${identifier.replace(/"/g, '""')}"`;
    case 'mysql':
      // MySQL uses backticks for identifiers
      return `\`${identifier.replace(/`/g, '``')}\``;
    case 'sqlite':
      // SQLite can use double quotes or backticks
      return `"${identifier.replace(/"/g, '""')}"`;
    default:
      return identifier;
  }
}

/**
 * Build a fully qualified table name (schema.table) with proper quoting
 */
export function qualifyTableName(
  tableName: string,
  schema?: string,
  dbType?: DatabaseType
): string {
  const type = dbType || 'sqlite';

  if (schema && type === 'postgresql') {
    // For PostgreSQL, use schema.table format
    return `${quoteIdentifier(schema, type)}.${quoteIdentifier(tableName, type)}`;
  } else if (schema && type === 'mysql') {
    // For MySQL, use database.table format
    return `${quoteIdentifier(schema, type)}.${quoteIdentifier(tableName, type)}`;
  } else {
    // For SQLite or when no schema is provided
    return quoteIdentifier(tableName, type);
  }
}

/**
 * Build a SELECT query with proper table qualification
 */
export function buildSelectQuery(
  tableName: string,
  schema?: string,
  dbType?: DatabaseType,
  limit?: number
): string {
  const qualifiedTable = qualifyTableName(tableName, schema, dbType);
  const limitClause = limit ? ` LIMIT ${limit}` : '';
  return `SELECT * FROM ${qualifiedTable}${limitClause}`;
}
