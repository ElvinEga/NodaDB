import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
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
  PaginationState,
  flexRender,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { invoke } from "@tauri-apps/api/core";
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
  Database,
  Filter,
  X,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { AddRowDialog } from "@/components/AddRowDialog";
import { EditCellDialog } from "@/components/EditCellDialog";
import { DataGeneratorDialog } from "@/components/DataGeneratorDialog";
import { ExportDataDialog } from "@/components/ExportDataDialog";
import { BatchOperationsDialog } from "@/components/BatchOperationsDialog";
import { TransactionHistoryPanel } from "@/components/TransactionHistoryPanel";
import { ColumnHeaderContextMenu } from "@/components/ColumnHeaderContextMenu";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useUndoRedoStore } from "@/stores/undoRedoStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useColumnDisplayStore } from "@/stores/columnDisplayStore";

import {
  ConnectionConfig,
  DatabaseTable,
  TableColumn,
  QueryResult,
  SQLiteBooleanSuggestion,
  TabFilter,
} from "@/types";
import { toast } from "sonner";
import { getCellRenderer } from "@/lib/cellRenderers";
import {
  coerceValueForDatabase,
  getTypeBadgeColor,
  getTypeFamilyLabel,
  parseInputValue,
  withEffectiveTypeFamily,
} from "@/lib/db-types";
import {
  generateSetNullSql,
  generateDeleteSql,
  generateDuplicateSql,
  calculateColumnStats,
} from "@/lib/tableOperations";
import {
  buildSelectQuery,
  buildCountQuery,
  qualifyTableName,
  quoteIdentifier,
} from "@/lib/sqlUtils";
import { KeyboardTooltip } from "./ui/keyboard-tooltip";
import { getOperatorsForDataType, FilterOperator } from "@/types/filter";
import { DateRange } from "react-day-picker";

interface TanStackTableViewerProps {
  connection: ConnectionConfig;
  table: DatabaseTable;
  columns: TableColumn[];
  initialFilters?: TabFilter[];
  onNavigateToTable?: (tableName: string, columnName: string, value: string) => void;
  onViewFlow?: (value: string) => void;
  onRefresh: () => void;
}

const isIdLike = (column: TableColumn, value: any): boolean => {
  if (value === null || value === undefined) return false;
  const strVal = String(value).trim();
  if (!strVal) return false;

  const nameLower = column.name.toLowerCase();
  const isIdColumnName =
    nameLower === "id" ||
    nameLower === "uuid" ||
    nameLower.endsWith("_id") ||
    nameLower.endsWith("_uuid") ||
    nameLower.endsWith("id");

  if (isIdColumnName) return true;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(strVal)) return true;

  return false;
};

