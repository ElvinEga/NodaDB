import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ChevronRight, ChevronDown, Table, Database, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatabaseTable, ConnectionConfig } from '@/types';
import { toast } from 'sonner';

interface DatabaseExplorerProps {
  connection: ConnectionConfig;
  onTableSelect: (table: DatabaseTable) => void;
  selectedTable: DatabaseTable | null;
}

export function DatabaseExplorer({ connection, onTableSelect, selectedTable }: DatabaseExplorerProps) {
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

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

  useEffect(() => {
    loadTables();
  }, [connection.id]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <Database className="h-4 w-4" />
            <span>{connection.name}</span>
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadTables}
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {connection.db_type.toUpperCase()}
          {connection.file_path && ` • ${connection.file_path.split('/').pop()}`}
        </div>
      </div>

      {isExpanded && (
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
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
                  TABLES ({tables.length})
                </div>
                {tables.map((table) => (
                  <button
                    key={table.name}
                    onClick={() => onTableSelect(table)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                      selectedTable?.name === table.name
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <Table className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{table.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
