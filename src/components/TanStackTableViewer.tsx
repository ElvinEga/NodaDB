import { useState, useMemo, useEffect } from 'react';
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
  flexRender,
} from '@tanstack/react-table';
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
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const pageSize = 50;
  const [executionTime, setExecutionTime] = useState(0);

  // Load table data
  const loadData = async () => {
    setIsLoading(true);
    const startTime = Date.now();

    try {
      const result = await invoke<QueryResult>('get_table_data', {
        connectionId: connection.id,
        tableName: table.name,
        limit: 1000,
        offset: 0,
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
        cell: ({ getValue }) => {
          const value = getValue();
          const isNull = value === null || value === undefined;

          // Primary key styling
          if (col.is_primary_key) {
            return <span className="font-mono text-xs text-muted-foreground">{String(value)}</span>;
          }

          if (isNull) {
            return <span className="italic text-muted-foreground/70">NULL</span>;
          }

          return <span className="text-sm">{String(value)}</span>;
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
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
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

  const handleDeleteRows = async () => {
    if (selectedCount === 0) return;

    if (!confirm(`Delete ${selectedCount} selected row(s)?`)) return;

    // TODO: Implement bulk delete
    toast.info('Bulk delete not yet implemented');
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
            placeholder="Search..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 w-48 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <div className="relative">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-secondary">
              {tableInstance.getHeaderGroups().map((headerGroup: any) => (
                <tr key={headerGroup.id} className="border-b-2 border-border">
                  {headerGroup.headers.map((header: any) => {
                    return (
                      <th
                        key={header.id}
                        className="h-14 px-4 text-left align-top font-medium text-muted-foreground text-xs border-r border-border/50"
                        style={{ width: header.getSize() }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="h-32 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  </td>
                </tr>
              ) : tableInstance.getRowModel().rows?.length ? (
                tableInstance.getRowModel().rows.map((row: any, idx: number) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    className={`
                      h-10 border-b border-border/50 transition-colors
                      ${idx % 2 === 0 ? 'bg-background' : 'bg-secondary/20'}
                      hover:bg-accent
                      data-[state=selected]:bg-primary/5 data-[state=selected]:border-l-2 data-[state=selected]:border-l-primary
                    `}
                  >
                    {row.getVisibleCells().map((cell: any) => (
                      <td
                        key={cell.id}
                        className="px-4 py-2"
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ScrollArea>

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
