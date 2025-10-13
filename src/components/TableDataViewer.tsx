import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Loader2, Database, ChevronLeft, ChevronRight, Plus, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddRowDialog } from '@/components/AddRowDialog';
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
  const [addRowDialogOpen, setAddRowDialogOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{rowIndex: number; column: string} | null>(null);
  const [editValue, setEditValue] = useState<string>('');

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

  const refreshData = () => {
    setSelectedRows(new Set());
    setEditingCell(null);
    loadTableData();
  };

  useEffect(() => {
    setCurrentPage(1);
    setSelectedRows(new Set());
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

  const handleDeleteSelected = async () => {
    if (selectedRows.size === 0) {
      toast.error('No rows selected');
      return;
    }

    if (!confirm(`Delete ${selectedRows.size} row(s)?`)) {
      return;
    }

    setIsLoading(true);
    try {
      // Get primary key column
      const pkColumn = columns.find(c => c.is_primary_key);
      if (!pkColumn) {
        toast.error('Cannot delete: No primary key found');
        return;
      }

      const rowsToDelete = Array.from(selectedRows).map(idx => data!.rows[idx]);
      const pkValues = rowsToDelete.map(row => {
        const pk = row[pkColumn.name];
        return typeof pk === 'string' ? `'${pk}'` : pk;
      });

      const whereClause = `${pkColumn.name} IN (${pkValues.join(', ')})`;

      const result = await invoke<string>('delete_rows', {
        connectionId: connection.id,
        tableName: table.name,
        whereClause,
      });

      toast.success(result);
      refreshData();
    } catch (error) {
      toast.error(`Failed to delete rows: ${error}`);
      console.error('Delete error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCellEdit = (rowIndex: number, column: string, currentValue: unknown) => {
    setEditingCell({ rowIndex, column });
    setEditValue(formatValue(currentValue));
  };

  const handleSaveCell = async () => {
    if (!editingCell || !data) return;

    const row = data.rows[editingCell.rowIndex];
    const pkColumn = columns.find(c => c.is_primary_key);
    
    if (!pkColumn) {
      toast.error('Cannot update: No primary key found');
      return;
    }

    const pkValue = row[pkColumn.name];
    const whereClause = typeof pkValue === 'string' 
      ? `${pkColumn.name} = '${pkValue}'`
      : `${pkColumn.name} = ${pkValue}`;

    const updateData: Record<string, unknown> = {
      [editingCell.column]: editValue === 'NULL' ? null : editValue,
    };

    try {
      const result = await invoke<string>('update_row', {
        connectionId: connection.id,
        tableName: table.name,
        data: updateData,
        whereClause,
        dbType: connection.db_type,
      });

      toast.success(result);
      setEditingCell(null);
      refreshData();
    } catch (error) {
      toast.error(`Failed to update: ${error}`);
      console.error('Update error:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const toggleRowSelection = (rowIndex: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  };

  const toggleAllRows = () => {
    if (selectedRows.size === data?.rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(data?.rows.map((_, idx) => idx) || []));
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{table.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            {selectedRows.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedRows.size})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={isLoading}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setAddRowDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Row
            </Button>
          </div>
        </div>
        
        {columns.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{columns.length} columns</span>
            {data && <span>{data.rows.length} rows (page {currentPage})</span>}
            {selectedRows.size > 0 && <span>{selectedRows.size} selected</span>}
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
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === data.rows.length && data.rows.length > 0}
                      onChange={toggleAllRows}
                      className="cursor-pointer"
                    />
                  </TableHead>
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
                  <TableRow 
                    key={index}
                    className={selectedRows.has(index) ? 'bg-muted/50' : ''}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedRows.has(index)}
                        onChange={() => toggleRowSelection(index)}
                        className="cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground font-mono text-xs">
                      {(currentPage - 1) * rowsPerPage + index + 1}
                    </TableCell>
                    {data.columns.map((column) => (
                      <TableCell 
                        key={column} 
                        className="font-mono text-sm cursor-pointer hover:bg-muted/50"
                        onDoubleClick={() => handleCellEdit(index, column, row[column])}
                      >
                        {editingCell?.rowIndex === index && editingCell?.column === column ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveCell();
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                              autoFocus
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSaveCell();
                              }}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleCancelEdit();
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="max-w-xs truncate" title="Double-click to edit">
                            {formatValue(row[column])}
                          </div>
                        )}
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

      <AddRowDialog
        open={addRowDialogOpen}
        onOpenChange={setAddRowDialogOpen}
        connection={connection}
        table={table}
        columns={columns}
        onSuccess={refreshData}
      />
    </div>
  );
}
