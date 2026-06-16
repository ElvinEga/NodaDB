import * as XLSX from 'xlsx';
import {
  DatabaseExportData,
  DatabaseExportTableData,
  DatabaseTable,
} from '@/types';
import {
  ExportFormat,
  ExportOptions,
  exportToCSV,
  exportToHTML,
  exportToJSON,
  exportToMarkdown,
  exportToSQL,
  serializeExportContent,
} from '@/lib/exportFormats';

export interface ExportArchiveEntry {
  path: string;
  bytes: number[];
}

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;
const INVALID_SHEET_CHARS = /[:\\/?*\[\]]/g;

export function isExportableBaseTable(table: DatabaseTable): boolean {
  return (table.table_type ?? 'TABLE').toUpperCase() === 'TABLE';
}

export function getDatabaseExportBaseName(name: string): string {
  const sanitized = name
    .trim()
    .replace(INVALID_FILENAME_CHARS, '_')
    .replace(/\s+/g, '_');

  return sanitized.length > 0 ? sanitized : 'database-export';
}

export function getExportTableLabel(table: DatabaseTable): string {
  return table.full_name ?? (table.schema ? `${table.schema}.${table.name}` : table.name);
}

export function getExportTableFileBase(table: DatabaseTable): string {
  return getDatabaseExportBaseName(getExportTableLabel(table).replace(/\./g, '__'));
}

function getJsonTableRows(
  table: DatabaseExportTableData,
  includeHeaders: boolean,
): unknown[] {
  if (includeHeaders) {
    return table.result.rows;
  }

  return table.result.rows.map((row) =>
    table.result.columns.map((column) => row[column]),
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtmlIndex(payload: DatabaseExportData): string {
  const rows = payload.tables
    .map((table) => {
      const fileBase = getExportTableFileBase(table.table);
      const label = getExportTableLabel(table.table);
      return `<li><a href="tables/${fileBase}.html">${escapeHtml(label)}</a> <span>(${table.result.rows.length.toLocaleString()} rows)</span></li>`;
    })
    .join('\n');

  return [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '  <meta charset="UTF-8">',
    `  <title>${escapeHtml(payload.connectionName)} Export</title>`,
    '  <style>',
    '    body { font-family: Arial, sans-serif; margin: 2rem; color: #111827; }',
    '    h1 { margin-bottom: 0.5rem; }',
    '    p { color: #4b5563; }',
    '    ul { padding-left: 1.25rem; }',
    '    li { margin-bottom: 0.5rem; }',
    '    a { color: #2563eb; text-decoration: none; }',
    '    a:hover { text-decoration: underline; }',
    '  </style>',
    '</head>',
    '<body>',
    `  <h1>${escapeHtml(payload.connectionName)} export</h1>`,
    `  <p>Generated at ${escapeHtml(payload.exportedAt)} · ${payload.tables.length.toLocaleString()} table(s)</p>`,
    '  <ul>',
    rows,
    '  </ul>',
    '</body>',
    '</html>',
  ].join('\n');
}

function getUniqueSheetName(
  preferred: string,
  usedNames: Set<string>,
): string {
  const base = preferred.replace(INVALID_SHEET_CHARS, '_').slice(0, 31) || 'Sheet';

  if (!usedNames.has(base)) {
    usedNames.add(base);
    return base;
  }

  let index = 2;
  while (index < 1000) {
    const suffix = `_${index}`;
    const candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
    index += 1;
  }

  const fallback = `Sheet_${usedNames.size + 1}`.slice(0, 31);
  usedNames.add(fallback);
  return fallback;
}

export function exportDatabaseToJSON(
  payload: DatabaseExportData,
  options: ExportOptions = {},
): string {
  const { includeHeaders = true } = options;

  return JSON.stringify(
    {
      connectionName: payload.connectionName,
      dbType: payload.dbType,
      exportedAt: payload.exportedAt,
      tables: payload.tables.map((table) => ({
        name: table.table.name,
        schema: table.table.schema ?? null,
        fullName:
          table.table.full_name ??
          (table.table.schema
            ? `${table.table.schema}.${table.table.name}`
            : table.table.name),
        columns: table.result.columns,
        rowCount: table.result.rows.length,
        rows: getJsonTableRows(table, includeHeaders),
      })),
    },
    null,
    2,
  );
}

export function exportDatabaseToSQL(
  payload: DatabaseExportData,
  options: ExportOptions = {},
): string {
  const sections = payload.tables.map((table) => {
    const tableName = getExportTableLabel(table.table);
    return exportToSQL(table.result, {
      ...options,
      sqlTableName: tableName,
    }).trim();
  });

  return [
    `-- Database export from ${payload.connectionName}`,
    `-- Generated at ${payload.exportedAt}`,
    `-- ${payload.tables.length} table(s)`,
    '',
    ...sections,
    '',
  ].join('\n');
}

export function exportDatabaseToExcel(
  payload: DatabaseExportData,
): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();

  payload.tables.forEach((table) => {
    const rows: unknown[][] = [table.result.columns];
    table.result.rows.forEach((row) => {
      rows.push(table.result.columns.map((column) => row[column]));
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = table.result.columns.map((column) => ({
      wch: Math.max(column.length, 12),
    }));

    const sheetName = getUniqueSheetName(getExportTableLabel(table.table), usedSheetNames);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(excelBuffer);
}

export function buildDatabaseArchiveEntries(
  payload: DatabaseExportData,
  format: Extract<ExportFormat, 'csv' | 'markdown' | 'html'>,
  options: ExportOptions = {},
): ExportArchiveEntry[] {
  const entries: ExportArchiveEntry[] = [];

  payload.tables.forEach((table) => {
    const fileBase = getExportTableFileBase(table.table);
    const tableLabel = getExportTableLabel(table.table);
    let content = '';
    let extension = '';

    switch (format) {
      case 'csv':
        content = exportToCSV(table.result, {
          ...options,
          tableName: tableLabel,
        });
        extension = 'csv';
        break;
      case 'markdown':
        content = exportToMarkdown(table.result, options);
        extension = 'md';
        break;
      case 'html':
        content = exportToHTML(table.result, {
          ...options,
          tableName: tableLabel,
        });
        extension = 'html';
        break;
    }

    entries.push({
      path: `tables/${fileBase}.${extension}`,
      bytes: serializeExportContent(content),
    });
  });

  if (format === 'html') {
    entries.unshift({
      path: 'index.html',
      bytes: serializeExportContent(buildHtmlIndex(payload)),
    });
  }

  return entries;
}
