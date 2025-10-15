import { useState } from 'react';
import { Download, Copy, FileText, FileJson, Database, Sheet, FileCode, Globe } from 'lucide-react';
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
import { QueryResult } from '@/types';
import { toast } from 'sonner';
import {
  ExportFormat,
  exportToCSV,
  exportToJSON,
  exportToSQL,
  exportToExcel,
  exportToMarkdown,
  exportToHTML,
  downloadFile,
  copyToClipboard,
  getFileExtension,
  getMimeType,
} from '@/lib/exportFormats';

interface ExportDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: QueryResult;
  tableName?: string;
}

const formatIcons: Record<ExportFormat, any> = {
  csv: FileText,
  json: FileJson,
  sql: Database,
  excel: Sheet,
  markdown: FileCode,
  html: Globe,
};

const formatNames: Record<ExportFormat, string> = {
  csv: 'CSV',
  json: 'JSON',
  sql: 'SQL INSERT',
  excel: 'Excel (XLSX)',
  markdown: 'Markdown',
  html: 'HTML',
};

const formatDescriptions: Record<ExportFormat, string> = {
  csv: 'Comma-separated values, compatible with Excel and most tools',
  json: 'JavaScript Object Notation, ideal for APIs and web applications',
  sql: 'SQL INSERT statements to recreate the data in any database',
  excel: 'Microsoft Excel spreadsheet with formatting',
  markdown: 'Markdown table format, perfect for documentation',
  html: 'Styled HTML table ready for web pages',
};

export function ExportDataDialog({
  open,
  onOpenChange,
  data,
  tableName = 'data',
}: ExportDataDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [filename, setFilename] = useState(tableName);
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [delimiter, setDelimiter] = useState(',');

  const handleExport = () => {
    try {
      let content: string | Blob;
      const options = {
        tableName: filename,
        includeHeaders,
        delimiter,
        sqlTableName: filename,
      };

      switch (format) {
        case 'csv':
          content = exportToCSV(data, options);
          break;
        case 'json':
          content = exportToJSON(data, options);
          break;
        case 'sql':
          content = exportToSQL(data, options);
          break;
        case 'excel':
          content = exportToExcel(data, options);
          break;
        case 'markdown':
          content = exportToMarkdown(data, options);
          break;
        case 'html':
          content = exportToHTML(data, options);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      const extension = getFileExtension(format);
      const mimeType = getMimeType(format);
      downloadFile(content, `${filename}.${extension}`, mimeType);

      toast.success(`Exported ${data.rows.length} rows as ${formatNames[format]}`);
      onOpenChange(false);
    } catch (error) {
      toast.error(`Export failed: ${error}`);
      console.error('Export error:', error);
    }
  };

  const handleCopy = async () => {
    try {
      let content: string;
      const options = {
        tableName: filename,
        includeHeaders,
        delimiter,
        sqlTableName: filename,
      };

      switch (format) {
        case 'csv':
          content = exportToCSV(data, options);
          break;
        case 'json':
          content = exportToJSON(data, options);
          break;
        case 'sql':
          content = exportToSQL(data, options);
          break;
        case 'markdown':
          content = exportToMarkdown(data, options);
          break;
        case 'html':
          content = exportToHTML(data, options);
          break;
        case 'excel':
          toast.error('Cannot copy Excel format to clipboard. Use Download instead.');
          return;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      await copyToClipboard(content, format);
      toast.success(`Copied ${data.rows.length} rows to clipboard as ${formatNames[format]}`);
    } catch (error) {
      toast.error(`Copy failed: ${error}`);
      console.error('Copy error:', error);
    }
  };

  const FormatIcon = formatIcons[format];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Export Data
          </DialogTitle>
          <DialogDescription>
            Export {data.rows.length.toLocaleString()} row(s) × {data.columns.length} column(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(formatNames) as ExportFormat[]).map((fmt) => {
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
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <FormatIcon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              {formatDescriptions[format]}
            </p>
          </div>

          {/* Filename */}
          <div className="space-y-2">
            <Label htmlFor="filename">Filename</Label>
            <div className="flex gap-2">
              <Input
                id="filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="export"
                className="flex-1"
              />
              <div className="flex items-center px-3 bg-secondary rounded-md border">
                <span className="text-sm text-muted-foreground font-mono">
                  .{getFileExtension(format)}
                </span>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3 p-3 border border-border rounded-lg bg-secondary/30">
            <Label className="text-sm font-semibold">Options</Label>

            {/* Include Headers */}
            {format !== 'excel' && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeHeaders"
                  checked={includeHeaders}
                  onCheckedChange={(checked) => setIncludeHeaders(checked as boolean)}
                />
                <Label
                  htmlFor="includeHeaders"
                  className="text-sm font-normal cursor-pointer"
                >
                  Include column headers
                </Label>
              </div>
            )}

            {/* Delimiter for CSV */}
            {format === 'csv' && (
              <div className="space-y-2">
                <Label htmlFor="delimiter" className="text-sm">
                  Delimiter
                </Label>
                <Select value={delimiter} onValueChange={setDelimiter}>
                  <SelectTrigger id="delimiter" className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=",">Comma (,)</SelectItem>
                    <SelectItem value=";">Semicolon (;)</SelectItem>
                    <SelectItem value="\t">Tab (\t)</SelectItem>
                    <SelectItem value="|">Pipe (|)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="p-3 bg-secondary/30 border border-border rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Rows</div>
                <div className="font-semibold">{data.rows.length.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Columns</div>
                <div className="font-semibold">{data.columns.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Format</div>
                <div className="font-semibold">{formatNames[format]}</div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handleCopy} disabled={format === 'excel'}>
            <Copy className="h-4 w-4 mr-2" />
            Copy to Clipboard
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Download File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
