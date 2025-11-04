import { TableRow } from './table-state';
import { DatabaseType, TableColumn } from '@/types';

interface CommitPlan {
  inserts: string[];
  updates: string[];
  deletes: string[];
}

interface GenerateOptions {
  changedRows: { index: number; row: TableRow }[];
  tableName: string;
  tableColumns: TableColumn[];
  dbType: DatabaseType;
}

const quoteIdentifier = (name: string, dbType: DatabaseType): string => {
  switch (dbType) {
    case 'mysql':
      return `\`${name}\``;
    case 'postgresql':
      return `"${name}"`;
    case 'sqlite':
    default:
      return `"${name}"`;
  }
};

const escapeSqlValue = (value: any): string => {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  return `'${String(value).replace(/'/g, "''")}'`;
};

export const generateCommitSQL = ({
  changedRows,
  tableName,
  tableColumns,
  dbType,
}: GenerateOptions): CommitPlan => {
  const plan: CommitPlan = { inserts: [], updates: [], deletes: [] };
  const primaryKeyColumns = tableColumns.filter(col => col.is_primary_key).map(col => col.name);

  if (primaryKeyColumns.length === 0) {
    throw new Error("Cannot generate SQL without a primary key.");
  }

  for (const { row } of changedRows) {
    if (row.isRemoved) {
      const whereClauses = primaryKeyColumns.map(pk => 
        `${quoteIdentifier(pk, dbType)} = ${escapeSqlValue(row.raw[pk])}`
      );
      plan.deletes.push(`DELETE FROM ${quoteIdentifier(tableName, dbType)} WHERE ${whereClauses.join(' AND ')};`);
      continue;
    }

    if (row.isNewRow && row.change) {
      const cols = Object.keys(row.change);
      const values = cols.map(col => escapeSqlValue(row.change![col]));
      plan.inserts.push(`INSERT INTO ${quoteIdentifier(tableName, dbType)} (${cols.map(c => quoteIdentifier(c, dbType)).join(', ')}) VALUES (${values.join(', ')});`);
      continue;
    }

    if (row.change && Object.keys(row.change).length > 0) {
      const setClauses = Object.keys(row.change).map(col => 
        `${quoteIdentifier(col, dbType)} = ${escapeSqlValue(row.change![col])}`
      );
      const whereClauses = primaryKeyColumns.map(pk => 
        `${quoteIdentifier(pk, dbType)} = ${escapeSqlValue(row.raw[pk])}`
      );
      plan.updates.push(`UPDATE ${quoteIdentifier(tableName, dbType)} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')};`);
      continue;
    }
  }

  return plan;
};
