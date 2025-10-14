import { QueryBuilderState, DatabaseType } from '@/types';

export function generateSQL(state: QueryBuilderState, dbType: DatabaseType): string {
  if (state.tables.length === 0) {
    return '-- Add tables to build your query';
  }

  if (state.selectedColumns.length === 0) {
    return '-- Select columns to include in the query';
  }

  const parts: string[] = [];

  // SELECT clause
  const selectClause = buildSelectClause(state);
  parts.push(selectClause);

  // FROM clause
  const fromClause = buildFromClause(state);
  parts.push(fromClause);

  // JOIN clauses
  if (state.joins.length > 0) {
    const joinClauses = buildJoinClauses(state, dbType);
    parts.push(joinClauses);
  }

  // WHERE clause
  if (state.whereConditions.length > 0) {
    const whereClause = buildWhereClause(state);
    parts.push(whereClause);
  }

  // ORDER BY clause
  if (state.orderBy.length > 0) {
    const orderByClause = buildOrderByClause(state);
    parts.push(orderByClause);
  }

  // LIMIT clause
  if (state.limit && state.limit > 0) {
    parts.push(`LIMIT ${state.limit}`);
  }

  return parts.join('\n') + ';';
}

function buildSelectClause(state: QueryBuilderState): string {
  const distinct = state.distinct ? 'DISTINCT ' : '';
  
  const columns = state.selectedColumns.map((col) => {
    const table = state.tables.find((t) => t.id === col.tableId);
    const tableName = table?.alias || table?.tableName || '';
    
    let columnExpr = `${tableName}.${col.columnName}`;
    
    if (col.aggregation) {
      columnExpr = `${col.aggregation.toUpperCase()}(${columnExpr})`;
    }
    
    if (col.alias) {
      columnExpr += ` AS ${col.alias}`;
    }
    
    return columnExpr;
  });

  return `SELECT ${distinct}${columns.join(', ')}`;
}

function buildFromClause(state: QueryBuilderState): string {
  const firstTable = state.tables[0];
  const tableName = firstTable.tableName;
  const alias = firstTable.alias ? ` AS ${firstTable.alias}` : '';
  
  return `FROM ${tableName}${alias}`;
}

function buildJoinClauses(state: QueryBuilderState, _dbType: DatabaseType): string {
  return state.joins
    .map((join) => {
      const leftTable = state.tables.find((t) => t.id === join.leftTable);
      const rightTable = state.tables.find((t) => t.id === join.rightTable);
      
      if (!leftTable || !rightTable) return '';
      
      const leftName = leftTable.alias || leftTable.tableName;
      const rightName = rightTable.alias || rightTable.tableName;
      const rightTableName = rightTable.tableName;
      const rightAlias = rightTable.alias ? ` AS ${rightTable.alias}` : '';
      
      return `${join.joinType} JOIN ${rightTableName}${rightAlias} ON ${leftName}.${join.leftColumn} = ${rightName}.${join.rightColumn}`;
    })
    .filter((s) => s.length > 0)
    .join('\n');
}

function buildWhereClause(state: QueryBuilderState): string {
  if (state.whereConditions.length === 0) return '';
  
  const conditions = state.whereConditions.map((cond, index) => {
    const operator = cond.operator;
    let value = cond.value;
    
    // Quote string values
    if (!['NULL', 'NOT NULL'].includes(value.toUpperCase()) && isNaN(Number(value))) {
      value = `'${value.replace(/'/g, "''")}'`;
    }
    
    let condition = `${cond.column} ${operator} ${value}`;
    
    if (index > 0 && cond.logicalOperator) {
      condition = `${cond.logicalOperator} ${condition}`;
    }
    
    return condition;
  });
  
  return `WHERE ${conditions.join(' ')}`;
}

function buildOrderByClause(state: QueryBuilderState): string {
  const orderBy = state.orderBy
    .map((order) => `${order.column} ${order.direction}`)
    .join(', ');
  
  return `ORDER BY ${orderBy}`;
}

export function formatSQL(sql: string): string {
  // Simple SQL formatting
  return sql
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateQueryBuilder(state: QueryBuilderState): string[] {
  const errors: string[] = [];
  
  if (state.tables.length === 0) {
    errors.push('At least one table must be selected');
  }
  
  if (state.selectedColumns.length === 0) {
    errors.push('At least one column must be selected');
  }
  
  // Validate joins
  state.joins.forEach((join, index) => {
    if (!join.leftColumn || !join.rightColumn) {
      errors.push(`Join ${index + 1}: Both columns must be specified`);
    }
  });
  
  // Validate where conditions
  state.whereConditions.forEach((cond, index) => {
    if (!cond.column || !cond.operator) {
      errors.push(`WHERE condition ${index + 1}: Column and operator must be specified`);
    }
  });
  
  return errors;
}
