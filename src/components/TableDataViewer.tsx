import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Loader2, Database, ChevronLeft, ChevronRight, Plus, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddRowDialog } from '@/components/AddRowDialog';
import { FilterBuilder } from '@/components/FilterBuilder';
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
import { TableFilter } from '@/types/filter';
import { toast } from 'sonner';
import { validateCellValue, getPlaceholderForType } from '@/lib/validation';

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
  const [validationError, setValidationError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TableFilter[]>([]);
  const [activeWhereClause, setActiveWhereClause] = useState<string>('');

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
      let query = `SELECT * FROM ${table.name}`;
      
      if (activeWhereClause) {
        query += ` WHERE ${activeWhereClause}`;
      }
      
      query += ` LIMIT ${rowsPerPage} OFFSET ${offset}`;
      
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

  const handleApplyFilters = (whereClause: string) => {
    setActiveWhereClause(whereClause);
    setCurrentPage(1); // Reset to first page when filters change
    toast.success(`Applied ${filters.length} filter(s)`);
  };

  const handleClearFilters = () => {
    setActiveWhereClause('');
    setCurrentPage(1); // Reset to first page when filters cleared
    toast.info('Filters cleared');
  };

  useEffect(() => {
    setCurrentPage(1);
    setSelectedRows(new Set());
    setFilters([]);
    setActiveWhereClause('');
    loadTableStructure();
    loadTableData();
  }, [table.name, connection.id]);

  useEffect(() => {
    loadTableData();
  }, [currentPage, activeWhereClause]);

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
    setValidationError(null);
  };

  const handleSaveCell = async () => {
    if (!editingCell || !data) return;

    const columnInfo = columns.find(c => c.name === editingCell.column);
    if (!columnInfo) {
      toast.error('Column information not found');
      return;
    }

    // Validate the input
    const validation = validateCellValue(editValue, columnInfo.data_type);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid value');
      return;
    }

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
      [editingCell.column]: validation.transformedValue,
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
      setValidationError(null);
      refreshData();
    } catch (error) {
      toast.error(`Failed to update: ${error}`);
      console.error('Update error:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
    setValidationError(null);
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
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar - Sticky */}
      <div className="h-12 border-b border-border bg-secondary/50 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">{table.name}</h2>
          </div>
          {columns.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="font-mono">{columns.length}</span> columns
              </span>
              {data && (
                <span className="flex items-center gap-1">
                  <span className="font-mono">{data.rows.length}</span> rows
                </span>
              )}
              {selectedRows.size > 0 && (
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                  {selectedRows.size} selected
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {selectedRows.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={isLoading}
              className="h-8"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete ({selectedRows.size})
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshData}
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            onClick={() => setAddRowDialogOpen(true)}
            className="h-8"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Row
          </Button>
        </div>
      </div>

      {/* Filter Builder */}
      {columns.length > 0 && (
        <FilterBuilder
          columns={columns}
          filters={filters}
          onFiltersChange={setFilters}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
        />
      )}

      {/* Data Table */}
      {isLoading && !data ? (
        <div className="flex-1 flex items-center justify-center bg-background">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
            <p className="text-sm text-muted-foreground">Loading table data...</p>
          </div>
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-background">
          <div className="text-center">
            <Database className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium mb-1">No data in this table</p>
            <p className="text-xs text-muted-foreground mb-4">Add a row to get started</p>
            <Button size="sm" onClick={() => setAddRowDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Row
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1">
            <Table>
              <TableHeader className="sticky top-0 bg-secondary z-10">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-12 h-10">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === data.rows.length && data.rows.length > 0}
                      onChange={toggleAllRows}
                      className="cursor-pointer accent-primary"
                    />
                  </TableHead>
                  <TableHead className="w-16 h-10 text-center text-xs font-medium">#</TableHead>
                  {data.columns.map((column) => {
                    const columnInfo = columns.find((c) => c.name === column);
                    const getColumnTypeBadge = (type: string) => {
                      const upper = type.toUpperCase();
                      if (upper.includes('INT') || upper.includes('SERIAL')) return 'bg-blue-500/10 text-blue-400';
                      if (upper.includes('VARCHAR') || upper.includes('TEXT') || upper.includes('CHAR')) return 'bg-green-500/10 text-green-400';
                      if (upper.includes('DATE') || upper.includes('TIME')) return 'bg-yellow-500/10 text-yellow-400';
                      if (upper.includes('BOOL')) return 'bg-purple-500/10 text-purple-400';
                      if (upper.includes('FLOAT') || upper.includes('REAL') || upper.includes('DOUBLE') || upper.includes('NUMERIC')) return 'bg-orange-500/10 text-orange-400';
                      return 'bg-muted text-muted-foreground';
                    };
                    
                    return (
                      <TableHead key={column} className="h-10">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs">{column}</span>
                            {columnInfo?.is_primary_key && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                                PK
                              </span>
                            )}
                          </div>
                          {columnInfo && (
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${getColumnTypeBadge(columnInfo.data_type)}`}>
                                {columnInfo.data_type}
                              </span>
                              {!columnInfo.is_nullable && (
                                <span className="text-[10px] text-muted-foreground">NOT NULL</span>
                              )}
                            </div>
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
                    className={`
                      border-border transition-colors
                      ${index % 2 === 0 ? 'bg-background' : 'bg-secondary/20'}
                      ${selectedRows.has(index) ? 'bg-primary/5 border-l-2 border-l-primary' : ''}
                      hover:bg-accent
                    `}
                  >
                    <TableCell className="h-10">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(index)}
                        onChange={() => toggleRowSelection(index)}
                        className="cursor-pointer accent-primary"
                      />
                    </TableCell>
                    <TableCell className="h-10 text-center text-muted-foreground font-mono text-[11px]">
                      {(currentPage - 1) * rowsPerPage + index + 1}
                    </TableCell>
                    {data.columns.map((column) => {
                      const value = row[column];
                      const isNull = value === null || value === undefined;
                      const columnInfo = columns.find((c) => c.name === column);
                      const isPK = columnInfo?.is_primary_key;
                      
                      return (
                      <TableCell 
                        key={column} 
                        className={`
                          h-10 text-xs group relative
                          ${isPK ? 'font-mono text-muted-foreground' : ''}
                          ${isNull ? 'italic text-muted-foreground' : ''}
                        `}
                        onDoubleClick={() => handleCellEdit(index, column, value)}
                      >
                        {editingCell?.rowIndex === index && editingCell?.column === column ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => {
                                  setEditValue(e.target.value);
                                  setValidationError(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveCell();
                                  } else if (e.key === 'Escape') {
                                    handleCancelEdit();
                                  }
                                }}
                                placeholder={columnInfo ? getPlaceholderForType(columnInfo.data_type) : 'Enter value...'}
                                autoFocus
                                className={`flex-1 px-2 py-1 border rounded text-xs bg-background focus:outline-none focus:ring-1 ${
                                  validationError 
                                    ? 'border-destructive focus:ring-destructive' 
                                    : 'border-primary focus:ring-primary'
                                }`}
                              />
                              <Button
                                size="sm"
                                variant="default"
                                className="h-6 px-2 text-xs"
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
                                className="h-6 px-2 text-xs"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleCancelEdit();
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                            {validationError && (
                              <div className="flex items-center gap-1 text-xs text-destructive">
                                <AlertCircle className="h-3 w-3" />
                                <span>{validationError}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div 
                            className="max-w-xs truncate cursor-pointer px-2 py-1 rounded group-hover:bg-muted/30" 
                            title={`Double-click to edit\n${formatValue(value)}`}
                          >
                            {isNull ? (
                              <span className="text-muted-foreground/70">NULL</span>
                            ) : (
                              formatValue(value)
                            )}
                          </div>
                        )}
                      </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Pagination Bar */}
          <div className="h-12 border-t border-border bg-secondary/50 backdrop-blur-sm flex items-center justify-between px-4">
            <div className="text-xs text-muted-foreground font-mono">
              Showing <span className="text-foreground font-semibold">{(currentPage - 1) * rowsPerPage + 1}</span> to{' '}
              <span className="text-foreground font-semibold">{(currentPage - 1) * rowsPerPage + data.rows.length}</span> rows
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1 || isLoading}
                className="h-8"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-1 px-3 py-1 rounded bg-secondary border border-border">
                <span className="text-xs text-muted-foreground">Page</span>
                <span className="text-xs font-semibold font-mono">{currentPage}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={data.rows.length < rowsPerPage || isLoading}
                className="h-8"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
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
