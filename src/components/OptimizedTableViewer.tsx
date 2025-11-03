import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OptimizedTable } from '@/components/OptimizedTable';
import { DatabaseTable, QueryResult, TableColumn, ConnectionConfig } from '@/types';
import { toast } from 'sonner';
import { generateCommitSQL } from '@/lib/sql-commit-generator';
import { useTableState } from '@/hooks/use-table-state';

interface OptimizedTableViewerProps {
  connection: ConnectionConfig;
  table: DatabaseTable;
}

export function OptimizedTableViewer({ connection, table }: OptimizedTableViewerProps) {
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(1000);
  
  const state = useTableState(
    columns.map(c => ({ name: c.name })),
    data
  );
  
  const changeCount = state.getChangeCount();

  const loadTableStructure = async () => {
    try {
      const result = await invoke<TableColumn[]>('get_table_structure', {
        connectionId: connection.id,
        tableName: table.name,
        dbType: connection.db_type,
      });
      setColumns(result);
    } catch (error) {
      toast.error(`Failed to load table structure: ${error}`);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const offset = (currentPage - 1) * rowsPerPage;
      const query = `SELECT * FROM "${table.name}" LIMIT ${rowsPerPage} OFFSET ${offset}`;
      
      const result = await invoke<QueryResult>('execute_query', {
        connectionId: connection.id,
        query,
      });
      
      setData(result.rows as Record<string, any>[]);
    } catch (error) {
      toast.error(`Failed to load data: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTableStructure();
  }, [connection.id, table.name]);

  useEffect(() => {
    if (columns.length > 0) {
      loadData();
    }
  }, [columns, currentPage]);

  const handleCommit = async () => {
    try {
      const plan = generateCommitSQL({
        changedRows: state.getChangedRows(),
        tableName: table.name,
        tableColumns: columns,
        dbType: connection.db_type,
      });

      const allSql = [...plan.inserts, ...plan.updates, ...plan.deletes];
      if (allSql.length === 0) return;

      await invoke('execute_transaction', {
        connectionId: connection.id,
        queries: allSql,
      });

      toast.success(`${allSql.length} change${allSql.length > 1 ? 's' : ''} committed successfully`);
      
      await loadData();
      
    } catch (error) {
      toast.error(`Commit failed: ${error}`);
      console.error("Commit error:", error);
    }
  };

  const handleDiscard = () => {
    if (confirm('Are you sure you want to discard all changes?')) {
      state.discardChanges();
      toast.info('Changes discarded');
    }
  };

  const handleRefresh = () => {
    if (changeCount > 0) {
      if (!confirm('You have unsaved changes. Refreshing will discard them. Continue?')) {
        return;
      }
      state.discardChanges();
    }
    loadData();
  };

  if (isLoading && data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background relative">
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{table.name}</h3>
          <span className="text-sm text-muted-foreground">
            {data.length} rows
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <OptimizedTable 
          headers={columns.map(c => ({ name: c.name }))}
          data={data}
        />
      </div>

      {changeCount > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 p-3 bg-background border border-border rounded-lg shadow-lg">
          <span className="text-sm font-medium text-blue-600">
            {changeCount} pending change{changeCount > 1 ? 's' : ''}
          </span>
          <Button variant="outline" size="sm" onClick={handleDiscard}>
            Discard
          </Button>
          <Button size="sm" onClick={handleCommit}>
            Commit Changes
          </Button>
        </div>
      )}
    </div>
  );
}
