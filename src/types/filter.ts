/**
 * Filter types for table data filtering
 */

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'like'
  | 'not_like'
  | 'is_null'
  | 'is_not_null'
  | 'in'
  | 'not_in';

export interface TableFilter {
  id: string;
  column: string;
  operator: FilterOperator;
  value: string;
  dataType: string;
}

export interface FilterOperatorOption {
  value: FilterOperator;
  label: string;
  requiresValue: boolean;
}

/**
 * Get available operators for a given data type
 */
export function getOperatorsForDataType(dataType: string): FilterOperatorOption[] {
  const type = dataType.toUpperCase();
  
  const baseOperators: FilterOperatorOption[] = [
    { value: 'equals', label: '=', requiresValue: true },
    { value: 'not_equals', label: '≠', requiresValue: true },
    { value: 'is_null', label: 'IS NULL', requiresValue: false },
    { value: 'is_not_null', label: 'IS NOT NULL', requiresValue: false },
  ];

  // Numeric types
  if (type.includes('INT') || type.includes('FLOAT') || type.includes('REAL') || 
      type.includes('DOUBLE') || type.includes('NUMERIC') || type.includes('DECIMAL') ||
      type.includes('SERIAL')) {
    return [
      ...baseOperators,
      { value: 'greater_than', label: '>', requiresValue: true },
      { value: 'greater_than_or_equal', label: '≥', requiresValue: true },
      { value: 'less_than', label: '<', requiresValue: true },
      { value: 'less_than_or_equal', label: '≤', requiresValue: true },
      { value: 'in', label: 'IN', requiresValue: true },
      { value: 'not_in', label: 'NOT IN', requiresValue: true },
    ];
  }

  // String types
  if (type.includes('CHAR') || type.includes('TEXT') || type.includes('VARCHAR')) {
    return [
      ...baseOperators,
      { value: 'like', label: 'LIKE', requiresValue: true },
      { value: 'not_like', label: 'NOT LIKE', requiresValue: true },
      { value: 'in', label: 'IN', requiresValue: true },
      { value: 'not_in', label: 'NOT IN', requiresValue: true },
    ];
  }

  // Date/Time types
  if (type.includes('DATE') || type.includes('TIME')) {
    return [
      ...baseOperators,
      { value: 'greater_than', label: '>', requiresValue: true },
      { value: 'greater_than_or_equal', label: '≥', requiresValue: true },
      { value: 'less_than', label: '<', requiresValue: true },
      { value: 'less_than_or_equal', label: '≤', requiresValue: true },
    ];
  }

  // Boolean types
  if (type.includes('BOOL')) {
    return [
      { value: 'equals', label: '=', requiresValue: true },
      { value: 'not_equals', label: '≠', requiresValue: true },
      { value: 'is_null', label: 'IS NULL', requiresValue: false },
      { value: 'is_not_null', label: 'IS NOT NULL', requiresValue: false },
    ];
  }

  // Default operators
  return baseOperators;
}

/**
 * Convert operator enum to SQL operator
 */
export function operatorToSQL(operator: FilterOperator): string {
  switch (operator) {
    case 'equals': return '=';
    case 'not_equals': return '!=';
    case 'greater_than': return '>';
    case 'greater_than_or_equal': return '>=';
    case 'less_than': return '<';
    case 'less_than_or_equal': return '<=';
    case 'like': return 'LIKE';
    case 'not_like': return 'NOT LIKE';
    case 'is_null': return 'IS NULL';
    case 'is_not_null': return 'IS NOT NULL';
    case 'in': return 'IN';
    case 'not_in': return 'NOT IN';
    default: return '=';
  }
}

/**
 * Escape and format value for SQL
 */
export function formatValueForSQL(value: string, dataType: string, operator: FilterOperator): string {
  const type = dataType.toUpperCase();

  // Handle NULL operators
  if (operator === 'is_null' || operator === 'is_not_null') {
    return '';
  }

  // Handle IN operators
  if (operator === 'in' || operator === 'not_in') {
    // Split by comma and trim
    const values = value.split(',').map(v => v.trim());
    if (type.includes('INT') || type.includes('FLOAT') || type.includes('REAL') || 
        type.includes('DOUBLE') || type.includes('NUMERIC') || type.includes('SERIAL')) {
      return `(${values.join(', ')})`;
    } else {
      return `(${values.map(v => `'${v.replace(/'/g, "''")}'`).join(', ')})`;
    }
  }

  // Numeric types - no quotes
  if (type.includes('INT') || type.includes('FLOAT') || type.includes('REAL') || 
      type.includes('DOUBLE') || type.includes('NUMERIC') || type.includes('DECIMAL') ||
      type.includes('SERIAL')) {
    return value;
  }

  // Boolean types
  if (type.includes('BOOL')) {
    const lower = value.toLowerCase();
    if (['true', '1', 't', 'yes', 'y'].includes(lower)) return 'true';
    if (['false', '0', 'f', 'no', 'n'].includes(lower)) return 'false';
    return value;
  }

  // String types - escape single quotes
  const escaped = value.replace(/'/g, "''");
  
  // For LIKE operator, ensure % wildcards are present
  if (operator === 'like' || operator === 'not_like') {
    if (!escaped.includes('%')) {
      return `'%${escaped}%'`;
    }
  }
  
  return `'${escaped}'`;
}

/**
 * Build WHERE clause from filters
 */
export function buildWhereClause(filters: TableFilter[]): string {
  if (filters.length === 0) return '';

  const conditions = filters.map(filter => {
    const sqlOperator = operatorToSQL(filter.operator);
    
    if (filter.operator === 'is_null' || filter.operator === 'is_not_null') {
      return `${filter.column} ${sqlOperator}`;
    }

    const formattedValue = formatValueForSQL(filter.value, filter.dataType, filter.operator);
    return `${filter.column} ${sqlOperator} ${formattedValue}`;
  });

  return conditions.join(' AND ');
}