export function TanStackTableViewer({
  connection,
  table,
  columns: tableColumns,
  initialFilters,
  onNavigateToTable,
  onViewFlow,
}: TanStackTableViewerProps) {
  const defaultPageSize = useSettingsStore((state) => state.rowsPerPage);
  const overrides = useColumnDisplayStore((state) => state.overrides);
  const setColumnOverride = useColumnDisplayStore((state) => state.setOverride);

  const [data, setData] = useState<Record<string, any>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    initialFilters || []
  );
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });
  const [executionTime, setExecutionTime] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [booleanSuggestions, setBooleanSuggestions] = useState<
    Record<string, SQLiteBooleanSuggestion>
  >({});
  const [dismissedSuggestions, setDismissedSuggestions] = useState<
    Record<string, true>
  >({});

  // Update page size when settings change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageSize: defaultPageSize }));
  }, [defaultPageSize]);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnId: string;
    columnName: string;
    columnType: string;
    column: TableColumn;
    currentValue: any;
  } | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [columnEditContext, setColumnEditContext] = useState<{
    column: TableColumn;
    rowCount: number;
    scopeLabel: string;
    currentValue: any;
  } | null>(null);
  const [columnEditDialogOpen, setColumnEditDialogOpen] = useState(false);
  const [addRowDialogOpen, setAddRowDialogOpen] = useState(false);
  const [dataGeneratorDialogOpen, setDataGeneratorDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [batchOperationsDialogOpen, setBatchOperationsDialogOpen] =
    useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenuCell, setContextMenuCell] = useState<{
    row: Record<string, any>;
    columnName: string;
    value: any;
  } | null>(null);
  const [pendingAlert, setPendingAlert] = useState<{
    title: string;
    description: ReactNode;
    actionLabel: string;
    tone?: "default" | "destructive";
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [isAlertProcessing, setIsAlertProcessing] = useState(false);

  // Undo/Redo store
  const tableKey = `${connection.id}-${table.name}`;
  const addAction = useUndoRedoStore((state) => state.addAction);
  const undo = useUndoRedoStore((state) => state.undo);
  const redo = useUndoRedoStore((state) => state.redo);
  const canUndo = useUndoRedoStore((state) => state.canUndo(tableKey));
  const canRedo = useUndoRedoStore((state) => state.canRedo(tableKey));

  const tableRef = table.full_name ?? table.name;
  const qualifiedTableName = useMemo(
    () => qualifyTableName(tableRef, table.schema, connection.db_type),
    [connection.db_type, table.schema, tableRef],
  );
  const effectiveTableColumns = useMemo(
    () =>
      tableColumns.map((column) =>
        withEffectiveTypeFamily(
          column,
          overrides[`${connection.id}::${tableRef}::${column.name}`],
        ),
      ),
    [connection.id, overrides, tableColumns, tableRef],
  );

  const [selectedFilterColumn, setSelectedFilterColumn] = useState<string>("");
  const [selectedFilterOperator, setSelectedFilterOperator] = useState<FilterOperator>("equals");
  const [filterValue, setFilterValue] = useState<string>("");

  useEffect(() => {
    if (effectiveTableColumns.length > 0) {
      if (!selectedFilterColumn) {
        setSelectedFilterColumn(effectiveTableColumns[0].name);
      }
      const col = effectiveTableColumns.find((c) => c.name === selectedFilterColumn);
      const ops = col ? getOperatorsForDataType(col.data_type) : [];
      if (ops.length > 0 && !ops.some((op) => op.value === selectedFilterOperator)) {
        setSelectedFilterOperator(ops[0].value);
      }
    }
  }, [effectiveTableColumns, selectedFilterColumn, selectedFilterOperator]);

  // Helper: Get primary key column
  const primaryKeyColumn = effectiveTableColumns.find(
    (col) => col.is_primary_key,
  );
  const getPrimaryKeyValue = (row: Record<string, any>) => {
    return primaryKeyColumn ? row[primaryKeyColumn.name] : null;
  };

  const describePendingValue = (value: string) => {
    if (value === "__NODADB_USE_DEFAULT__") return "DEFAULT";
    if (value === "__NODADB_EMPTY_STRING__") return "empty string";
    if (value === "") return "NULL";
    return value;
  };

  const openAlert = (config: {
    title: string;
    description: ReactNode;
    actionLabel: string;
    tone?: "default" | "destructive";
    onConfirm: () => Promise<void>;
  }) => {
    setPendingAlert(config);
  };

  const executePendingAlert = async () => {
    if (!pendingAlert) return;

    setIsAlertProcessing(true);
    try {
      await pendingAlert.onConfirm();
      setPendingAlert(null);
    } finally {
      setIsAlertProcessing(false);
    }
  };

  const formatSqlLiteral = (value: unknown) => {
    if (value === "__NODADB_USE_DEFAULT__") return "DEFAULT";
    if (value === "__NODADB_EMPTY_STRING__") return "''";
    if (value === null || value === undefined || value === "") return "NULL";
    if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === "boolean") {
      return connection.db_type === "sqlite"
        ? value
          ? "1"
          : "0"
        : value
          ? "TRUE"
          : "FALSE";
    }
    if (typeof value === "number") return String(value);
    if (typeof value === "object") {
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    }
    return `'${String(value).replace(/'/g, "''")}'`;
  };

  useEffect(() => {
    if (connection.db_type !== "sqlite") {
      setBooleanSuggestions({});
      return;
    }

    const candidateColumns = tableColumns.filter((column) => {
      const hasOverride =
        overrides[`${connection.id}::${tableRef}::${column.name}`] !==
        undefined;
      return column.type_family === "integer" && !hasOverride;
    });

    if (candidateColumns.length === 0) {
      setBooleanSuggestions({});
      return;
    }

    let isCancelled = false;

    const loadSuggestions = async () => {
      try {
        const qualifiedTable = qualifyTableName(
          tableRef,
          table.schema,
          connection.db_type,
        );
        const results = await Promise.all(
          candidateColumns.map(async (column) => {
            const columnRef = quoteIdentifier(column.name, connection.db_type);
            const query = `SELECT ${columnRef} FROM ${qualifiedTable} WHERE ${columnRef} IS NOT NULL LIMIT 200`;
            const result = await invoke<QueryResult>("execute_query", {
              connectionId: connection.id,
              query,
            });
            const values = result.rows.map((row) => row[column.name]);
            const hasRows = values.length > 0;
            const isCandidate =
              hasRows &&
              values.every(
                (value) =>
                  value === 0 ||
                  value === 1 ||
                  value === "0" ||
                  value === "1" ||
                  value === null ||
                  value === undefined,
              );

            return isCandidate
              ? [
                  column.name,
                  { columnName: column.name, sampleSize: values.length },
                ]
              : null;
          }),
        );

        if (isCancelled) return;

        setBooleanSuggestions(
          Object.fromEntries(
            results.filter(
              (entry): entry is [string, SQLiteBooleanSuggestion] =>
                entry !== null,
            ),
          ),
        );
      } catch (error) {
        console.error("Failed to detect SQLite boolean suggestions:", error);
      }
    };

    loadSuggestions();

    return () => {
      isCancelled = true;
    };
  }, [
    connection.db_type,
    connection.id,
    overrides,
    table.schema,
    tableColumns,
    tableRef,
  ]);

  // Load table data with server-side operations
  const loadData = async (pageIndex?: number, pageSizeValue?: number) => {
    setIsLoading(true);
    const startTime = Date.now();

    try {
      // Use provided values or get from table state
      const currentPageIndex = pageIndex !== undefined ? pageIndex : 0;
      const currentPageSize =
        pageSizeValue !== undefined ? pageSizeValue : pageSize;

      // Build dynamic query with sorting, filtering, and pagination
      // Fetch one extra row to detect if there are more pages
      const query = buildSelectQuery({
        tableName: tableRef,
        schema: table.schema,
        dbType: connection.db_type,
        limit: currentPageSize + 1,
        offset: currentPageIndex * currentPageSize,
        sorting: sorting,
        filters: columnFilters,
        globalFilter: globalFilter,
        columns: effectiveTableColumns.map((col) => col.name),
      });

      console.log("SQL Query:", query);

      // Execute query
      const result = await invoke<QueryResult>("execute_query", {
        connectionId: connection.id,
        query: query,
      });

      // Check if we got more rows than requested (means there are more pages)
      const hasNextPage = result.rows.length > currentPageSize;
      const displayRows = hasNextPage
        ? result.rows.slice(0, currentPageSize)
        : result.rows;

      setData(displayRows);

      // Estimate total count based on what we know
      // If we have a next page, we know there are at least (currentPageIndex + 2) * pageSize rows
      // Otherwise, we know the exact count
      const estimatedTotal = hasNextPage
        ? (currentPageIndex + 2) * currentPageSize // At least this many
        : currentPageIndex * currentPageSize + displayRows.length; // Exact count

      setRowCount(estimatedTotal);

      console.log("Pagination Debug:", {
        loadedRows: result.rows.length,
        displayRows: displayRows.length,
        hasNextPage,
        estimatedTotal,
        pageSize: currentPageSize,
        pageIndex: currentPageIndex,
        pageCount: hasNextPage ? currentPageIndex + 2 : currentPageIndex + 1,
      });

      setExecutionTime(Date.now() - startTime);
    } catch (error) {
      toast.error(`Failed to load data: ${error}`);
      console.error("Load data error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data load and reload on pagination/filter/sort changes
  useEffect(() => {
    loadData(pageIndex, pageSize);
  }, [
    connection.id,
    table.name,
    pageIndex,
    pageSize,
    sorting,
    columnFilters,
    globalFilter,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + F - Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Ctrl/Cmd + R - Refresh
      if ((e.ctrlKey || e.metaKey) && e.key === "r") {
        e.preventDefault();
        handleRefresh();
      }
      // Escape - Clear selection and cancel editing
      if (e.key === "Escape") {
        setRowSelection({});
        setEditingCell(null);
      }
      // Ctrl/Cmd + A - Select all (when table focused)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "a" &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        e.preventDefault();
        tableInstance.toggleAllRowsSelected(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Context menu handlers
  const handleSetCellNull = async (
    row: Record<string, any>,
    columnName: string,
  ) => {
    if (!primaryKeyColumn) {
      toast.error("Cannot update: No primary key defined");
      return;
    }

    const pkValue = getPrimaryKeyValue(row);
    const sql = generateSetNullSql(
      table.name,
      columnName,
      primaryKeyColumn.name,
      pkValue,
      table.schema,
      connection.db_type,
    );

    try {
      await invoke("execute_query", {
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
      toast.error("Cannot duplicate: No primary key defined");
      return;
    }

    const columnNames = tableColumns.map((col) => col.name);
    const insertSql = generateDuplicateSql(
      table.name,
      row,
      columnNames,
      primaryKeyColumn.name,
      table.schema,
      connection.db_type,
    );

    try {
      await invoke("execute_query", {
        connectionId: connection.id,
        query: insertSql,
      });

      // For insert operations, undo is difficult without knowing the new PK
      // We'll store a simplified version that tracks the inserted data
      const newRow = { ...row };
      delete newRow[primaryKeyColumn.name]; // Remove auto-generated PK

      addAction(tableKey, {
        id: `duplicate-${Date.now()}`,
        type: "insert",
        timestamp: new Date(),
        tableName: tableRef,
        connectionId: connection.id,
        dbType: connection.db_type,
        data: {
          rows: [newRow],
        },
        undoSql: `-- Insert undo requires the new primary key value after reload`,
        redoSql: insertSql,
      });

      toast.success("Row duplicated");
      loadData();
    } catch (error) {
      toast.error(`Failed to duplicate: ${error}`);
    }
  };

  const handleDeleteRow = async (row: Record<string, any>) => {
    if (!primaryKeyColumn) {
      toast.error("Cannot delete: No primary key defined");
      return;
    }

    const pkValue = getPrimaryKeyValue(row);
    const deleteSql = generateDeleteSql(
      table.name,
      primaryKeyColumn.name,
      pkValue,
      table.schema,
      connection.db_type,
    );

    openAlert({
      title: "Confirm row delete",
      description: (
        <>
          <span>Delete this row? This action can be undone from history.</span>
          <span className="mt-2 block break-all font-mono text-xs text-muted-foreground">
            {deleteSql}
          </span>
        </>
      ),
      actionLabel: "Delete row",
      tone: "destructive",
      onConfirm: async () => {
        try {
          // Generate INSERT SQL for undo
          const columns = tableColumns.map((col) => col.name);
          const values = columns.map((col) => {
            const value = row[col];
            if (value === null) return "NULL";
            if (typeof value === "string")
              return `'${value.replace(/'/g, "''")}'`;
            return value;
          });
          const insertSql = `INSERT INTO ${table.name} (${columns.join(", ")}) VALUES (${values.join(", ")})`;

          await invoke("execute_query", {
            connectionId: connection.id,
            query: deleteSql,
          });

          addAction(tableKey, {
            id: `delete-${Date.now()}`,
            type: "delete",
            timestamp: new Date(),
            tableName: tableRef,
            connectionId: connection.id,
            dbType: connection.db_type,
            data: {
              rows: [row],
              primaryKeyColumn: primaryKeyColumn.name,
              primaryKeyValues: [pkValue],
            },
            undoSql: insertSql,
            redoSql: deleteSql,
          });

          toast.success("Row deleted");
          loadData();
        } catch (error) {
          toast.error(`Failed to delete: ${error}`);
          throw error;
        }
      },
    });
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
Unique: ${stats.uniqueCount}${
      stats.min !== undefined
        ? `
Min: ${stats.min}
Max: ${stats.max}
Avg: ${stats.avg?.toFixed(2)}
Sum: ${stats.sum}`
        : ""
    }`;

    toast.info(message, { duration: 5000 });
  };

  // Define columns for TanStack Table
  const columns = useMemo<ColumnDef<Record<string, any>>[]>(() => {
    const cols: ColumnDef<Record<string, any>>[] = [
      // Selection column
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value: any) =>
              table.toggleAllPageRowsSelected(!!value)
            }
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
        id: "rowNumber",
        header: "#",
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
    effectiveTableColumns.forEach((col) => {
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
              onSetColumnValue={() => openColumnEditDialog(col)}
              onSetColumnNull={() => void handleSetColumnNull(col)}
              disableColumnEdit={
                col.is_primary_key ||
                (col.generated_kind ?? "") !== "" ||
                data.length === 0
              }
            >
              <div className="flex flex-col gap-1">
                <button
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() =>
                    column.toggleSorting(column.getIsSorted() === "asc")
                  }
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-normal">{col.name}</span>

                    {isSorted === "asc" ? (
                      <ChevronUp className="h-3.5 w-3.5 text-primary" />
                    ) : isSorted === "desc" ? (
                      <ChevronDown className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-1 text-[10px] flex-wrap">
                  <span
                    className={`px-1 py-0.5 rounded font-mono ${getTypeBadgeColor(
                      col.type_family,
                    )}`}
                  >
                    {getTypeFamilyLabel(col.type_family)}
                  </span>
                  {booleanSuggestions[col.name] &&
                    !dismissedSuggestions[col.name] && (
                      <>
                        <button
                          type="button"
                          className="rounded bg-emerald-500/10 px-1 py-0.5 font-mono text-emerald-500 hover:bg-emerald-500/20"
                          onClick={(event) => {
                            event.stopPropagation();
                            setColumnOverride({
                              connectionId: connection.id,
                              tableName: tableRef,
                              columnName: col.name,
                              typeFamily: "boolean",
                              source: "suggested",
                            });
                            setDismissedSuggestions((prev) => ({
                              ...prev,
                              [col.name]: true,
                            }));
                          }}
                        >
                          Treat as boolean?
                        </button>
                        <button
                          type="button"
                          className="rounded bg-secondary px-1 py-0.5 font-mono text-muted-foreground hover:bg-muted"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDismissedSuggestions((prev) => ({
                              ...prev,
                              [col.name]: true,
                            }));
                          }}
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                  {col.type_family === "boolean" &&
                    col.data_type.toUpperCase().includes("INT") && (
                      <span className="px-1 py-0.5 rounded font-mono bg-amber-500/10 text-amber-600">
                        OVERRIDE
                      </span>
                    )}
                  {col.is_primary_key && (
                    <span className="px-1 py-0.5 rounded font-mono bg-primary/10 text-primary">
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
            const hasIdRelations = isIdLike(col, value);
            return (
              <div
                className="group flex items-center justify-between cursor-pointer hover:bg-accent/50 -mx-1 px-1 py-0.5 rounded h-full w-full"
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenuCell({
                    row: row.original,
                    columnName: col.name,
                    value: value,
                  });
                }}
              >
                <span className="font-mono text-xs text-muted-foreground truncate flex-1 min-w-0">
                  {String(value)}
                </span>
                {hasIdRelations && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onViewFlow) onViewFlow(String(value));
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity shrink-0 ml-1"
                    title="View related data"
                  >
                    <Workflow className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          }

          const handleEditClick = (e?: React.MouseEvent) => {
            if (e) e.stopPropagation();
            setEditingCell({
              rowId: row.id,
              columnId: col.name,
              columnName: col.name,
              columnType: col.data_type,
              column: col,
              currentValue: value,
            });
            setEditDialogOpen(true);
          };

          // Display mode with custom renderer
          const hasIdRelations = isIdLike(col, value);
          return (
            <div
              className="group flex items-center justify-between cursor-pointer hover:bg-accent/50 -mx-1 px-1 py-0.5 rounded h-full"
              onDoubleClick={handleEditClick}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenuCell({
                  row: row.original,
                  columnName: col.name,
                  value: value,
                });
              }}
            >
              <div className="flex-1 min-w-0">
                {getCellRenderer(col, value)}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {hasIdRelations && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onViewFlow) onViewFlow(String(value));
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity"
                    title="View related data"
                  >
                    <Workflow className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={handleEditClick}
                  className="opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity"
                  title="Click to edit"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        },
        size: 270,
      });
    });

    return cols;
  }, [
    effectiveTableColumns,
    data,
    booleanSuggestions,
    dismissedSuggestions,
    connection.id,
    tableRef,
    handleShowColumnStats,
  ]);

  const tableInstance = useReactTable({
    data,
    columns,
    pageCount: rowCount > 0 ? Math.ceil(rowCount / pageSize) : -1,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnSizing,
      rowSelection,
      globalFilter,
      pagination: { pageIndex, pageSize },
    },
  });

  const selectedRows = tableInstance.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const getColumnEditTargets = () => {
    const targetRows =
      selectedCount > 0
        ? selectedRows.map((row) => row.original)
        : tableInstance.getFilteredRowModel().rows.map((row) => row.original);

    return {
      rows: targetRows,
      scopeLabel:
        selectedCount > 0
          ? `${selectedCount} selected row${selectedCount === 1 ? "" : "s"}`
          : `${targetRows.length} filtered row${targetRows.length === 1 ? "" : "s"}`,
    };
  };

  // Virtual scrolling setup
  const { rows } = tableInstance.getRowModel();
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 36, // Row height in pixels (h-9 = 36px)
    overscan: 20, // Number of items to render outside visible area (increased for smoother scrolling)
    measureElement:
      typeof window !== "undefined" &&
      navigator.userAgent.indexOf("Firefox") === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
  });

  const handleSaveEdit = async (newValue: string) => {
    if (!editingCell) return;

    try {
      const rowIndex = parseInt(editingCell.rowId);
      const row = data[rowIndex];
      const primaryKeyColumn = tableColumns.find((col) => col.is_primary_key);

      if (!primaryKeyColumn) {
        toast.error("No primary key found for update");
        return;
      }

      const primaryKeyValue = row[primaryKeyColumn.name];
      const oldValue = editingCell.currentValue;
      const columnName = editingCell.columnId;
      const parsedValue =
        newValue === "__NODADB_USE_DEFAULT__"
          ? "__NODADB_USE_DEFAULT__"
          : newValue === "__NODADB_EMPTY_STRING__"
            ? "__NODADB_EMPTY_STRING__"
            : newValue === ""
              ? null
              : coerceValueForDatabase(
                  editingCell.column,
                  parseInputValue(editingCell.column, newValue),
                  connection.db_type,
                );

      // Build update data object with only the changed column
      const updateData: Record<string, any> = {
        [columnName]: parsedValue,
      };

      // Build WHERE clause for the primary key
      const whereClause = `${primaryKeyColumn.name} = ${
        typeof primaryKeyValue === "string"
          ? `'${primaryKeyValue}'`
          : primaryKeyValue
      }`;

      // Generate SQL for undo/redo
      const formatValue = (val: any) => {
        if (val === null || val === "") return "NULL";
        if (typeof val === "string") return `'${val.replace(/'/g, "''")}'`;
        return val;
      };

      const updateSql = `UPDATE ${table.name} SET ${columnName} = ${formatValue(
        parsedValue,
      )} WHERE ${whereClause}`;
      const undoSql = `UPDATE ${table.name} SET ${columnName} = ${formatValue(
        oldValue,
      )} WHERE ${whereClause}`;

      await invoke("update_row", {
        connectionId: connection.id,
        tableName: tableRef,
        data: updateData,
        whereClause: whereClause,
        dbType: connection.db_type,
      });

      // Add to undo/redo history
      addAction(tableKey, {
        id: `update-${Date.now()}`,
        type: "update",
        timestamp: new Date(),
        tableName: tableRef,
        connectionId: connection.id,
        dbType: connection.db_type,
        data: {
          oldValues: [{ [columnName]: oldValue }],
          newValues: [{ [columnName]: newValue === "" ? null : newValue }],
          primaryKeyColumn: primaryKeyColumn.name,
          primaryKeyValues: [primaryKeyValue],
        },
        undoSql,
        redoSql: updateSql,
      });

      // Update local data
      const newData = [...data];
      newData[rowIndex] = {
        ...newData[rowIndex],
        [columnName]: newValue === "" ? null : newValue,
      };
      setData(newData);
      setEditingCell(null);
      setEditDialogOpen(false);
      toast.success("Cell updated successfully");
    } catch (error) {
      toast.error(`Failed to update cell: ${error}`);
      console.error("Update error:", error);
      throw error; // Re-throw to let dialog handle loading state
    }
  };

  const applyColumnUpdate = async (column: TableColumn, outgoingValue: string) => {
    if (!primaryKeyColumn) {
      toast.error("No primary key found for update");
      return;
    }

    const { rows, scopeLabel } = getColumnEditTargets();
    if (rows.length === 0) {
      toast.error("No rows available for column update");
      return;
    }

    const parsedValue =
      outgoingValue === "__NODADB_USE_DEFAULT__"
        ? "__NODADB_USE_DEFAULT__"
        : outgoingValue === "__NODADB_EMPTY_STRING__"
          ? "__NODADB_EMPTY_STRING__"
          : outgoingValue === ""
            ? null
            : coerceValueForDatabase(
                column,
                parseInputValue(column, outgoingValue),
                connection.db_type,
              );

    const quotedPrimaryKey = quoteIdentifier(
      primaryKeyColumn.name,
      connection.db_type,
    );
    const quotedColumn = quoteIdentifier(column.name, connection.db_type);
    const primaryKeyValues = rows.map((row) => row[primaryKeyColumn.name]);
    const whereClause = `${quotedPrimaryKey} IN (${primaryKeyValues
      .map((value) => formatSqlLiteral(value))
      .join(", ")})`;
    const updateSql = `UPDATE ${qualifiedTableName} SET ${quotedColumn} = ${formatSqlLiteral(parsedValue)} WHERE ${whereClause}`;
    const oldValues = rows.map((row) => ({
      [primaryKeyColumn.name]: row[primaryKeyColumn.name],
      [column.name]: row[column.name],
    }));
    const undoSql = oldValues
      .map((oldValue) => {
        const pkValue = oldValue[primaryKeyColumn.name];
        return `UPDATE ${qualifiedTableName} SET ${quotedColumn} = ${formatSqlLiteral(
          oldValue[column.name],
        )} WHERE ${quotedPrimaryKey} = ${formatSqlLiteral(pkValue)}`;
      })
      .join("; ");

    await invoke("execute_query", {
      connectionId: connection.id,
      query: updateSql,
    });

    addAction(tableKey, {
      id: `column-update-${Date.now()}`,
      type: "batch_update",
      timestamp: new Date(),
      tableName: tableRef,
      connectionId: connection.id,
      dbType: connection.db_type,
      data: {
        oldValues,
        columnName: column.name,
        value: outgoingValue,
        primaryKeyColumn: primaryKeyColumn.name,
        primaryKeyValues,
      },
      undoSql,
      redoSql: updateSql,
    });

    await loadData();
    setRowSelection({});
    toast.success(`Updated ${scopeLabel} for column ${column.name}`);
  };

  const openColumnEditDialog = (column: TableColumn) => {
    const { rows, scopeLabel } = getColumnEditTargets();
    if (rows.length === 0) {
      toast.error("No rows available for column update");
      return;
    }

    const values = rows.map((row) => row[column.name]);
    const firstValue = values[0];
    const hasSingleValue = values.every((value) => value === firstValue);

    setColumnEditContext({
      column,
      rowCount: rows.length,
      scopeLabel,
      currentValue: hasSingleValue ? firstValue : null,
    });
    setColumnEditDialogOpen(true);
  };

  const handleSaveColumnEdit = async (newValue: string) => {
    if (!columnEditContext) return;

    try {
      await applyColumnUpdate(columnEditContext.column, newValue);
      setColumnEditContext(null);
      setColumnEditDialogOpen(false);
    } catch (error) {
      toast.error(`Failed to update column: ${error}`);
      console.error("Column update error:", error);
      throw error;
    }
  };

  const handleSetColumnNull = async (column: TableColumn) => {
    const { rows, scopeLabel } = getColumnEditTargets();
    if (rows.length === 0) {
      toast.error("No rows available for column update");
      return;
    }

    openAlert({
      title: "Confirm column update",
      description: `Set column "${column.name}" to NULL for ${scopeLabel}?`,
      actionLabel: "Set NULL",
      onConfirm: async () => {
        try {
          await applyColumnUpdate(column, "");
        } catch (error) {
          toast.error(`Failed to set column NULL: ${error}`);
          console.error("Set column NULL error:", error);
          throw error;
        }
      },
    });
  };

  const handleDeleteRows = async () => {
    if (selectedCount === 0) return;

    openAlert({
      title: "Confirm selected rows delete",
      description: `Delete ${selectedCount} selected row${selectedCount === 1 ? "" : "s"}? This action can be undone from history.`,
      actionLabel: "Delete rows",
      tone: "destructive",
      onConfirm: async () => {
        try {
          const primaryKeyColumn = tableColumns.find((col) => col.is_primary_key);

          if (!primaryKeyColumn) {
            toast.error("No primary key found for delete");
            return;
          }

          const primaryKeyValues = selectedRows.map((row) => {
            const pkValue = row.original[primaryKeyColumn.name];
            return typeof pkValue === "string" ? `'${pkValue}'` : pkValue;
          });

          const whereClause = `${primaryKeyColumn.name} IN (${primaryKeyValues.join(", ")})`;
          const deleteSql = `DELETE FROM ${table.name} WHERE ${whereClause}`;

          const insertStatements = selectedRows.map((row) => {
            const columns = tableColumns.map((col) => col.name);
            const values = columns.map((col) => {
              const value = row.original[col];
              if (value === null) return "NULL";
              if (typeof value === "string")
                return `'${value.replace(/'/g, "''")}'`;
              return value;
            });
            return `INSERT INTO ${table.name} (${columns.join(", ")}) VALUES (${values.join(", ")})`;
          });
          const undoSql = insertStatements.join("; ");

          await invoke("delete_rows", {
            connectionId: connection.id,
            tableName: tableRef,
            whereClause: whereClause,
            dbType: connection.db_type,
          });

          addAction(tableKey, {
            id: `batch-delete-${Date.now()}`,
            type: "batch_delete",
            timestamp: new Date(),
            tableName: tableRef,
            connectionId: connection.id,
            dbType: connection.db_type,
            data: {
              rows: selectedRows.map((r) => r.original),
              primaryKeyColumn: primaryKeyColumn.name,
              primaryKeyValues: primaryKeyValues.map((v) =>
                typeof v === "string" ? v.replace(/'/g, "") : v,
              ),
            },
            undoSql,
            redoSql: deleteSql,
          });

          await loadData();
          setRowSelection({});
          toast.success(`Deleted ${selectedCount} row(s)`);
        } catch (error) {
          toast.error(`Failed to delete rows: ${error}`);
          console.error("Delete error:", error);
          throw error;
        }
      },
    });
  };

  // Batch operations handlers
  const handleBatchDelete = async () => {
    return handleDeleteRows();
  };

  const handleBatchUpdate = async (columnName: string, value: string) => {
    if (!primaryKeyColumn) {
      toast.error("No primary key found for update");
      return;
    }

    const primaryKeyValues = selectedRows.map((row) => {
      const pkValue = row.original[primaryKeyColumn.name];
      return typeof pkValue === "string" ? `'${pkValue}'` : pkValue;
    });

    // Capture old values for undo
    const oldValues = selectedRows.map((row) => ({
      [primaryKeyColumn.name]: row.original[primaryKeyColumn.name],
      [columnName]: row.original[columnName],
    }));

    const whereClause = `${primaryKeyColumn.name} IN (${primaryKeyValues.join(
      ", ",
    )})`;
    const setValue = value === "NULL" ? "NULL" : `'${value}'`;

    const updateSql = `UPDATE ${table.name} SET ${columnName} = ${setValue} WHERE ${whereClause}`;

    // Generate undo SQL (individual UPDATEs for each row to restore original values)
    const undoSqlStatements = oldValues.map((oldVal) => {
      const pkValue = oldVal[primaryKeyColumn.name];
      const oldValue = oldVal[columnName];
      const formattedOldValue =
        oldValue === null
          ? "NULL"
          : typeof oldValue === "string"
            ? `'${oldValue.replace(/'/g, "''")}'`
            : oldValue;
      const formattedPkValue =
        typeof pkValue === "string" ? `'${pkValue}'` : pkValue;
      return `UPDATE ${table.name} SET ${columnName} = ${formattedOldValue} WHERE ${primaryKeyColumn.name} = ${formattedPkValue}`;
    });
    const undoSql = undoSqlStatements.join("; ");

    try {
      await invoke("execute_query", {
        connectionId: connection.id,
        query: updateSql,
        dbType: connection.db_type,
      });

      // Add to undo/redo history
      addAction(tableKey, {
        id: `batch-update-${Date.now()}`,
        type: "batch_update",
        timestamp: new Date(),
        tableName: tableRef,
        connectionId: connection.id,
        dbType: connection.db_type,
        data: {
          oldValues,
          columnName,
          value,
          primaryKeyColumn: primaryKeyColumn.name,
          primaryKeyValues: primaryKeyValues.map((v) =>
            typeof v === "string" ? v.replace(/'/g, "") : v,
          ),
        },
        undoSql,
        redoSql: updateSql,
      });

      await loadData();
      setRowSelection({});
      toast.success(`Updated ${selectedCount} row(s)`);
    } catch (error) {
      toast.error(`Failed to update rows: ${error}`);
      console.error("Update error:", error);
    }
  };

  const handleBatchDuplicate = async () => {
    try {
      const editableColumns = tableColumns.filter((col) => !col.is_primary_key);

      for (const row of selectedRows) {
        const newRow: Record<string, any> = {};
        editableColumns.forEach((col) => {
          newRow[col.name] = row.original[col.name];
        });

        await invoke("insert_row", {
          connectionId: connection.id,
          tableName: tableRef,
          row: newRow,
          dbType: connection.db_type,
        });
      }

      await loadData();
      setRowSelection({});
      toast.success(`Duplicated ${selectedCount} row(s)`);
    } catch (error) {
      toast.error(`Failed to duplicate rows: ${error}`);
      console.error("Duplicate error:", error);
    }
  };

  const handleBatchExport = () => {
    setExportDialogOpen(true);
  };

  // Prepare data for export
  const getExportData = (): QueryResult => {
    // If rows are selected, export only selected rows
    const rowsToExport =
      selectedCount > 0
        ? tableInstance.getSelectedRowModel().rows
        : tableInstance.getFilteredRowModel().rows;

    const columns = tableInstance
      .getAllColumns()
      .filter((col: any) => col.id !== "select" && col.id !== "rowNumber")
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
      toast.error("Nothing to undo");
      return;
    }

    try {
      await invoke("execute_query", {
        connectionId: connection.id,
        query: action.undoSql,
        dbType: connection.db_type,
      });

      await loadData();
      toast.success(`Undone: ${action.type}`);
    } catch (error) {
      toast.error(`Failed to undo: ${error}`);
      console.error("Undo error:", error);
      // Re-add the action if undo failed
      addAction(tableKey, action);
    }
  };

  const handleRedo = async () => {
    const action = redo(tableKey);
    if (!action) {
      toast.error("Nothing to redo");
      return;
    }

    try {
      await invoke("execute_query", {
        connectionId: connection.id,
        query: action.redoSql,
        dbType: connection.db_type,
      });

      await loadData();
      toast.success(`Redone: ${action.type}`);
    } catch (error) {
      toast.error(`Failed to redo: ${error}`);
      console.error("Redo error:", error);
    }
  };

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + Z - Undo
      if (ctrlOrCmd && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        if (canUndo) handleUndo();
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y - Redo
      if (
        (ctrlOrCmd && e.shiftKey && e.key === "Z") ||
        (ctrlOrCmd && e.key === "y")
      ) {
        e.preventDefault();
        if (canRedo) handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo]);

  const handleRefresh = async () => {
    await loadData();
    toast.success("Table data refreshed");
  };

  return (
    <div className="h-full flex bg-background">
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-12 border-b border-border bg-secondary/50 backdrop-blur-sm flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <KeyboardTooltip description="Refresh" keys={["Ctrl", "R"]}>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                className="h-8"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>
            </KeyboardTooltip>
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
              <Plus className="h-3.5 w-3.5" />
              Insert
            </Button>
            {selectedCount === 1 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteRows}
                className="h-8"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <KeyboardTooltip description="Generate Data">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDataGeneratorDialogOpen(true)}
                className="h-8"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
            </KeyboardTooltip>
            {selectedCount > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBatchOperationsDialogOpen(true)}
                  className="h-8"
                >
                  <Workflow className="h-3.5 w-3.5" />
                  Batch ops{" "}
                  <span className="text-xs text-muted-foreground">
                    {selectedCount}
                  </span>
                </Button>
              </>
            )}

            {/* Filter Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                  <Filter className="h-3.5 w-3.5" />
                  Filter
                  {columnFilters.length > 0 && (
                    <Badge variant="secondary" className="h-4.5 px-1.5 py-0 text-[10px] font-semibold bg-primary/10 text-primary">
                      {columnFilters.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4 z-[100] bg-popover text-popover-foreground rounded-md border shadow-md" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Table Filters</h4>
                    {columnFilters.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setColumnFilters([])}
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        Clear All
                      </Button>
                    )}
                  </div>

                  {/* Active filters list */}
                  {columnFilters.length > 0 && (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {columnFilters.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between p-1.5 bg-muted/40 rounded text-xs border border-border"
                        >
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="font-semibold truncate">{f.id}</span>
                            {typeof f.value === "object" && f.value !== null && "operator" in f.value ? (() => {
                              const valObj = f.value as { operator: string; value: string };
                              return (
                                <>
                                  <span className="text-primary font-medium">{valObj.operator}</span>
                                  <span className="text-muted-foreground truncate font-mono bg-background px-1 py-0.5 rounded border border-border/50">
                                    {valObj.value}
                                  </span>
                                </>
                              );
                            })() : (
                              <>
                                <span className="text-muted-foreground">=</span>
                                <span className="text-muted-foreground truncate font-mono bg-background px-1 py-0.5 rounded border border-border/50">
                                  {String(f.value)}
                                </span>
                              </>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setColumnFilters((prev) => prev.filter((item) => item.id !== f.id))}
                            className="h-6 w-6 p-0 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Filter Form */}
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="text-xs font-medium text-muted-foreground">Add New Filter</div>
                    
                    {/* Column Select */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-medium">Column</label>
                      <Select
                        value={selectedFilterColumn}
                        onValueChange={(val) => {
                          setSelectedFilterColumn(val);
                          setFilterValue("");
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="Select column..." />
                        </SelectTrigger>
                        <SelectContent className="z-[110]">
                          {effectiveTableColumns.map((col) => (
                            <SelectItem key={col.name} value={col.name} className="text-xs">
                              <div className="flex items-center justify-between w-full gap-2">
                                <span>{col.name}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {col.data_type}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Operator Select */}
                    {(() => {
                      const col = effectiveTableColumns.find((c) => c.name === selectedFilterColumn);
                      const operators = col ? getOperatorsForDataType(col.data_type) : [];
                      
                      return (
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-medium">Operator</label>
                          <Select
                            value={selectedFilterOperator}
                            onValueChange={(val) => {
                              setSelectedFilterOperator(val as FilterOperator);
                              setFilterValue("");
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs bg-background">
                              <SelectValue placeholder="Select operator..." />
                            </SelectTrigger>
                            <SelectContent className="z-[110]">
                              {operators.map((op) => (
                                <SelectItem key={op.value} value={op.value} className="text-xs">
                                  {op.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })()}

                    {/* Dynamic Value Field */}
                    {(() => {
                      const col = effectiveTableColumns.find((c) => c.name === selectedFilterColumn);
                      const typeFamily = col?.type_family;
                      const isBoolean = typeFamily === "boolean";
                      const isNumber = typeFamily === "integer" || typeFamily === "float" || typeFamily === "decimal";
                      const isDateTime = typeFamily === "date_time" || typeFamily === "date" || typeFamily === "time";
                      const isEnum = typeFamily === "enum" || (col?.enum_values && col.enum_values.length > 0);
                      const isBetween = selectedFilterOperator === 'between';

                      return (
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-medium">Value</label>
                          {isBoolean ? (
                            <Select
                              value={filterValue}
                              onValueChange={setFilterValue}
                            >
                              <SelectTrigger className="h-8 text-xs bg-background">
                                <SelectValue placeholder="Select boolean..." />
                              </SelectTrigger>
                              <SelectContent className="z-[110]">
                                <SelectItem value="true" className="text-xs">True</SelectItem>
                                <SelectItem value="false" className="text-xs">False</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : isEnum ? (
                            <Select
                              value={filterValue}
                              onValueChange={setFilterValue}
                            >
                              <SelectTrigger className="h-8 text-xs bg-background">
                                <SelectValue placeholder="Select enum..." />
                              </SelectTrigger>
                              <SelectContent className="z-[110]">
                                {col?.enum_values?.map((val) => (
                                  <SelectItem key={val} value={val} className="text-xs">
                                    {val}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : isDateTime ? (() => {
                            let selectedRange: DateRange | undefined = undefined;
                            if (isBetween && filterValue) {
                              const parts = filterValue.split(',');
                              const fromDate = parts[0] ? new Date(parts[0]) : undefined;
                              const toDate = parts[1] ? new Date(parts[1]) : undefined;
                              if (fromDate && !isNaN(fromDate.getTime())) {
                                selectedRange = {
                                  from: fromDate,
                                  to: toDate && !isNaN(toDate.getTime()) ? toDate : undefined,
                                };
                              }
                            }

                            const selectedDate = !isBetween && filterValue ? new Date(filterValue) : undefined;
                            const isValidDate = selectedDate && !isNaN(selectedDate.getTime());

                            const getButtonText = () => {
                              if (isBetween) {
                                if (selectedRange?.from) {
                                  const fromStr = format(selectedRange.from, "yyyy-MM-dd");
                                  const toStr = selectedRange.to ? format(selectedRange.to, "yyyy-MM-dd") : "Pick end date";
                                  return `${fromStr} - ${toStr}`;
                                }
                                return "Pick date range...";
                              } else {
                                return isValidDate ? format(selectedDate!, "yyyy-MM-dd HH:mm:ss") : "Pick date/time...";
                              }
                            };

                            return (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                      "h-8 text-xs w-full justify-start text-left font-normal bg-background border-border",
                                      !filterValue && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                    <span>{getButtonText()}</span>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 z-[120]" align="start">
                                  {isBetween ? (
                                    <Calendar
                                      mode="range"
                                      selected={selectedRange}
                                      onSelect={(range) => {
                                        if (range) {
                                          const fromStr = range.from ? format(range.from, "yyyy-MM-dd 00:00:00") : "";
                                          const toStr = range.to ? format(range.to, "yyyy-MM-dd 23:59:59") : "";
                                          setFilterValue(`${fromStr},${toStr}`);
                                        } else {
                                          setFilterValue("");
                                        }
                                      }}
                                    />
                                  ) : (
                                    <Calendar
                                      mode="single"
                                      selected={isValidDate ? selectedDate : undefined}
                                      onSelect={(date) => {
                                        if (date) {
                                          setFilterValue(format(date, "yyyy-MM-dd HH:mm:ss"));
                                        } else {
                                          setFilterValue("");
                                        }
                                      }}
                                    />
                                  )}
                                </PopoverContent>
                              </Popover>
                            );
                          })() : (
                            <Input
                              type={isNumber ? "number" : "text"}
                              value={filterValue}
                              onChange={(e) => setFilterValue(e.target.value)}
                              placeholder="Enter filter value..."
                              className="h-8 text-xs bg-background"
                            />
                          )}
                        </div>
                      );
                    })()}

                    {/* Add Button */}
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        if (!selectedFilterColumn) return;
                        // Avoid duplicates: remove previous filter for this column first
                        setColumnFilters((prev) => [
                          ...prev.filter((f) => f.id !== selectedFilterColumn),
                          { id: selectedFilterColumn, value: { operator: selectedFilterOperator, value: filterValue } },
                        ]);
                        setFilterValue("");
                      }}
                      className="h-8 w-full mt-2"
                    >
                      Apply Filter
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Column visibility dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8">
                  <Columns3 className="h-3.5 w-3.5 mr-1" />
                  Columns
                  <ChevronDown className="h-3.5 w-3.5 ml-1" />
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
                        onCheckedChange={(value: boolean) =>
                          column.toggleVisibility(!!value)
                        }
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
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-8 w-48 text-xs"
            />
          </div>
        </div>

        {/* Table with Virtual Scrolling */}
        <ContextMenu
          onOpenChange={(open) => {
            if (!open) setContextMenuCell(null);
          }}
        >
          <ContextMenuTrigger asChild>
            <div
              ref={tableContainerRef}
              className="flex-1 overflow-auto"
              style={{ contain: "strict" }}
            >
              <div style={{ position: "relative" }}>
                <table
                  className="w-full text-xs border-t border-l border-r border-border"
                  style={{ display: "grid" }}
                >
                  {/* Sticky Header */}
                  <thead
                    className="sticky top-0 z-10 bg-muted/30"
                    style={{ display: "grid", position: "sticky", top: 0 }}
                  >
                    {tableInstance.getHeaderGroups().map((headerGroup: any) => (
                      <tr
                        key={headerGroup.id}
                        className="border-b border-border"
                        style={{ display: "flex", width: "100%" }}
                      >
                        {headerGroup.headers.map((header: any) => {
                          return (
                            <th
                              key={header.id}
                              className="h-12 px-3 py-2 text-left align-top font-normal text-xs text-muted-foreground border-r border-border bg-muted/30 relative group"
                              style={{
                                width: header.getSize(),
                                display: "flex",
                                alignItems: "start",
                              }}
                            >
                              <div className="flex-1 pt-0">
                                {header.isPlaceholder
                                  ? null
                                  : flexRender(
                                      header.column.columnDef.header,
                                      header.getContext(),
                                    )}
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
                              ${
                                header.column.getIsResizing()
                                  ? "bg-primary opacity-100"
                                  : ""
                              }
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
                      display: "grid",
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      position: "relative",
                      willChange: "transform",
                    }}
                  >
                    {isLoading ? (
                      Array.from({ length: 10 }).map((_, index) => (
                        <tr
                          key={`skeleton-${index}`}
                          style={{
                            display: "flex",
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: `${36}px`,
                            transform: `translateY(${index * 36}px)`,
                          }}
                          className="border-b border-r border-l border-border"
                        >
                          {tableInstance.getAllColumns().map((column) => (
                            <td
                              key={column.id}
                              style={{
                                display: "flex",
                                width: column.getSize(),
                                padding: "6px 12px",
                                alignItems: "center",
                              }}
                              className="border-r border-border"
                            >
                              <Skeleton className="h-4 w-full" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : rows.length === 0 ? (
                      <tr
                        className="absolute top-0 left-0 w-full"
                        style={{
                          display: "flex",
                          minHeight: "400px",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <td colSpan={columns.length} className="w-full">
                          <Empty>
                            <EmptyHeader>
                              <EmptyMedia variant="icon">
                                <Database />
                              </EmptyMedia>
                              <EmptyTitle>No data</EmptyTitle>
                              <EmptyDescription>
                                This table is empty. Add some data to get
                                started.
                              </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                              <Button onClick={() => setAddRowDialogOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Row
                              </Button>
                            </EmptyContent>
                          </Empty>
                        </td>
                      </tr>
                    ) : (
                      rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const row = rows[virtualRow.index];
                        return (
                          <tr
                            key={row.id}
                            data-state={
                              row.getIsSelected() ? "selected" : undefined
                            }
                            style={{
                              display: "flex",
                              position: "absolute",
                              transform: `translate3d(0, ${virtualRow.start}px, 0)`,
                              width: "100%",
                              willChange: "transform",
                            }}
                            className={`
                        h-9 border-b border-r border-l border-border transition-colors
                        ${
                          virtualRow.index % 2 === 0
                            ? "bg-background"
                            : "bg-muted/10"
                        }
                        hover:bg-accent/50
                        data-[state=selected]:bg-primary/5 data-[state=selected]:border-l-2 data-[state=selected]:border-l-primary
                      `}
                          >
                            {row.getVisibleCells().map((cell: any) => (
                              <td
                                key={cell.id}
                                className="px-3 py-1 flex items-center text-xs border-r border-border"
                                style={{
                                  width: cell.column.getSize(),
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  maxWidth: cell.column.getSize(),
                                }}
                              >
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )}
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
          </ContextMenuTrigger>

          {contextMenuCell && (
            <ContextMenuContent>
              <ContextMenuItem
                onClick={() => {
                  const tableCol = tableColumns.find(
                    (c) => c.name === contextMenuCell.columnName,
                  );
                  if (tableCol) {
                    setEditingCell({
                      rowId: String(data.indexOf(contextMenuCell.row)),
                      columnId: contextMenuCell.columnName,
                      columnName: contextMenuCell.columnName,
                      columnType: tableCol.data_type,
                      column: tableCol,
                      currentValue: contextMenuCell.value,
                    });
                    setEditDialogOpen(true);
                  }
                }}
              >
                <Edit2 className="h-3.5 w-3.5 mr-2" />
                Edit Cell
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() =>
                  handleSetCellNull(
                    contextMenuCell.row,
                    contextMenuCell.columnName,
                  )
                }
              >
                Set NULL
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() =>
                  handleFilterByValue(
                    contextMenuCell.columnName,
                    contextMenuCell.value,
                  )
                }
              >
                Filter by Value
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => {
                  if (contextMenuCell.value !== null && contextMenuCell.value !== undefined) {
                    if (onViewFlow) onViewFlow(String(contextMenuCell.value));
                  }
                }}
              >
                <Workflow className="h-3.5 w-3.5 mr-2" />
                Find Relations
              </ContextMenuItem>

              <ContextMenuSeparator />

              <ContextMenuItem
                onClick={() => handleDuplicateRow(contextMenuCell.row)}
              >
                Duplicate Row
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => handleDeleteRow(contextMenuCell.row)}
                className="text-destructive"
              >
                Delete Row
              </ContextMenuItem>
            </ContextMenuContent>
          )}
        </ContextMenu>

        {/* Footer / Pagination */}
        <div className="h-12 border-t border-border bg-secondary/50 backdrop-blur-sm flex items-center justify-between px-4 gap-4">
          <div className="flex items-center gap-4 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExportDialogOpen(true)}
              className="h-8 text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
            <Button
              variant={showTransactionHistory ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowTransactionHistory(!showTransactionHistory)}
              className="h-8 text-xs"
            >
              <History className="h-3.5 w-3.5 mr-1.5" />
              History
            </Button>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Query Duration:{" "}
              <span className="font-mono">{executionTime}ms</span>
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Showing {data.length} of {rowCount.toLocaleString()} rows
              {rowCount > 0 && ` (${Math.ceil(rowCount / pageSize)} pages)`}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => {
                tableInstance.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 30, 50, 70, 100].map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => {
                      if (pageIndex > 0) {
                        tableInstance.previousPage();
                      }
                    }}
                    className={
                      pageIndex === 0
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>

                {/* First page */}
                {pageIndex > 1 && (
                  <PaginationItem>
                    <PaginationLink
                      onClick={() => tableInstance.setPageIndex(0)}
                      className="cursor-pointer"
                    >
                      1
                    </PaginationLink>
                  </PaginationItem>
                )}

                {/* Ellipsis before current */}
                {pageIndex > 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}

                {/* Previous page */}
                {pageIndex > 0 && (
                  <PaginationItem>
                    <PaginationLink
                      onClick={() => tableInstance.previousPage()}
                      className="cursor-pointer"
                    >
                      {pageIndex}
                    </PaginationLink>
                  </PaginationItem>
                )}

                {/* Current page */}
                <PaginationItem>
                  <PaginationLink isActive className="cursor-default">
                    {pageIndex + 1}
                  </PaginationLink>
                </PaginationItem>

                {/* Next page */}
                {pageIndex < tableInstance.getPageCount() - 1 && (
                  <PaginationItem>
                    <PaginationLink
                      onClick={() => tableInstance.nextPage()}
                      className="cursor-pointer"
                    >
                      {pageIndex + 2}
                    </PaginationLink>
                  </PaginationItem>
                )}

                {/* Ellipsis after current */}
                {pageIndex < tableInstance.getPageCount() - 3 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}

                {/* Last page */}
                {pageIndex < tableInstance.getPageCount() - 2 && (
                  <PaginationItem>
                    <PaginationLink
                      onClick={() =>
                        tableInstance.setPageIndex(
                          tableInstance.getPageCount() - 1,
                        )
                      }
                      className="cursor-pointer"
                    >
                      {tableInstance.getPageCount()}
                    </PaginationLink>
                  </PaginationItem>
                )}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => {
                      if (pageIndex < Math.ceil(rowCount / pageSize) - 1) {
                        tableInstance.nextPage();
                      }
                    }}
                    className={
                      pageIndex >= Math.ceil(rowCount / pageSize) - 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>

        <AddRowDialog
          open={addRowDialogOpen}
          onOpenChange={setAddRowDialogOpen}
          connection={connection}
          table={table}
          columns={effectiveTableColumns}
          onSuccess={loadData}
          tableKey={tableKey}
          onAddAction={addAction}
        />

        <DataGeneratorDialog
          open={dataGeneratorDialogOpen}
          onOpenChange={setDataGeneratorDialogOpen}
          connection={connection}
          table={table}
          columns={effectiveTableColumns}
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
          columns={effectiveTableColumns}
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
            column={editingCell.column}
            currentValue={editingCell.currentValue}
            onSave={handleSaveEdit}
            confirmMessage={(newValue) =>
              `Update ${editingCell.columnName} for this cell to ${describePendingValue(newValue)}?`
            }
          />
        )}

        {columnEditContext && (
          <EditCellDialog
            open={columnEditDialogOpen}
            onOpenChange={(open) => {
              setColumnEditDialogOpen(open);
              if (!open) {
                setColumnEditContext(null);
              }
            }}
            columnName={columnEditContext.column.name}
            columnType={columnEditContext.column.data_type}
            column={columnEditContext.column}
            currentValue={columnEditContext.currentValue}
            onSave={handleSaveColumnEdit}
            confirmMessage={(newValue) =>
              `Update column "${columnEditContext.column.name}" for ${columnEditContext.scopeLabel} to ${describePendingValue(newValue)}?`
            }
            title="Edit Column Value"
            description={
              <>
                Updating column:{" "}
                <span className="font-mono font-semibold text-foreground">
                  {columnEditContext.column.name}
                </span>{" "}
                for{" "}
                <span className="font-semibold text-foreground">
                  {columnEditContext.scopeLabel}
                </span>{" "}
                <span className="text-xs text-muted-foreground">
                  ({columnEditContext.column.data_type})
                </span>
              </>
            }
            submitLabel={`Update ${columnEditContext.rowCount} Row${
              columnEditContext.rowCount === 1 ? "" : "s"
            }`}
          />
        )}
        <AlertDialog
          open={pendingAlert !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen && !isAlertProcessing) {
              setPendingAlert(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{pendingAlert?.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingAlert?.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isAlertProcessing}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isAlertProcessing || !pendingAlert}
                className={pendingAlert?.tone === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  void executePendingAlert();
                }}
              >
                {isAlertProcessing ? "Processing..." : pendingAlert?.actionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
