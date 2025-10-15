import { useState, useMemo, useEffect, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  ColumnSizingState,
  flexRender,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { invoke } from '@tauri-apps/api/core';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  RefreshCw,
  Plus,
  Trash2,
  Download,
  Columns3,
  Edit2,
  GripVertical,
  Sparkles,
  Workflow,
  Undo2,
  Redo2,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AddRowDialog } from '@/components/AddRowDialog';
import { EditCellDialog } from '@/components/EditCellDialog';
import { DataGeneratorDialog } from '@/components/DataGeneratorDialog';
import { ExportDataDialog } from '@/components/ExportDataDialog';
import { BatchOperationsDialog } from '@/components/BatchOperationsDialog';
import { TransactionHistoryPanel } from '@/components/TransactionHistoryPanel';
import { ColumnHeaderContextMenu } from '@/components/ColumnHeaderContextMenu';
import { CellContextMenu } from '@/components/CellContextMenu';
import { Skeleton } from '@/components/ui/skeleton';
import { useUndoRedoStore } from '@/stores/undoRedoStore';

import { ConnectionConfig, DatabaseTable, TableColumn, QueryResult } from '@/types';
import { toast } from 'sonner';
import { getCellRenderer } from '@/lib/cellRenderers';
import {
  generateSetNullSql,
  generateDeleteSql,
  generateDuplicateSql,
  calculateColumnStats,
} from '@/lib/tableOperations';

interface TanStackTableViewerProps {
  connection: ConnectionConfig;
  table: DatabaseTable;
  columns: TableColumn[];
  onRefresh: () => void;
}

