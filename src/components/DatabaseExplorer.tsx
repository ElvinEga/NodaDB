import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Table, Database, Loader2, RefreshCw, Plus, MoreVertical, Trash2, Edit, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateTableDialog } from '@/components/CreateTableDialog';
import { ExportTableDialog } from '@/components/ExportTableDialog';
import { DatabaseTable, ConnectionConfig } from '@/types';
import { toast } from 'sonner';

interface DatabaseExplorerProps {
  connection: ConnectionConfig;
  onTableSelect: (table: DatabaseTable) => void;
  selectedTable: DatabaseTable | null;
  onNewQuery?: () => void;
}

export function DatabaseExplorer({ connection, onTableSelect, selectedTable, onNewQuery }: DatabaseExplorerProps) {
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [createTableDialogOpen, setCreateTableDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [tableToExport, setTableToExport] = useState<DatabaseTable | null>(null);

  const loadTables = async () => {
    setIsLoading(true);
    try {
      const result = await invoke<DatabaseTable[]>('list_tables', {
        connectionId: connection.id,
        dbType: connection.db_type,
      });
      setTables(result);
    } catch (error) {
      toast.error(`Failed to load tables: ${error}`);
      console.error('Error loading tables:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDropTable = async (tableName: string) => {
    if (!confirm(`Are you sure you want to drop table "${tableName}"?\n\nThis action cannot be undone!`)) {
      return;
    }

    try {
      const result = await invoke<string>('drop_table', {
        connectionId: connection.id,
        tableName,
      });
      toast.success(result);
      loadTables();
    } catch (error) {
      toast.error(`Failed to drop table: ${error}`);
      console.error('Drop table error:', error);
    }
  };

  const handleRenameTable = async (oldName: string) => {
    const newName = prompt(`Rename table "${oldName}" to:`, oldName);
    if (!newName || newName === oldName) return;

    try {
      const result = await invoke<string>('rename_table', {
        connectionId: connection.id,
        oldName,
        newName,
        dbType: connection.db_type,
      });
      toast.success(result);
      loadTables();
    } catch (error) {
      toast.error(`Failed to rename table: ${error}`);
      console.error('Rename table error:', error);
    }
  };

  useEffect(() => {
    loadTables();
  }, [connection.id]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">Tables</h2>
            {tables.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
                {tables.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={loadTables}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCreateTableDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {onNewQuery && (
          <Button
            variant="outline"
            size="sm"
            onClick={onNewQuery}
            className="w-full text-xs"
          >
            <Plus className="h-3 w-3 mr-1.5" />
            New Query
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
          <div className="p-2">
            {isLoading && tables.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading tables...
              </div>
            ) : tables.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No tables found
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-2 py-1">
                  <div className="text-xs font-semibold text-muted-foreground">
                    TABLES ({tables.length})
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => setCreateTableDialogOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                {tables.map((table) => (
                  <div
                    key={table.name}
                    className="flex items-center gap-1 group"
                  >
                    <button
                      onClick={() => onTableSelect(table)}
                      className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                        selectedTable?.name === table.name
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <Table className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{table.name}</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onTableSelect(table)}>
                          <Table className="h-4 w-4 mr-2" />
                          View Data
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setTableToExport(table);
                          setExportDialogOpen(true);
                        }}>
                          <FileCode className="h-4 w-4 mr-2" />
                          Export Structure
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleRenameTable(table.name)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDropTable(table.name)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Drop Table
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>
      </ScrollArea>

      <CreateTableDialog
        open={createTableDialogOpen}
        onOpenChange={setCreateTableDialogOpen}
        connection={connection}
        onSuccess={loadTables}
      />

      {tableToExport && (
        <ExportTableDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          connection={connection}
          table={tableToExport}
        />
      )}
    </div>
  );
}
