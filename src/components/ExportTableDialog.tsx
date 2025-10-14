import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Loader2, Copy, Download, FileCode } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConnectionConfig, DatabaseTable } from '@/types';
import { toast } from 'sonner';

interface ExportTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionConfig;
  table: DatabaseTable;
}

export function ExportTableDialog({
  open,
  onOpenChange,
  connection,
  table,
}: ExportTableDialogProps) {
  const [sql, setSql] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadTableStructure();
    }
  }, [open, table.name]);

  const loadTableStructure = async () => {
    setIsLoading(true);
    try {
      const result = await invoke<string>('export_table_structure', {
        connectionId: connection.id,
        tableName: table.name,
        dbType: connection.db_type,
      });
      setSql(result);
    } catch (error) {
      toast.error(`Failed to export table structure: ${error}`);
      console.error('Export error:', error);
      setSql('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      toast.success('SQL copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
      console.error('Copy error:', error);
    }
  };

  const handleDownloadFile = () => {
    try {
      const blob = new Blob([sql], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${table.name}_structure.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('SQL file downloaded');
    } catch (error) {
      toast.error('Failed to download file');
      console.error('Download error:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-primary" />
            Export Table Structure
          </DialogTitle>
          <DialogDescription>
            CREATE TABLE statement for <span className="font-mono font-semibold text-foreground">{table.name}</span>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
              <p className="text-sm text-muted-foreground">Generating SQL...</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 border border-border rounded-md bg-secondary/30">
            <pre className="p-4 text-xs font-mono leading-relaxed">
              <code className="text-foreground">{sql || 'No SQL generated'}</code>
            </pre>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Close
          </Button>
          <Button
            variant="outline"
            onClick={handleCopyToClipboard}
            disabled={isLoading || !sql}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy to Clipboard
          </Button>
          <Button
            variant="default"
            onClick={handleDownloadFile}
            disabled={isLoading || !sql}
          >
            <Download className="h-4 w-4 mr-2" />
            Download SQL File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
