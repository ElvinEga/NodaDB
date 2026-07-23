import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
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
import { RelationMatch } from '@/types';
import { toast } from 'sonner';
import {
  ExportFormat,
  exportAllMatches,
  getFileExtension,
  getMimeType,
  serializeExportContent,
  copyToClipboard,
} from '@/lib/exportFormats';

interface ExportAllFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matches: RelationMatch[];
  value: string;
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
  csv: 'CSV (Combined)',
  json: 'JSON Map',
  sql: 'SQL INSERT statements',
  excel: 'Excel Workbook (Multi-sheet)',
  markdown: 'Markdown Document',
  html: 'HTML Webpage',
};

const formatDescriptions: Record<ExportFormat, string> = {
  csv: 'Comma-separated values per table in a single text file',
  json: 'JSON object mapping table_name to lists of objects',
  sql: 'SQL INSERT statements for all matched tables',
  excel: 'Microsoft Excel workbook with one worksheet tab per table',
  markdown: 'Markdown document with headings and formatted tables',
  html: 'Single styled HTML page displaying all relation tables',
};

export function ExportAllFlowDialog({
  open,
  onOpenChange,
  matches,
  value,
}: ExportAllFlowDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [filename, setFilename] = useState(`relation-flow-${value.substring(0, 8)}`);
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [delimiter, setDelimiter] = useState(',');

  const totalRowCount = matches.reduce((acc, curr) => acc + curr.sample_rows.rows.length, 0);

  const handleExport = async () => {
    try {
      const options = {
        tableName: filename,
        includeHeaders,
        delimiter,
        sqlTableName: filename,
      };

      const content = exportAllMatches(matches, format, options);
      const extension = getFileExtension(format);

      const selectedPath = await save({
        title: "Export All Flow Data",
        defaultPath: `${filename}.${extension}`,
        filters: [
          {
            name: formatNames[format],
            extensions: [extension],
          },
        ],
      });

      if (!selectedPath) {
        return;
      }

      await invoke("save_export_file", {
        path: selectedPath,
        bytes: serializeExportContent(content),
      });

      toast.success(`Saved all ${matches.length} tables (${totalRowCount} rows) as ${formatNames[format]}`);
      onOpenChange(false);
    } catch (error) {
      toast.error(`Export failed: ${error}`);
      console.error('Export error:', error);
    }
  };

  const handleCopy = async () => {
    try {
      const options = {
        tableName: filename,
        includeHeaders,
        delimiter,
        sqlTableName: filename,
      };

      const content = exportAllMatches(matches, format, options);
      if (typeof content !== 'string') {
        toast.error('Cannot copy Excel format to clipboard. Use Download instead.');
        return;
      }

      await copyToClipboard(content, format);
      toast.success(`Copied all flow data to clipboard as ${formatNames[format]}`);
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
            Export All Flow Data
          </DialogTitle>
          <DialogDescription>
            Export all {matches.length} matched tables ({totalRowCount.toLocaleString()} total rows) together in a single file or workbook.
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

          {/* Stats Summary */}
          <div className="p-3 bg-secondary/30 border border-border rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Total Tables</div>
                <div className="font-semibold">{matches.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Total Rows</div>
                <div className="font-semibold">{totalRowCount.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Target Format</div>
                <div className="font-semibold">{formatNames[format].split(' ')[0]}</div>
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
          <Button onClick={() => void handleExport()}>
            <Download className="h-4 w-4 mr-2" />
            Download File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
