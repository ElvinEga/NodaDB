import { useEffect, useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Loader2,
  Database,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Copy,
  Clipboard,
  ArrowDown,
  Edit2,
  Download,
} from 'lucide-react';
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
import { useMultiCellSelection } from '@/hooks/useMultiCellSelection';
import { useCellClipboard } from '@/hooks/useCellClipboard';

interface EnhancedTableViewerProps {
  connection: ConnectionConfig;
  table: DatabaseTable;
}

export function EnhancedTableViewer({ connection, table }: EnhancedTableViewerProps) {
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [data, setData] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(50);
  const [addRowDialogOpen, setAddRowDialogOpen] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);
  const {
    selectedRange,
    isSelecting,
    startSelection,
    updateSelection,
    endSelection,
    clearSelection,
    isCellSelected,
    getSelectionBounds,
  } = useMultiCellSelection();

  const { copyCells, pasteCells, exportAsCSV } = useCellClipboard();

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
    clearSelection();
    loadTableData();
  };

  useEffect(() => {
    setCurrentPage(1);
    clearSelection();
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

  // Handle mouse down on cell - start selection
  const handleCellMouseDown = (rowIndex: number, columnIndex: number, e: React.MouseEvent) => {
    // Prevent text selection
    e.preventDefault();

    if (e.shiftKey && selectedRange) {
      // Extend existing selection
      updateSelection({ rowIndex, columnIndex });
    } else {
      // Start new selection
      startSelection({ rowIndex, columnIndex });
    }
  };

  // Handle mouse enter on cell - update selection
  const handleCellMouseEnter = (rowIndex: number, columnIndex: number) => {
    if (isSelecting) {
      updateSelection({ rowIndex, columnIndex });
    }
  };

  // Handle mouse up - end selection
  useEffect(() => {
    const handleMouseUp = () => {
      if (isSelecting) {
        endSelection();
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [isSelecting, endSelection]);

  // Handle copy
  const handleCopy = useCallback(async () => {
    if (!selectedRange || !data) return;

    const bounds = getSelectionBounds();
    if (!bounds) return;

    const selectedData: any[][] = [];
    const selectedColumnNames: string[] = [];

    // Get column names for the selection
    for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
      selectedColumnNames.push(data.columns[col]);
    }

    // Get data for the selection
    for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
      const rowData: any[] = [];
      for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
        const columnName = data.columns[col];
        rowData.push(data.rows[row][columnName]);
      }
      selectedData.push(rowData);
    }

    await copyCells(selectedData, selectedColumnNames);
  }, [selectedRange, data, getSelectionBounds, copyCells]);

  // Handle paste
  const handlePaste = useCallback(async () => {
    if (!selectedRange || !data) {
      toast.error('Select a cell to paste');
      return;
    }

    const pasteData = await pasteCells();
    if (!pasteData) return;

    // Get the anchor cell (top-left of selection)
    const bounds = getSelectionBounds();
    if (!bounds) return;

    toast.info('Paste functionality requires bulk update - coming soon');
    // TODO: Implement bulk paste with validation and update
  }, [selectedRange, data, pasteCells, getSelectionBounds]);

  // Handle fill down
  const handleFillDown = useCallback(async () => {
    if (!selectedRange || !data) {
      toast.error('Select cells to fill down');
      return;
    }

    const bounds = getSelectionBounds();
    if (!bounds || bounds.rowCount <= 1) {
      toast.error('Select multiple rows to fill down');
      return;
    }

    // Get the first row values
    const firstRowValues: any[] = [];
    for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
      const columnName = data.columns[col];
      firstRowValues.push(data.rows[bounds.minRow][columnName]);
    }

    toast.info('Fill down functionality requires bulk update - coming soon');
    // TODO: Implement fill down with validation and update
  }, [selectedRange, data, getSelectionBounds]);

  // Handle bulk edit
  const handleBulkEdit = useCallback(async () => {
    if (!selectedRange || !data) {
      toast.error('Select cells to edit');
      return;
    }

    const bounds = getSelectionBounds();
    if (!bounds) return;

    toast.info(`Selected ${bounds.totalCells} cells for bulk edit`);
    // TODO: Open bulk edit dialog
  }, [selectedRange, data, getSelectionBounds]);

  // Handle export selection
  const handleExportSelection = useCallback(() => {
    if (!selectedRange || !data) {
      toast.error('Select cells to export');
      return;
    }

    const bounds = getSelectionBounds();
    if (!bounds) return;

    const selectedData: any[][] = [];
    const selectedColumnNames: string[] = [];

    for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
      selectedColumnNames.push(data.columns[col]);
    }

    for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
      const rowData: any[] = [];
      for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
        const columnName = data.columns[col];
        rowData.push(data.rows[row][columnName]);
      }
      selectedData.push(rowData);
    }

    exportAsCSV(selectedData, selectedColumnNames, `${table.name}_selection.csv`);
  }, [selectedRange, data, getSelectionBounds, exportAsCSV, table.name]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Copy: Ctrl+C or Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        handleCopy();
      }

      // Paste: Ctrl+V or Cmd+V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        handlePaste();
      }

      // Clear selection: Escape
      if (e.key === 'Escape') {
        clearSelection();
      }

      // Fill down: Ctrl+D or Cmd+D
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        handleFillDown();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, handlePaste, handleFillDown, clearSelection]);

  const bounds = getSelectionBounds();

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar */}
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
              {bounds && (
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                  {bounds.totalCells} cells selected
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {bounds && bounds.totalCells > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                title="Copy (Ctrl+C)"
                className="h-8"
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePaste}
                title="Paste (Ctrl+V)"
                className="h-8"
              >
                <Clipboard className="h-3.5 w-3.5 mr-1.5" />
                Paste
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFillDown}
                title="Fill Down (Ctrl+D)"
                className="h-8"
              >
                <ArrowDown className="h-3.5 w-3.5 mr-1.5" />
                Fill Down
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBulkEdit}
                className="h-8"
              >
                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                Bulk Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportSelection}
                className="h-8"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
              <div className="w-px h-6 bg-border" />
            </>
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
            <div ref={tableRef} className="relative">
              <Table>
                <TableHeader className="sticky top-0 bg-secondary z-10">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-16 h-9 text-center text-xs font-normal">#</TableHead>
                    {data.columns.map((column) => {
                      const columnInfo = columns.find((c) => c.name === column);

                      return (
                        <TableHead key={column} className="h-9">
                          <div className="flex flex-col gap-1">
                            <span className="font-normal text-xs">{column}</span>
                            {columnInfo && (
                              <span className="text-[10px] text-muted-foreground">
                                {columnInfo.data_type}
                              </span>
                            )}
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row, rowIndex) => (
                    <TableRow
                      key={rowIndex}
                      className={`
                        border-border transition-colors
                        ${rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/10'}
                      `}
                    >
                      <TableCell className="h-9 text-center text-muted-foreground font-mono text-[11px]">
                        {(currentPage - 1) * rowsPerPage + rowIndex + 1}
                      </TableCell>
                      {data.columns.map((column, columnIndex) => {
                        const value = row[column];
                        const isNull = value === null || value === undefined;
                        const isSelected = isCellSelected(rowIndex, columnIndex);

                        return (
                          <TableCell
                            key={column}
                            className={`
                              h-9 text-xs cursor-cell select-none
                              ${isNull ? 'italic text-muted-foreground' : ''}
                              ${isSelected ? 'bg-primary/20 ring-1 ring-primary ring-inset' : ''}
                            `}
                            onMouseDown={(e) => handleCellMouseDown(rowIndex, columnIndex, e)}
                            onMouseEnter={() => handleCellMouseEnter(rowIndex, columnIndex)}
                          >
                            <div className="max-w-xs truncate px-1 py-0.5">
                              {isNull ? (
                                <span className="text-muted-foreground/70">NULL</span>
                              ) : (
                                formatValue(value)
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