export function TanStackTableViewer({
  connection,
  table,
  columns: tableColumns,
}: TanStackTableViewerProps) {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const pageSize = 50;
  const [executionTime, setExecutionTime] = useState(0);
  const [editingCell, setEditingCell] = useState<{ 
    rowId: string; 
    columnId: string; 
    columnName: string;
    columnType: string;
    currentValue: any;
  } | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addRowDialogOpen, setAddRowDialogOpen] = useState(false);
  const [dataGeneratorDialogOpen, setDataGeneratorDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [batchOperationsDialogOpen, setBatchOperationsDialogOpen] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Undo/Redo store
  const tableKey = `${connection.id}-${table.name}`;
  const addAction = useUndoRedoStore((state) => state.addAction);
  const undo = useUndoRedoStore((state) => state.undo);
  const redo = useUndoRedoStore((state) => state.redo);
  const canUndo = useUndoRedoStore((state) => state.canUndo(tableKey));
  const canRedo = useUndoRedoStore((state) => state.canRedo(tableKey));
  
  // Helper: Get primary key column
  const primaryKeyColumn = tableColumns.find(col => col.is_primary_key);
  const getPrimaryKeyValue = (row: Record<string, any>) => {
    return primaryKeyColumn ? row[primaryKeyColumn.name] : null;
  };

  // Load table data
  const loadData = async () => {
    setIsLoading(true);
    const startTime = Date.now();

    try {
      // Use execute_query instead of get_table_data
      const query = `SELECT * FROM ${table.name} LIMIT 1000`;
      const result = await invoke<QueryResult>('execute_query', {
        connectionId: connection.id,
        query: query,
      });

      setData(result.rows);
      setExecutionTime(Date.now() - startTime);
    } catch (error) {
      toast.error(`Failed to load data: ${error}`);
      console.error('Load data error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [connection.id, table.name]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + F - Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Ctrl/Cmd + R - Refresh
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        handleRefresh();
      }
      // Escape - Clear selection and cancel editing
      if (e.key === 'Escape') {
        setRowSelection({});
        setEditingCell(null);
      }
      // Ctrl/Cmd + A - Select all (when table focused)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        tableInstance.toggleAllRowsSelected(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Context menu handlers
  const handleSetCellNull = async (row: Record<string, any>, columnName: string) => {
    if (!primaryKeyColumn) {
      toast.error('Cannot update: No primary key defined');
      return;
    }
    
    const pkValue = getPrimaryKeyValue(row);
    const sql = generateSetNullSql(table.name, columnName, primaryKeyColumn.name, pkValue);
    
    try {
      await invoke('execute_query', {
        connectionId: connection.id,
        query: sql,
      });
      toast.success(`Set ${columnName} to NULL`);
      loadData();
    } catch (error) {
      toast.error(`Failed to update: ${error}`);
    }
  };

  const handleDuplicateRow = async (row: Record<string, any>) => {
    if (!primaryKeyColumn) {
      toast.error('Cannot duplicate: No primary key defined');
      return;
    }
    
    const columnNames = tableColumns.map(col => col.name);
    const sql = generateDuplicateSql(table.name, row, columnNames, primaryKeyColumn.name);
    
    try {
      await invoke('execute_query', {
        connectionId: connection.id,
        query: sql,
      });
      toast.success('Row duplicated');
      loadData();
    } catch (error) {
      toast.error(`Failed to duplicate: ${error}`);
    }
  };

  const handleDeleteRow = async (row: Record<string, any>) => {
    if (!primaryKeyColumn) {
      toast.error('Cannot delete: No primary key defined');
      return;
    }
    
    const pkValue = getPrimaryKeyValue(row);
    const sql = generateDeleteSql(table.name, primaryKeyColumn.name, pkValue);
    
    if (!confirm(`Delete this row?\n\n${sql}\n\nThis action cannot be undone.`)) {
      return;
    }
    
    try {
      await invoke('execute_query', {
        connectionId: connection.id,
        query: sql,
      });
      toast.success('Row deleted');
      loadData();
    } catch (error) {
      toast.error(`Failed to delete: ${error}`);
    }
  };

  const handleFilterByValue = (columnName: string, value: unknown) => {
    setColumnFilters([{ id: columnName, value: String(value) }]);
    toast.success(`Filtered by ${columnName} = ${value}`);
  };

  const handleShowColumnStats = (columnName: string) => {
    const stats = calculateColumnStats(data, columnName);
    const message = `Column: ${columnName}
Total: ${stats.count}
Null: ${stats.nullCount}
Unique: ${stats.uniqueCount}${stats.min !== undefined ? `
Min: ${stats.min}
Max: ${stats.max}
Avg: ${stats.avg?.toFixed(2)}
Sum: ${stats.sum}` : ''}`;
    
    toast.info(message, { duration: 5000 });
  };

  // Get SQL type badge color
  const getTypeBadgeColor = (dataType: string): string => {
    const type = dataType.toUpperCase();
    if (type.includes('INT') || type.includes('SERIAL')) return 'text-blue-400 bg-blue-500/10';
    if (type.includes('VARCHAR') || type.includes('TEXT') || type.includes('CHAR'))
      return 'text-green-400 bg-green-500/10';
    if (type.includes('DATE') || type.includes('TIME')) return 'text-yellow-400 bg-yellow-500/10';
    if (type.includes('BOOL')) return 'text-purple-400 bg-purple-500/10';
    if (type.includes('FLOAT') || type.includes('REAL') || type.includes('DOUBLE') || type.includes('NUMERIC'))
      return 'text-orange-400 bg-orange-500/10';
    return 'text-gray-400 bg-gray-500/10';
  };

  // Define columns for TanStack Table
  const columns = useMemo<ColumnDef<Record<string, any>>[]>(() => {
    const cols: ColumnDef<Record<string, any>>[] = [
      // Selection column
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value: any) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="accent-primary"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value: any) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="accent-primary"
          />
        ),
        size: 40,
        enableSorting: false,
        enableHiding: false,
      },
      // Row number column
      {
        id: 'rowNumber',
        header: '#',
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-muted-foreground">
            {row.index + 1}
          </span>
        ),
        size: 50,
        enableSorting: false,
        enableHiding: false,
      },
    ];

    // Add data columns
    tableColumns.forEach((col) => {
      cols.push({
        accessorKey: col.name,
        id: col.name,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <ColumnHeaderContextMenu
              columnName={col.name}
              dataType={col.data_type}
              isPrimaryKey={col.is_primary_key}
              isNullable={col.is_nullable}
              isSorted={isSorted}
              data={data}
              onSort={(ascending) => column.toggleSorting(!ascending)}
              onClearSort={() => column.clearSorting()}
              onHide={() => column.toggleVisibility(false)}
              onShowStats={() => handleShowColumnStats(col.name)}
            >
              <div className="flex flex-col gap-1">
                <button
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                >
                  <span className="font-semibold">{col.name}</span>
                  {isSorted === 'asc' ? (
                    <ChevronUp className="h-3.5 w-3.5 text-primary" />
                  ) : isSorted === 'desc' ? (
                    <ChevronDown className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                  )}
                </button>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded font-mono ${getTypeBadgeColor(col.data_type)}`}>
                    {col.data_type}
                  </span>
                  {col.is_primary_key && (
                    <span className="px-1.5 py-0.5 rounded font-mono bg-primary/10 text-primary">
                      PK
                    </span>
                  )}
                  {!col.is_nullable && !col.is_primary_key && (
                    <span className="text-muted-foreground">NOT NULL</span>
                  )}
                </div>
              </div>
            </ColumnHeaderContextMenu>
          );
        },
        cell: ({ getValue, row }) => {
          const value = getValue();

          // Primary key styling (not editable)
          if (col.is_primary_key) {
            return <span className="font-mono text-xs text-muted-foreground">{String(value)}</span>;
          }

          const handleEditClick = (e?: React.MouseEvent) => {
            if (e) e.stopPropagation();
            setEditingCell({
              rowId: row.id,
              columnId: col.name,
              columnName: col.name,
              columnType: col.data_type,
              currentValue: value,
            });
            setEditDialogOpen(true);
          };

          // Display mode with custom renderer
          return (
            <CellContextMenu
              row={row.original}
              columnName={col.name}
              cellValue={value}
              tableName={table.name}
              columnNames={tableColumns.map(c => c.name)}
              isPrimaryKey={col.is_primary_key}
              canEdit={!col.is_primary_key}
              onEdit={handleEditClick}
              onSetNull={() => handleSetCellNull(row.original, col.name)}
              onDuplicateRow={() => handleDuplicateRow(row.original)}
              onDeleteRow={() => handleDeleteRow(row.original)}
              onFilterByValue={() => handleFilterByValue(col.name, value)}
            >
              <div
                className="group flex items-center justify-between cursor-pointer hover:bg-accent/50 -mx-2 px-2 py-1 rounded"
                onDoubleClick={handleEditClick}
              >
                <div className="flex-1 min-w-0">
                  {getCellRenderer(col.data_type, value)}
                </div>
                <button
                  onClick={handleEditClick}
                  className="opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity"
                  title="Click to edit"
                >
                  <Edit2 className="h-3 w-3 ml-2 shrink-0" />
                </button>
              </div>
            </CellContextMenu>
          );
        },
        size: 180,
      });
    });

    return cols;
  }, [tableColumns]);

  const tableInstance = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnSizing,
      rowSelection,
      globalFilter,
      pagination: {
        pageIndex: 0,
        pageSize,
      },
    },
  });

  const selectedRows = tableInstance.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  // Virtual scrolling setup
  const { rows } = tableInstance.getRowModel();
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 40, // Row height in pixels
    overscan: 10, // Number of items to render outside visible area
  });

  const handleSaveEdit = async (newValue: string) => {
    if (!editingCell) return;

    try {
      const rowIndex = parseInt(editingCell.rowId);
      const row = data[rowIndex];
      const primaryKeyColumn = tableColumns.find(col => col.is_primary_key);
      
      if (!primaryKeyColumn) {
        toast.error('No primary key found for update');
        return;
      }

      const primaryKeyValue = row[primaryKeyColumn.name];
      
      // Build update data object with only the changed column
      const updateData: Record<string, any> = {
        [editingCell.columnId]: newValue === '' ? null : newValue,
      };
      
      // Build WHERE clause for the primary key
      const whereClause = `${primaryKeyColumn.name} = ${typeof primaryKeyValue === 'string' ? `'${primaryKeyValue}'` : primaryKeyValue}`;
      
      await invoke('update_row', {
        connectionId: connection.id,
        tableName: table.name,
        data: updateData,
        whereClause: whereClause,
        dbType: connection.db_type,
      });

      // Update local data
      const newData = [...data];
      newData[rowIndex] = {
        ...newData[rowIndex],
        [editingCell.columnId]: newValue === '' ? null : newValue,
      };
      setData(newData);
      setEditingCell(null);
      setEditDialogOpen(false);
      toast.success('Cell updated successfully');
    } catch (error) {
      toast.error(`Failed to update cell: ${error}`);
      console.error('Update error:', error);
      throw error; // Re-throw to let dialog handle loading state
    }
  };

  const handleDeleteRows = async () => {
    if (selectedCount === 0) return;

    if (!confirm(`Delete ${selectedCount} selected row(s)?`)) return;

    try {
      const primaryKeyColumn = tableColumns.find(col => col.is_primary_key);
      
      if (!primaryKeyColumn) {
        toast.error('No primary key found for delete');
        return;
      }

      // Build WHERE clause with all selected primary key values
      const primaryKeyValues = selectedRows.map(row => {
        const pkValue = row.original[primaryKeyColumn.name];
        return typeof pkValue === 'string' ? `'${pkValue}'` : pkValue;
      });
      
      const whereClause = `${primaryKeyColumn.name} IN (${primaryKeyValues.join(', ')})`;

      await invoke('delete_rows', {
        connectionId: connection.id,
        tableName: table.name,
        whereClause: whereClause,
        dbType: connection.db_type,
      });
      
      // Reload data
      await loadData();
      setRowSelection({});
      toast.success(`Deleted ${selectedCount} row(s)`);
    } catch (error) {
      toast.error(`Failed to delete rows: ${error}`);
      console.error('Delete error:', error);
    }
  };

  // Batch operations handlers
  const handleBatchDelete = async () => {
    return handleDeleteRows();
  };

  const handleBatchUpdate = async (columnName: string, value: string) => {
    if (!primaryKeyColumn) {
      toast.error('No primary key found for update');
      return;
    }

    const primaryKeyValues = selectedRows.map(row => {
      const pkValue = row.original[primaryKeyColumn.name];
      return typeof pkValue === 'string' ? `'${pkValue}'` : pkValue;
    });

    const whereClause = `${primaryKeyColumn.name} IN (${primaryKeyValues.join(', ')})`;
    const setValue = value === 'NULL' ? 'NULL' : `'${value}'`;

    try {
      await invoke('execute_query', {
        connectionId: connection.id,
        query: `UPDATE ${table.name} SET ${columnName} = ${setValue} WHERE ${whereClause}`,
        dbType: connection.db_type,
      });

      await loadData();
      setRowSelection({});
      toast.success(`Updated ${selectedCount} row(s)`);
    } catch (error) {
      toast.error(`Failed to update rows: ${error}`);
      console.error('Update error:', error);
    }
  };

  const handleBatchDuplicate = async () => {
    try {
      const editableColumns = tableColumns.filter(
        col => !col.is_primary_key
      );

      for (const row of selectedRows) {
        const newRow: Record<string, any> = {};
        editableColumns.forEach(col => {
          newRow[col.name] = row.original[col.name];
        });

        await invoke('insert_row', {
          connectionId: connection.id,
          tableName: table.name,
          row: newRow,
          dbType: connection.db_type,
        });
      }

      await loadData();
      setRowSelection({});
      toast.success(`Duplicated ${selectedCount} row(s)`);
    } catch (error) {
      toast.error(`Failed to duplicate rows: ${error}`);
      console.error('Duplicate error:', error);
    }
  };

  const handleBatchExport = () => {
    setExportDialogOpen(true);
  };

  // Prepare data for export
  const getExportData = (): QueryResult => {
    // If rows are selected, export only selected rows
    const rowsToExport = selectedCount > 0
      ? tableInstance.getSelectedRowModel().rows
      : tableInstance.getFilteredRowModel().rows;

    const columns = tableInstance
      .getAllColumns()
      .filter((col: any) => col.id !== 'select' && col.id !== 'rowNumber')
      .map((col: any) => col.id);

    const rows = rowsToExport.map((row: any) => {
      const rowData: Record<string, any> = {};
      columns.forEach((col) => {
        rowData[col] = row.getValue(col);
      });
      return rowData;
    });

    return {
      columns,
      rows,
      rows_affected: rows.length,
    };
  };

  // Undo/Redo handlers
  const handleUndo = async () => {
    const action = undo(tableKey);
    if (!action) {
      toast.error('Nothing to undo');
      return;
    }

    try {
      await invoke('execute_query', {
        connectionId: connection.id,
        query: action.undoSql,
        dbType: connection.db_type,
      });

      await loadData();
      toast.success(`Undone: ${action.type}`);
    } catch (error) {
      toast.error(`Failed to undo: ${error}`);
      console.error('Undo error:', error);
      // Re-add the action if undo failed
      addAction(tableKey, action);
    }
  };

  const handleRedo = async () => {
    const action = redo(tableKey);
    if (!action) {
      toast.error('Nothing to redo');
      return;
    }

    try {
      await invoke('execute_query', {
        connectionId: connection.id,
        query: action.redoSql,
        dbType: connection.db_type,
      });

      await loadData();
      toast.success(`Redone: ${action.type}`);
    } catch (error) {
      toast.error(`Failed to redo: ${error}`);
      console.error('Redo error:', error);
    }
  };

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + Z - Undo
      if (ctrlOrCmd && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (canUndo) handleUndo();
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y - Redo
      if ((ctrlOrCmd && e.shiftKey && e.key === 'Z') || (ctrlOrCmd && e.key === 'y')) {
        e.preventDefault();
        if (canRedo) handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo]);

  const handleRefresh = async () => {
    await loadData();
    toast.success('Table data refreshed');
  };

  return (
    <div className="h-full flex bg-background">
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-12 border-b border-border bg-secondary/50 backdrop-blur-sm flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={!canUndo}
            className="h-8"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            disabled={!canRedo}
            className="h-8"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setAddRowDialogOpen(true)}
            className="h-8"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add row
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDataGeneratorDialogOpen(true)}
            className="h-8"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Generate data
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteRows}
            disabled={selectedCount === 0}
            className="h-8"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete row
          </Button>
          {selectedCount > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBatchOperationsDialogOpen(true)}
                className="h-8"
              >
                <Workflow className="h-3.5 w-3.5 mr-1.5" />
                Batch ops
              </Button>
              <span className="text-xs text-muted-foreground ml-2">
                {selectedCount} selected
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Column visibility dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8">
                <Columns3 className="h-3.5 w-3.5 mr-1.5" />
                Columns
                <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {tableInstance
                .getAllColumns()
                .filter((column: any) => column.getCanHide())
                .map((column: any) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize text-xs"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value: boolean) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Global search */}
          <Input
            ref={searchInputRef}
            placeholder="Search... (Ctrl+F)"
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 w-48 text-xs"
          />
        </div>
      </div>

      {/* Table with Virtual Scrolling */}
      <div
        ref={tableContainerRef}
        className="flex-1 overflow-auto"
        style={{ contain: 'strict' }}
      >
        <div style={{ position: 'relative' }}>
          <table className="w-full text-sm" style={{ display: 'grid' }}>
            {/* Sticky Header */}
            <thead className="sticky top-0 z-10 bg-secondary" style={{ display: 'grid', position: 'sticky', top: 0 }}>
              {tableInstance.getHeaderGroups().map((headerGroup: any) => (
                <tr key={headerGroup.id} className="border-b-2 border-border" style={{ display: 'flex', width: '100%' }}>
                  {headerGroup.headers.map((header: any) => {
                    return (
                      <th
                        key={header.id}
                        className="h-14 px-4 text-left align-top font-medium text-muted-foreground text-xs border-r border-border/50 relative group"
                        style={{ width: header.getSize(), display: 'flex', alignItems: 'start' }}
                      >
                        <div className="flex-1 pt-2">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                        
                        {/* Column Resize Handle */}
                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={`
                              absolute right-0 top-0 h-full w-1 cursor-col-resize
                              opacity-0 group-hover:opacity-100
                              hover:bg-primary/50
                              ${header.column.getIsResizing() ? 'bg-primary opacity-100' : ''}
                            `}
                          >
                            <GripVertical className="h-3 w-3 absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            {/* Virtual Body */}
            <tbody
              style={{
                display: 'grid',
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative',
              }}
            >
              {isLoading ? (
                Array.from({ length: 10 }).map((_, index) => (
                  <tr
                    key={`skeleton-${index}`}
                    style={{
                      display: 'flex',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${41}px`,
                      transform: `translateY(${index * 41}px)`,
                    }}
                    className="border-b border-border"
                  >
                    {tableInstance.getAllColumns().map((column) => (
                      <td
                        key={column.id}
                        style={{
                          display: 'flex',
                          width: column.getSize(),
                          padding: '8px',
                          alignItems: 'center',
                        }}
                      >
                        <Skeleton className="h-5 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr className="absolute top-0 left-0 w-full" style={{ display: 'flex', height: '128px', alignItems: 'center', justifyContent: 'center' }}>
                  <td colSpan={columns.length} className="text-center text-muted-foreground w-full">
                    No data
                  </td>
                </tr>
              ) : (
                rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <tr
                      key={row.id}
                      data-state={row.getIsSelected() ? 'selected' : undefined}
                      style={{
                        display: 'flex',
                        position: 'absolute',
                        transform: `translateY(${virtualRow.start}px)`,
                        width: '100%',
                      }}
                      className={`
                        h-10 border-b border-border/50 transition-colors
                        ${virtualRow.index % 2 === 0 ? 'bg-background' : 'bg-secondary/20'}
                        hover:bg-accent
                        data-[state=selected]:bg-primary/5 data-[state=selected]:border-l-2 data-[state=selected]:border-l-primary
                      `}
                    >
                      {row.getVisibleCells().map((cell: any) => (
                        <td
                          key={cell.id}
                          className="px-4 py-2 flex items-center"
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer / Pagination */}
      <div className="h-12 border-t border-border bg-secondary/50 backdrop-blur-sm flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setExportDialogOpen(true)} className="h-8 text-xs">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
          <Button
            variant={showTransactionHistory ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setShowTransactionHistory(!showTransactionHistory)}
            className="h-8 text-xs"
          >
            <History className="h-3.5 w-3.5 mr-1.5" />
            History
          </Button>
          <span className="text-xs text-muted-foreground">
            Query Duration: <span className="font-mono">{executionTime}ms</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => tableInstance.previousPage()}
              disabled={!tableInstance.getCanPreviousPage()}
              className="h-8 w-8 p-0"
            >
              ←
            </Button>
            <span className="text-xs text-muted-foreground font-mono">
              {pageSize}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => tableInstance.nextPage()}
              disabled={!tableInstance.getCanNextPage()}
              className="h-8 w-8 p-0"
            >
              →
            </Button>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {tableInstance.getState().pagination.pageIndex}
          </span>
        </div>
      </div>

      <AddRowDialog
        open={addRowDialogOpen}
        onOpenChange={setAddRowDialogOpen}
        connection={connection}
        table={table}
        columns={tableColumns}
        onSuccess={loadData}
      />

      <DataGeneratorDialog
        open={dataGeneratorDialogOpen}
        onOpenChange={setDataGeneratorDialogOpen}
        connection={connection}
        table={table}
        columns={tableColumns}
        onSuccess={loadData}
      />

      <ExportDataDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        data={getExportData()}
        tableName={table.name}
      />

      <BatchOperationsDialog
        open={batchOperationsDialogOpen}
        onOpenChange={setBatchOperationsDialogOpen}
        selectedRowCount={selectedCount}
        columns={tableColumns}
        onBatchDelete={handleBatchDelete}
        onBatchUpdate={handleBatchUpdate}
        onBatchExport={handleBatchExport}
        onBatchDuplicate={handleBatchDuplicate}
      />

        {editingCell && (
          <EditCellDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            columnName={editingCell.columnName}
            columnType={editingCell.columnType}
            currentValue={editingCell.currentValue}
            onSave={handleSaveEdit}
          />
        )}
      </div>

      {/* Transaction History Panel */}
      {showTransactionHistory && (
        <div className="w-80 shrink-0">
          <TransactionHistoryPanel
            tableKey={tableKey}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />
        </div>
      )}
    </div>
  );
}
