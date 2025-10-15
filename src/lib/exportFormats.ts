import { QueryResult } from '@/types';
import * as XLSX from 'xlsx';

export type ExportFormat = 'csv' | 'json' | 'sql' | 'excel' | 'markdown' | 'html';

export interface ExportOptions {
  tableName?: string;
  includeHeaders?: boolean;
  delimiter?: string;
  sqlTableName?: string;
}

/**
 * Export data to CSV format
 */
export function exportToCSV(
  data: QueryResult,
  options: ExportOptions = {}
): string {
  const { includeHeaders = true, delimiter = ',' } = options;

  const escapeCSVValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Escape quotes and wrap in quotes if contains delimiter, quote, or newline
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [];

  // Add headers
  if (includeHeaders) {
    lines.push(data.columns.map(escapeCSVValue).join(delimiter));
  }

  // Add data rows
  data.rows.forEach((row) => {
    const values = data.columns.map((col) => escapeCSVValue(row[col]));
    lines.push(values.join(delimiter));
  });

  return lines.join('\n');
}

/**
 * Export data to JSON format
 */
export function exportToJSON(
  data: QueryResult,
  options: ExportOptions = {}
): string {
  const { includeHeaders = true } = options;

  if (includeHeaders) {
    // Export as array of objects
    return JSON.stringify(data.rows, null, 2);
  } else {
    // Export as array of arrays
    const arrayData = data.rows.map((row) =>
      data.columns.map((col) => row[col])
    );
    return JSON.stringify(arrayData, null, 2);
  }
}

/**
 * Export data to SQL INSERT statements
 */
export function exportToSQL(
  data: QueryResult,
  options: ExportOptions = {}
): string {
  const { sqlTableName = 'table_name' } = options;

  if (data.rows.length === 0) {
    return `-- No data to export\n`;
  }

  const escapeSQL = (value: any): string => {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    // String value - escape single quotes
    return `'${String(value).replace(/'/g, "''")}'`;
  };

  const lines: string[] = [];

  // Add header comment
  lines.push(`-- Data export from ${sqlTableName}`);
  lines.push(`-- ${data.rows.length} rows\n`);

  // Column list
  const columnList = data.columns.join(', ');

  // Generate INSERT statements
  // Batch inserts for better performance (100 rows per INSERT)
  const batchSize = 100;
  for (let i = 0; i < data.rows.length; i += batchSize) {
    const batch = data.rows.slice(i, i + batchSize);

    lines.push(`INSERT INTO ${sqlTableName} (${columnList}) VALUES`);

    const valueRows = batch.map((row, index) => {
      const values = data.columns.map((col) => escapeSQL(row[col]));
      const isLast = index === batch.length - 1;
      return `  (${values.join(', ')})${isLast ? ';' : ','}`;
    });

    lines.push(...valueRows);
    lines.push(''); // Empty line between batches
  }

  return lines.join('\n');
}

/**
 * Export data to Excel format (returns blob)
 */
export function exportToExcel(
  data: QueryResult,
  options: ExportOptions = {}
): Blob {
  const { tableName = 'Sheet1' } = options;
  // Note: options parameter available for future enhancements

  // Create worksheet data
  const wsData: any[][] = [];

  // Add headers
  wsData.push(data.columns);

  // Add data rows
  data.rows.forEach((row) => {
    wsData.push(data.columns.map((col) => row[col]));
  });

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  const colWidths = data.columns.map((col) => ({
    wch: Math.max(col.length, 10),
  }));
  ws['!cols'] = colWidths;

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tableName);

  // Generate Excel file
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Export data to Markdown table format
 */
export function exportToMarkdown(
  data: QueryResult,
  _options: ExportOptions = {}
): string {
  if (data.rows.length === 0) {
    return '> No data to export\n';
  }

  const lines: string[] = [];

  // Calculate column widths
  const widths = data.columns.map((col) => {
    const headerWidth = col.length;
    const dataWidth = Math.max(
      ...data.rows.map((row) => {
        const value = row[col];
        return value === null || value === undefined ? 4 : String(value).length;
      })
    );
    return Math.max(headerWidth, dataWidth, 3);
  });

  // Pad string to width
  const pad = (str: string, width: number): string => {
    return str.padEnd(width, ' ');
  };

  // Format value
  const formatValue = (value: any, width: number): string => {
    if (value === null || value === undefined) {
      return pad('NULL', width);
    }
    return pad(String(value), width);
  };

  // Header row
  const header = data.columns
    .map((col, idx) => pad(col, widths[idx]))
    .join(' | ');
  lines.push(`| ${header} |`);

  // Separator row
  const separator = widths.map((w) => '-'.repeat(w)).join(' | ');
  lines.push(`| ${separator} |`);

  // Data rows
  data.rows.forEach((row) => {
    const rowData = data.columns
      .map((col, idx) => formatValue(row[col], widths[idx]))
      .join(' | ');
    lines.push(`| ${rowData} |`);
  });

  return lines.join('\n');
}

/**
 * Export data to HTML table format
 */
export function exportToHTML(
  data: QueryResult,
  options: ExportOptions = {}
): string {
  const { tableName = 'Data Table' } = options;

  const lines: string[] = [];

  lines.push('<!DOCTYPE html>');
  lines.push('<html>');
  lines.push('<head>');
  lines.push('  <meta charset="UTF-8">');
  lines.push(`  <title>${tableName}</title>`);
  lines.push('  <style>');
  lines.push('    table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }');
  lines.push('    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }');
  lines.push('    th { background-color: #4CAF50; color: white; font-weight: bold; }');
  lines.push('    tr:nth-child(even) { background-color: #f2f2f2; }');
  lines.push('    tr:hover { background-color: #ddd; }');
  lines.push('  </style>');
  lines.push('</head>');
  lines.push('<body>');
  lines.push(`  <h1>${tableName}</h1>`);
  lines.push('  <table>');

  // Header
  lines.push('    <thead>');
  lines.push('      <tr>');
  data.columns.forEach((col) => {
    lines.push(`        <th>${col}</th>`);
  });
  lines.push('      </tr>');
  lines.push('    </thead>');

  // Body
  lines.push('    <tbody>');
  data.rows.forEach((row) => {
    lines.push('      <tr>');
    data.columns.forEach((col) => {
      const value = row[col];
      const displayValue =
        value === null || value === undefined ? '<em>NULL</em>' : String(value);
      lines.push(`        <td>${displayValue}</td>`);
    });
    lines.push('      </tr>');
  });
  lines.push('    </tbody>');

  lines.push('  </table>');
  lines.push('</body>');
  lines.push('</html>');

  return lines.join('\n');
}

/**
 * Download data as a file
 */
export function downloadFile(
  content: string | Blob,
  filename: string,
  mimeType: string
): void {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy data to clipboard
 */
export async function copyToClipboard(
  content: string,
  _format: ExportFormat = 'csv'
): Promise<void> {
  try {
    await navigator.clipboard.writeText(content);
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = content;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}

/**
 * Get file extension for format
 */
export function getFileExtension(format: ExportFormat): string {
  const extensions: Record<ExportFormat, string> = {
    csv: 'csv',
    json: 'json',
    sql: 'sql',
    excel: 'xlsx',
    markdown: 'md',
    html: 'html',
  };
  return extensions[format];
}

/**
 * Get MIME type for format
 */
export function getMimeType(format: ExportFormat): string {
  const mimeTypes: Record<ExportFormat, string> = {
    csv: 'text/csv',
    json: 'application/json',
    sql: 'text/plain',
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    markdown: 'text/markdown',
    html: 'text/html',
  };
  return mimeTypes[format];
}
