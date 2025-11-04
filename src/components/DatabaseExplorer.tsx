import { useEffect, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Table,
  Database,
  Loader2,
  RefreshCw,
  Plus,
  MoreVertical,
  Trash2,
  Edit,
  FileCode,
  Search,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreateTableDialog } from "@/components/CreateTableDialog";
import { ExportTableDialog } from "@/components/ExportTableDialog";
import { DatabaseTable, ConnectionConfig } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface DatabaseExplorerProps {
  connection: ConnectionConfig;
  onTableSelect: (table: DatabaseTable) => void;
  selectedTable: DatabaseTable | null;
  onNewQuery?: () => void;
}

export function DatabaseExplorer({
  connection,
  onTableSelect,
  selectedTable,
  onNewQuery,
}: DatabaseExplorerProps) {
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [createTableDialogOpen, setCreateTableDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [tableToExport, setTableToExport] = useState<DatabaseTable | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "table" | "view">("all");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [tableToRename, setTableToRename] = useState<string>("");
  const [newTableName, setNewTableName] = useState("");

  const loadTables = async () => {
    setIsLoading(true);
    try {
      const result = await invoke<DatabaseTable[]>("list_tables", {
        connectionId: connection.id,
        dbType: connection.db_type,
      });
      setTables(result);
    } catch (error) {
      toast.error(`Failed to load tables: ${error}`);
      console.error("Error loading tables:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDropTable = async (tableName: string) => {
    if (
      !confirm(
        `Are you sure you want to drop table "${tableName}"?\n\nThis action cannot be undone!`
      )
    ) {
      return;
    }

    try {
      const result = await invoke<string>("drop_table", {
        connectionId: connection.id,
        tableName,
      });
      toast.success(result);
      loadTables();
    } catch (error) {
      toast.error(`Failed to drop table: ${error}`);
      console.error("Drop table error:", error);
    }
  };

  const handleRenameTable = async (oldName: string) => {
    setTableToRename(oldName);
    setNewTableName(oldName);
    setRenameDialogOpen(true);
  };

  const executeRenameTable = async () => {
    if (!newTableName || newTableName === tableToRename) {
      setRenameDialogOpen(false);
      return;
    }

    try {
      const result = await invoke<string>("rename_table", {
        connectionId: connection.id,
        oldName: tableToRename,
        newName: newTableName,
        dbType: connection.db_type,
      });
      toast.success(result);
      loadTables();
      setRenameDialogOpen(false);
    } catch (error) {
      toast.error(`Failed to rename table: ${error}`);
      console.error("Rename table error:", error);
    }
  };

  useEffect(() => {
    loadTables();
  }, [connection.id]);

  // Filtered tables based on search and filter
  const filteredTables = useMemo(() => {
    return tables.filter((table) => {
      // Search filter
      const matchesSearch = table.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      // Type filter
      const matchesType =
        filterType === "all" ||
        (filterType === "table" && table.table_type === "TABLE") ||
        (filterType === "view" && table.table_type === "VIEW");

      return matchesSearch && matchesType;
    });
  }, [tables, searchQuery, filterType]);

  // Format size for display
  const formatSize = (sizeKb?: number) => {
    if (!sizeKb) return "N/A";
    if (sizeKb < 1024) return `${sizeKb} KB`;
    return `${(sizeKb / 1024).toFixed(1)} MB`;
  };

  // Format row count for display
  const formatRowCount = (count?: number) => {
    if (count === undefined || count === null) return "N/A";
    return count.toLocaleString();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">Tables</h2>
            {tables.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
                {tables.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={loadTables}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCreateTableDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {onNewQuery && (
          <Button
            variant="outline"
            size="sm"
            onClick={onNewQuery}
            className="w-full text-xs"
          >
            <Plus className="h-3 w-3 mr-1.5" />
            New Query
          </Button>
        )}

        {/* Search and Filter */}
        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Select
            value={filterType}
            onValueChange={(v) => setFilterType(v as "all" | "table" | "view")}
          >
            <SelectTrigger className="h-8 text-xs">
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Objects</SelectItem>
              <SelectItem value="table">Tables Only</SelectItem>
              <SelectItem value="view">Views Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading && tables.length === 0 ? (
            <div className="space-y-1 px-2">
              <Skeleton className="h-4 w-32 mb-3" />
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-2">
                  <Skeleton className="h-4 w-4 flex-shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {tables.length === 0
                ? "No tables found"
                : "No tables match your search"}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 py-1">
                <div className="text-xs font-semibold text-muted-foreground">
                  TABLES ({filteredTables.length}
                  {filteredTables.length !== tables.length
                    ? ` of ${tables.length}`
                    : ""}
                  )
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => setCreateTableDialogOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <TooltipProvider delayDuration={300}>
                {filteredTables.map((table) => (
                  <div
                    key={table.name}
                    className="flex items-center gap-1 group"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onTableSelect(table)}
                          className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                            selectedTable?.name === table.name
                              ? "bg-primary text-primary-foreground font-extrabold"
                              : "hover:bg-muted"
                          }`}
                        >
                          <Table className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{table.name}</span>
                          {table.table_type === "VIEW" && (
                            <span className="ml-auto text-[10px] px-1 py-0.5 rounded bg-secondary text-muted-foreground">
                              VIEW
                            </span>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        <div className="space-y-1">
                          <div className="font-semibold">{table.name}</div>
                          <div className="text-muted-foreground">
                            Type: {table.table_type || "TABLE"}
                          </div>
                          <div className="text-muted-foreground">
                            Rows: {formatRowCount(table.row_count)}
                          </div>
                          {table.size_kb !== undefined && (
                            <div className="text-muted-foreground">
                              Size: {formatSize(table.size_kb)}
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onTableSelect(table)}>
                          <Table className="h-4 w-4 mr-2" />
                          View Data
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setTableToExport(table);
                            setExportDialogOpen(true);
                          }}
                        >
                          <FileCode className="h-4 w-4 mr-2" />
                          Export Structure
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleRenameTable(table.name)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDropTable(table.name)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Drop Table
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </TooltipProvider>
            </div>
          )}
        </div>
      </ScrollArea>

      <CreateTableDialog
        open={createTableDialogOpen}
        onOpenChange={setCreateTableDialogOpen}
        connection={connection}
        onSuccess={loadTables}
      />

      {tableToExport && (
        <ExportTableDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          connection={connection}
          table={tableToExport}
        />
      )}

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Table</DialogTitle>
            <DialogDescription>
              Enter a new name for table "{tableToRename}".
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              placeholder="New table name"
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={executeRenameTable}
              disabled={!newTableName || newTableName === tableToRename}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
