/**
 * CSV parsing and type detection utilities
 */

export interface CSVParseResult {
  headers: string[];
  rows: string[][];
  rowCount: number;
}

export interface ColumnMapping {
  csvColumn: string;
  csvIndex: number;
  tableColumn: string;
  dataType: string;
  skip: boolean;
}

export interface DetectedType {
  type: 'INTEGER' | 'REAL' | 'TEXT' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'NULL';
  confidence: number;
}

/**
 * Parse CSV file content into headers and rows
 */
export function parseCSV(content: string): CSVParseResult {
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    return { headers: [], rows: [], rowCount: 0 };
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length > 0) {
      rows.push(row);
    }
  }

  return {
    headers,
    rows,
    rowCount: rows.length,
  };
}

/**
 * Parse a single CSV line, handling quoted values and commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current.trim());
  
  return result;
}

/**
 * Detect data type for a column based on sample values
 */
export function detectColumnType(values: string[], sampleSize: number = 100): DetectedType {
  // Take sample of values
  const sample = values.slice(0, Math.min(sampleSize, values.length));
  const nonEmptyValues = sample.filter(v => v && v.trim().length > 0);
  
  if (nonEmptyValues.length === 0) {
    return { type: 'NULL', confidence: 1.0 };
  }

  let integerCount = 0;
  let realCount = 0;
  let booleanCount = 0;
  let dateCount = 0;
  let datetimeCount = 0;
  
  for (const value of nonEmptyValues) {
    const trimmed = value.trim();
    
    // Check integer
    if (/^-?\d+$/.test(trimmed)) {
      integerCount++;
      continue;
    }
    
    // Check real number
    if (/^-?\d+\.\d+$/.test(trimmed) || /^-?\d+\.?\d*e[+-]?\d+$/i.test(trimmed)) {
      realCount++;
      continue;
    }
    
    // Check boolean
    const lower = trimmed.toLowerCase();
    if (['true', 'false', '1', '0', 'yes', 'no', 't', 'f', 'y', 'n'].includes(lower)) {
      booleanCount++;
      continue;
    }
    
    // Check datetime (ISO format or common patterns)
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(trimmed)) {
      datetimeCount++;
      continue;
    }
    
    // Check date (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      dateCount++;
      continue;
    }
  }
  
  const total = nonEmptyValues.length;
  const integerRatio = integerCount / total;
  const realRatio = realCount / total;
  const booleanRatio = booleanCount / total;
  const dateRatio = dateCount / total;
  const datetimeRatio = datetimeCount / total;
  
  // Determine type with confidence threshold
  const threshold = 0.8;
  
  if (integerRatio >= threshold) {
    return { type: 'INTEGER', confidence: integerRatio };
  }
  
  if (realRatio >= threshold) {
    return { type: 'REAL', confidence: realRatio };
  }
  
  // Allow lower threshold for integer + real combined (numeric)
  if ((integerRatio + realRatio) >= threshold) {
    return { type: 'REAL', confidence: integerRatio + realRatio };
  }
  
  if (booleanRatio >= threshold) {
    return { type: 'BOOLEAN', confidence: booleanRatio };
  }
  
  if (datetimeRatio >= threshold) {
    return { type: 'DATETIME', confidence: datetimeRatio };
  }
  
  if (dateRatio >= threshold) {
    return { type: 'DATE', confidence: dateRatio };
  }
  
  // Default to TEXT
  return { type: 'TEXT', confidence: 1.0 };
}

/**
 * Create default column mappings from CSV headers and table columns
 */
export function createDefaultMappings(
  csvHeaders: string[],
  tableColumns: { name: string; data_type: string }[]
): ColumnMapping[] {
  return csvHeaders.map((csvHeader, index) => {
    // Try to find matching table column by name (case-insensitive)
    const matchingColumn = tableColumns.find(
      col => col.name.toLowerCase() === csvHeader.toLowerCase()
    );
    
    return {
      csvColumn: csvHeader,
      csvIndex: index,
      tableColumn: matchingColumn?.name || '',
      dataType: matchingColumn?.data_type || 'TEXT',
      skip: !matchingColumn, // Skip if no matching column found
    };
  });
}

/**
 * Transform CSV value to appropriate type for database
 */
export function transformValue(value: string, dataType: string): unknown {
  const trimmed = value.trim();
  
  if (trimmed === '' || trimmed.toLowerCase() === 'null') {
    return null;
  }
  
  const type = dataType.toUpperCase();
  
  // Integer types
  if (type.includes('INT') || type.includes('SERIAL')) {
    const num = parseInt(trimmed);
    return isNaN(num) ? null : num;
  }
  
  // Float types
  if (type.includes('FLOAT') || type.includes('REAL') || type.includes('DOUBLE') || 
      type.includes('NUMERIC') || type.includes('DECIMAL')) {
    const num = parseFloat(trimmed);
    return isNaN(num) ? null : num;
  }
  
  // Boolean types
  if (type.includes('BOOL')) {
    const lower = trimmed.toLowerCase();
    if (['true', '1', 't', 'yes', 'y'].includes(lower)) return true;
    if (['false', '0', 'f', 'no', 'n'].includes(lower)) return false;
    return null;
  }
  
  // Date/time types - keep as string, database will parse
  if (type.includes('DATE') || type.includes('TIME')) {
    return trimmed;
  }
  
  // JSON types
  if (type.includes('JSON')) {
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return null;
    }
  }
  
  // Default to string
  return trimmed;
}

/**
 * Validate CSV data against column mappings
 */
export function validateCSVData(
  rows: string[][],
  mappings: ColumnMapping[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check if at least one column is mapped
  const mappedColumns = mappings.filter(m => !m.skip && m.tableColumn);
  if (mappedColumns.length === 0) {
    errors.push('At least one column must be mapped to a table column');
  }
  
  // Check if all rows have consistent column count
  const expectedColumnCount = mappings.length;
  rows.forEach((row, index) => {
    if (row.length !== expectedColumnCount) {
      errors.push(`Row ${index + 1} has ${row.length} columns, expected ${expectedColumnCount}`);
    }
  });
  
  // Limit errors to first 10
  if (errors.length > 10) {
    errors.splice(10, errors.length - 10, `... and ${errors.length - 10} more errors`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Prepare rows for database insertion based on column mappings
 */
export function prepareRowsForInsert(
  rows: string[][],
  mappings: ColumnMapping[]
): Record<string, unknown>[] {
  const mappedColumns = mappings.filter(m => !m.skip && m.tableColumn);
  
  return rows.map(row => {
    const record: Record<string, unknown> = {};
    
    for (const mapping of mappedColumns) {
      const value = row[mapping.csvIndex];
      record[mapping.tableColumn] = transformValue(value, mapping.dataType);
    }
    
    return record;
  });
}
