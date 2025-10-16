import { toast } from 'sonner';
import { DatabaseType } from '@/types';
import { quoteIdentifier, qualifyTableName } from './sqlUtils';

/**
 * Copy text to clipboard with fallback
 */
export async function copyToClipboard(text: string, successMessage: string = 'Copied to clipboard') {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch (error) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      toast.success(successMessage);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
    document.body.removeChild(textarea);
  }
}

/**
 * Format a cell value for display
 */
export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

/**
 * Copy a single cell value
 */
export async function copyCellValue(value: unknown) {
  const text = formatCellValue(value);
  await copyToClipboard(text, 'Cell value copied');
}

/**
 * Copy entire row as JSON
 */
export async function copyRowAsJson(row: Record<string, unknown>) {
  const json = JSON.stringify(row, null, 2);
  await copyToClipboard(json, 'Row copied as JSON');
}

/**
 * Copy entire row as CSV
 */
export async function copyRowAsCsv(row: Record<string, unknown>, columns: string[]) {
  const values = columns.map(col => {
    const value = row[col];
    const str = formatCellValue(value);
    // Escape CSV values
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  });
  await copyToClipboard(values.join(','), 'Row copied as CSV');
}

/**
 * Copy entire row as SQL INSERT
 */
export async function copyRowAsSql(
  row: Record<string, unknown>,
  tableName: string,
  columns: string[],
  schema?: string,
  dbType?: DatabaseType
) {
  const type = dbType || 'sqlite';
  const quotedColumns = columns.map(col => quoteIdentifier(col, type));
  const columnList = quotedColumns.join(', ');
  const values = columns.map(col => {
    const value = row[col];
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    return String(value);
  });
  const qualifiedTable = qualifyTableName(tableName, schema, type);
  const sql = `INSERT INTO ${qualifiedTable} (${columnList}) VALUES (${values.join(', ')});`;
  await copyToClipboard(sql, 'Row copied as SQL INSERT');
}

/**
 * Copy entire column values
 */
export async function copyColumnValues(data: Record<string, unknown>[], columnName: string) {
  const values = data.map(row => formatCellValue(row[columnName])).join('\n');
  await copyToClipboard(values, `Column "${columnName}" copied`);
}

/**
 * Copy column values as CSV
 */
export async function copyColumnAsCsv(data: Record<string, unknown>[], columnName: string) {
  const values = [columnName]; // Header
  data.forEach(row => {
    const value = formatCellValue(row[columnName]);
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      values.push(`"${value.replace(/"/g, '""')}"`);
    } else {
      values.push(value);
    }
  });
  await copyToClipboard(values.join('\n'), `Column "${columnName}" copied as CSV`);
}

/**
 * Export column to CSV file
 */
export function exportColumnToCsv(data: Record<string, unknown>[], columnName: string) {
  const values = [columnName]; // Header
  data.forEach(row => {
    const value = formatCellValue(row[columnName]);
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      values.push(`"${value.replace(/"/g, '""')}"`);
    } else {
      values.push(value);
    }
  });
  
  const csv = values.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${columnName}_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  toast.success(`Column "${columnName}" exported to CSV`);
}

/**
 * Generate SQL UPDATE statement for setting cell to NULL
 */
export function generateSetNullSql(
  tableName: string,
  columnName: string,
  primaryKeyColumn: string,
  primaryKeyValue: unknown,
  schema?: string,
  dbType?: DatabaseType
): string {
  const type = dbType || 'sqlite';
  const pkValue = typeof primaryKeyValue === 'string'
    ? `'${primaryKeyValue.replace(/'/g, "''")}'`
    : String(primaryKeyValue);

  const qualifiedTable = qualifyTableName(tableName, schema, type);
  const quotedColumn = quoteIdentifier(columnName, type);
  const quotedPkColumn = quoteIdentifier(primaryKeyColumn, type);

  return `UPDATE ${qualifiedTable} SET ${quotedColumn} = NULL WHERE ${quotedPkColumn} = ${pkValue};`;
}

/**
 * Generate SQL DELETE statement
 */
export function generateDeleteSql(
  tableName: string,
  primaryKeyColumn: string,
  primaryKeyValue: unknown,
  schema?: string,
  dbType?: DatabaseType
): string {
  const type = dbType || 'sqlite';
  const pkValue = typeof primaryKeyValue === 'string'
    ? `'${primaryKeyValue.replace(/'/g, "''")}'`
    : String(primaryKeyValue);

  const qualifiedTable = qualifyTableName(tableName, schema, type);
  const quotedPkColumn = quoteIdentifier(primaryKeyColumn, type);

  return `DELETE FROM ${qualifiedTable} WHERE ${quotedPkColumn} = ${pkValue};`;
}

/**
 * Generate SQL INSERT for duplicating a row
 */
export function generateDuplicateSql(
  tableName: string,
  row: Record<string, unknown>,
  columns: string[],
  primaryKeyColumn: string,
  schema?: string,
  dbType?: DatabaseType
): string {
  const type = dbType || 'sqlite';
  // Exclude primary key from columns
  const columnsWithoutPk = columns.filter(col => col !== primaryKeyColumn);
  const quotedColumns = columnsWithoutPk.map(col => quoteIdentifier(col, type));
  const columnList = quotedColumns.join(', ');

  const values = columnsWithoutPk.map(col => {
    const value = row[col];
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    return String(value);
  });

  const qualifiedTable = qualifyTableName(tableName, schema, type);

  return `INSERT INTO ${qualifiedTable} (${columnList}) VALUES (${values.join(', ')});`;
}

/**
 * Calculate column statistics
 */
export interface ColumnStats {
  count: number;
  nullCount: number;
  uniqueCount: number;
  min?: number;
  max?: number;
  avg?: number;
  sum?: number;
}

export function calculateColumnStats(data: Record<string, unknown>[], columnName: string): ColumnStats {
  const values = data.map(row => row[columnName]);
  const nonNullValues = values.filter(v => v !== null && v !== undefined);
  const uniqueValues = new Set(nonNullValues);
  
  const stats: ColumnStats = {
    count: values.length,
    nullCount: values.length - nonNullValues.length,
    uniqueCount: uniqueValues.size,
  };
  
  // Calculate numeric stats if column contains numbers
  const numericValues = nonNullValues
    .map(v => typeof v === 'number' ? v : parseFloat(String(v)))
    .filter(v => !isNaN(v));
  
  if (numericValues.length > 0) {
    stats.min = Math.min(...numericValues);
    stats.max = Math.max(...numericValues);
    stats.sum = numericValues.reduce((a, b) => a + b, 0);
    stats.avg = stats.sum / numericValues.length;
  }
  
  return stats;
}
