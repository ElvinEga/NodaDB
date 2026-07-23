import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { Archive, Database, Download, FileCode, FileJson, Globe, Loader2, Sheet, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ConnectionConfig, DatabaseExportData, DatabaseExportTableData, DatabaseTable, QueryResult } from '@/types';
import { toast } from 'sonner';
import { ExportFormat, getFileExtension, serializeExportContent } from '@/lib/exportFormats';
import {
  buildDatabaseArchiveEntries,
  exportDatabaseToExcel,
  exportDatabaseToJSON,
  exportDatabaseToSQL,
  getDatabaseExportBaseName,
  getExportTableLabel,
  isExportableBaseTable,
} from '@/lib/databaseExport';
import { qualifyTableName } from '@/lib/sqlUtils';

interface ExportDatabaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionConfig;
  tables: DatabaseTable[];
}

type DatabaseExportFormat = ExportFormat;

const formatIcons: Record<DatabaseExportFormat, any> = {
  csv: FileText,
  json: FileJson,
  sql: Database,
  excel: Sheet,
  markdown: FileCode,
  html: Globe,
};

const formatNames: Record<DatabaseExportFormat, string> = {
  csv: 'CSV Bundle (ZIP)',
  json: 'JSON',
  sql: 'SQL INSERT',
  excel: 'Excel (XLSX)',
  markdown: 'Markdown Bundle (ZIP)',
  html: 'HTML Bundle (ZIP)',
};

const formatDescriptions: Record<DatabaseExportFormat, string> = {
  csv: 'Creates one ZIP containing one CSV file per table.',
  json: 'Exports all tables into a single structured JSON document.',
  sql: 'Creates one SQL file with INSERT statements grouped by table.',
  excel: 'Creates one Excel workbook with one worksheet per table.',
  markdown: 'Creates one ZIP containing one Markdown file per table.',
  html: 'Creates one ZIP containing an index page and one HTML file per table.',
};

export function ExportDatabaseDialog({
  open,
  onOpenChange,
  connection,
  tables,
}: ExportDatabaseDialogProps) {
  const exportableTables = useMemo(
    () => tables.filter(isExportableBaseTable),
    [tables],
  );
  const [format, setFormat] = useState<DatabaseExportFormat>('json');
  const [filename, setFilename] = useState(getDatabaseExportBaseName(connection.name));
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [delimiter, setDelimiter] = useState(',');
  const [isExporting, setIsExporting] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFilename(getDatabaseExportBaseName(connection.name));
      setProgressMessage(null);
    }
  }, [connection.name, open]);

  const handleExport = async () => {
    if (exportableTables.length === 0) {
      toast.error('No base tables available to export');
      return;
    }

    setIsExporting(true);

    try {
      const tablePayloads: DatabaseExportTableData[] = [];

      for (const [index, table] of exportableTables.entries()) {
        const label = getExportTableLabel(table);
        setProgressMessage(`Loading ${label} (${index + 1}/${exportableTables.length})`);

        const query = `SELECT * FROM ${qualifyTableName(
          table.full_name ?? table.name,
          table.schema,
          connection.db_type,
        )}`;
        const result = await invoke<QueryResult>('execute_query', {
          connectionId: connection.id,
          query,
        });

        tablePayloads.push({
          table,
          result,
        });
      }

      const payload: DatabaseExportData = {
        connectionName: connection.name,
        dbType: connection.db_type,
        exportedAt: new Date().toISOString(),
        tables: tablePayloads,
      };

      const options = {
        tableName: filename,
        includeHeaders,
        delimiter,
        sqlTableName: filename,
      };

      let bytes: number[];
      let saveExtension: string;
      let filterName: string;

      switch (format) {
        case 'json':
          bytes = serializeExportContent(exportDatabaseToJSON(payload, options));
          saveExtension = getFileExtension(format);
          filterName = formatNames[format];
          break;
        case 'sql':
          bytes = serializeExportContent(exportDatabaseToSQL(payload, options));
          saveExtension = getFileExtension(format);
          filterName = formatNames[format];
          break;
        case 'excel':
          bytes = serializeExportContent(exportDatabaseToExcel(payload));
          saveExtension = getFileExtension(format);
          filterName = formatNames[format];
          break;
        case 'csv':
        case 'markdown':
        case 'html': {
          setProgressMessage(`Packaging ${exportableTables.length} table exports`);
          const entries = buildDatabaseArchiveEntries(payload, format, options);
          bytes = await invoke<number[]>('create_export_archive', { entries });
          saveExtension = 'zip';
          filterName = 'ZIP Archive';
          break;
        }
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      const selectedPath = await save({
        title: 'Export Database',
        defaultPath: `${filename}.${saveExtension}`,
        filters: [
          {
            name: filterName,
            extensions: [saveExtension],
          },
        ],
      });

      if (!selectedPath) {
        return;
      }

      await invoke('save_export_file', {
        path: selectedPath,
        bytes,
      });

      toast.success(`Exported ${exportableTables.length} table(s) as ${formatNames[format]}`);
      onOpenChange(false);
    } catch (error) {
      toast.error(`Database export failed: ${error}`);
      console.error('Database export error:', error);
    } finally {
      setIsExporting(false);
      setProgressMessage(null);
    }
  };

  const FormatIcon = formatIcons[format];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            Export Database
          </DialogTitle>
          <DialogDescription>
            Export {exportableTables.length.toLocaleString()} base table(s) from {connection.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">
            This exports table data only for the current connection. Views and schema structure stay out of this v1 flow.
          </div>

          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select value={format} onValueChange={(value) => setFormat(value as DatabaseExportFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(formatNames) as DatabaseExportFormat[]).map((fmt) => {
                  const Icon = formatIcons[fmt];
                  return (
                    <SelectItem key={fmt} value={fmt}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{formatNames[fmt]}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <FormatIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              {formatDescriptions[format]}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="database-export-filename">Filename</Label>
            <div className="flex gap-2">
              <Input
                id="database-export-filename"
                value={filename}
                onChange={(event) => setFilename(event.target.value)}
                placeholder="database-export"
                className="flex-1"
                disabled={isExporting}
              />
              <div className="flex items-center rounded-md border bg-secondary px-3 text-sm text-muted-foreground font-mono">
                .{format === 'csv' || format === 'markdown' || format === 'html' ? 'zip' : getFileExtension(format)}
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
            <Label className="text-sm font-semibold">Options</Label>

            {format !== 'excel' && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="database-include-headers"
                  checked={includeHeaders}
                  onCheckedChange={(checked) => setIncludeHeaders(checked === true)}
                  disabled={isExporting}
                />
                <Label htmlFor="database-include-headers" className="text-sm font-normal cursor-pointer">
                  Include headers / object keys
                </Label>
              </div>
            )}

            {format === 'csv' && (
              <div className="space-y-2">
                <Label htmlFor="database-delimiter">CSV delimiter</Label>
                <Input
                  id="database-delimiter"
                  value={delimiter}
                  onChange={(event) => setDelimiter(event.target.value || ',')}
                  maxLength={1}
                  className="w-24"
                  disabled={isExporting}
                />
              </div>
            )}
          </div>

          {progressMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{progressMessage}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleExport()}
            disabled={isExporting || exportableTables.length === 0 || filename.trim().length === 0}
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Database
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
