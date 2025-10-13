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
  Check,
  X as XIcon,
  GripVertical,
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

import { ConnectionConfig, DatabaseTable, TableColumn, QueryResult } from '@/types';
import { toast } from 'sonner';
import { getCellRenderer } from '@/lib/cellRenderers';

interface TanStackTableViewerProps {
  connection: ConnectionConfig;
  table: DatabaseTable;
  columns: TableColumn[];
  onAddRow: () => void;
  onRefresh: () => void;
}

export function TanStackTableViewer({
  connection,
  table,
  columns: tableColumns,
  onAddRow,
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
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

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
          );
        },
        cell: ({ getValue, row }) => {
          const value = getValue();
          const isNull = value === null || value === undefined;
          const cellId = { rowId: row.id, columnId: col.name };
          const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === col.name;

          // Primary key styling (not editable)
          if (col.is_primary_key) {
            return <span className="font-mono text-xs text-muted-foreground">{String(value)}</span>;
          }

          // Editing mode
          if (isEditing) {
            return (
              <div className="flex items-center gap-1">
                <Input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveEdit(row.id, col.name);
                    } else if (e.key === 'Escape') {
                      setEditingCell(null);
                    }
                  }}
                  className="h-7 text-xs"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSaveEdit(row.id, col.name);
                  }}
                >
                  <Check className="h-3 w-3 text-success" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => setEditingCell(null)}
                >
                  <XIcon className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            );
          }

          // Display mode with custom renderer
          return (
            <div
              className="group flex items-center justify-between cursor-pointer hover:bg-accent/50 -mx-2 px-2 py-1 rounded"
              onDoubleClick={() => {
                setEditingCell(cellId);
                setEditValue(isNull ? '' : String(value));
              }}
            >
              <div className="flex-1 min-w-0">
                {getCellRenderer(col.data_type, value)}
              </div>
              <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50 ml-2 shrink-0" />
            </div>
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

  const handleSaveEdit = async (rowId: string, columnId: string) => {
    try {
      const rowIndex = parseInt(rowId);
      const row = data[rowIndex];
      const primaryKeyColumn = tableColumns.find(col => col.is_primary_key);
      
      if (!primaryKeyColumn) {
        toast.error('No primary key found for update');
        return;
      }

      const primaryKeyValue = row[primaryKeyColumn.name];
      
      // Build update data object with only the changed column
      const updateData: Record<string, any> = {
        [columnId]: editValue === '' ? null : editValue,
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
        [columnId]: editValue === '' ? null : editValue,
      };
      setData(newData);
      setEditingCell(null);
      toast.success('Cell updated successfully');
    } catch (error) {
      toast.error(`Failed to update cell: ${error}`);
      console.error('Update error:', error);
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

  const handleExport = () => {
    const csv = [
      tableInstance.getAllColumns()
        .filter((col: any) => col.id !== 'select' && col.id !== 'rowNumber')
        .map((col: any) => col.id)
        .join(','),
      ...tableInstance.getFilteredRowModel().rows.map((row: any) =>
        tableInstance.getAllColumns()
          .filter((col: any) => col.id !== 'select' && col.id !== 'rowNumber')
          .map((col: any) => JSON.stringify(row.getValue(col.id)))
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${table.name}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Table exported as CSV');
  };

  const handleRefresh = async () => {
    await loadData();
    toast.success('Table data refreshed');
  };

  return (
    <div className="h-full flex flex-col bg-background">
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
            variant="default"
            size="sm"
            onClick={onAddRow}
            className="h-8"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add row
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
            <span className="text-xs text-muted-foreground ml-2">
              {selectedCount} selected
            </span>
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
                <tr className="absolute top-0 left-0 w-full" style={{ display: 'flex', height: '128px', alignItems: 'center', justifyContent: 'center' }}>
                  <td colSpan={columns.length} className="text-center w-full">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  </td>
                </tr>
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
          <Button variant="ghost" size="sm" onClick={handleExport} className="h-8 text-xs">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
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
    </div>
  );
}
