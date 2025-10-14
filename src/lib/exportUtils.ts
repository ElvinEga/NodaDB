import { QueryResult } from '@/types';
import * as XLSX from 'xlsx';

/**
 * Export query results to CSV format
 */
export function exportToCSV(result: QueryResult, filename = 'export.csv') {
  if (!result.columns || result.columns.length === 0) {
    throw new Error('No data to export');
  }

  // Build CSV content
  const headers = result.columns.join(',');
  const rows = result.rows.map((row) => {
    return result.columns
      .map((col) => {
        const value = row[col];
        // Handle null/undefined
        if (value === null || value === undefined) return '';
        // Escape strings with quotes
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(',');
  });

  const csv = [headers, ...rows].join('\n');

  // Download file
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export query results to JSON format
 */
export function exportToJSON(result: QueryResult, filename = 'export.json') {
  if (!result.rows || result.rows.length === 0) {
    throw new Error('No data to export');
  }

  const json = JSON.stringify(result.rows, null, 2);

  // Download file
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export query results to Excel format (XLSX)
 */
export function exportToExcel(result: QueryResult, filename = 'export.xlsx') {
  if (!result.columns || result.columns.length === 0) {
    throw new Error('No data to export');
  }

  // Convert rows to array of arrays for xlsx
  const data = [
    result.columns, // Header row
    ...result.rows.map((row) =>
      result.columns.map((col) => {
        const value = row[col];
        return value === null || value === undefined ? '' : value;
      })
    ),
  ];

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Auto-size columns
  const colWidths = result.columns.map((col) => {
    const maxLength = Math.max(
      col.length,
      ...result.rows
        .map((row) => String(row[col] || '').length)
        .slice(0, 100) // Sample first 100 rows for performance
    );
    return { wch: Math.min(maxLength + 2, 50) }; // Max width 50
  });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  // Write file
  XLSX.writeFile(wb, filename);
}

/**
 * Copy query results to clipboard as TSV (for pasting into Excel)
 */
export function copyToClipboard(result: QueryResult): Promise<void> {
  if (!result.columns || result.columns.length === 0) {
    throw new Error('No data to copy');
  }

  // Build TSV content
  const headers = result.columns.join('\t');
  const rows = result.rows.map((row) => {
    return result.columns
      .map((col) => {
        const value = row[col];
        return value === null || value === undefined ? '' : String(value);
      })
      .join('\t');
  });

  const tsv = [headers, ...rows].join('\n');

  return navigator.clipboard.writeText(tsv);
}
