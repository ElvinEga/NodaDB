import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Loader2, Database, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatabaseTable, QueryResult, TableColumn, ConnectionConfig } from '@/types';
import { toast } from 'sonner';

interface TableDataViewerProps {
  connection: ConnectionConfig;
  table: DatabaseTable;
}

export function TableDataViewer({ connection, table }: TableDataViewerProps) {
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [data, setData] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(50);

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
      console.error('Error loading table structure:', error);
    }
  };

  const loadTableData = async () => {
    setIsLoading(true);
    try {
      const offset = (currentPage - 1) * rowsPerPage;
      const query = `SELECT * FROM ${table.name} LIMIT ${rowsPerPage} OFFSET ${offset}`;
      
      const result = await invoke<QueryResult>('execute_query', {
        connectionId: connection.id,
        query,
      });
      setData(result);
    } catch (error) {
      toast.error(`Failed to load table data: ${error}`);
      console.error('Error loading table data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadTableStructure();
    loadTableData();
  }, [table.name, connection.id]);

  useEffect(() => {
    loadTableData();
  }, [currentPage]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (data && data.rows.length === rowsPerPage) {
      setCurrentPage(currentPage + 1);
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{table.name}</h2>
        </div>
        
        {columns.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{columns.length} columns</span>
            {data && <span>{data.rows.length} rows (page {currentPage})</span>}
          </div>
        )}
      </div>

      {/* Data Table */}
      {isLoading && !data ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">Loading table data...</p>
          </div>
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Database className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No data in this table</p>
          </div>
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  {data.columns.map((column) => {
                    const columnInfo = columns.find((c) => c.name === column);
                    return (
                      <TableHead key={column}>
                        <div className="flex flex-col">
                          <span className="font-semibold">{column}</span>
                          {columnInfo && (
                            <span className="text-xs font-normal text-muted-foreground">
                              {columnInfo.data_type}
                              {columnInfo.is_primary_key && ' • PK'}
                              {!columnInfo.is_nullable && ' • NOT NULL'}
                            </span>
                          )}
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-center text-muted-foreground font-mono text-xs">
                      {(currentPage - 1) * rowsPerPage + index + 1}
                    </TableCell>
                    {data.columns.map((column) => (
                      <TableCell key={column} className="font-mono text-sm">
                        <div className="max-w-xs truncate">
                          {formatValue(row[column])}
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Pagination */}
          <div className="border-t px-4 py-3 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * rowsPerPage + 1} to{' '}
              {(currentPage - 1) * rowsPerPage + data.rows.length} rows
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="text-sm font-medium px-3">
                Page {currentPage}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={data.rows.length < rowsPerPage || isLoading}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
