import { useEffect, useState, useMemo, useCallback } from "react";
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
  Tag as TagIcon,
  ChevronDown,
  ChevronRight,
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
import { TagManager } from "@/components/TagManager";
import { TagSelectDialog } from "@/components/TagSelectDialog";
import { TableRow } from "@/components/TableRow";
import { DatabaseTable, ConnectionConfig, TableTag, TagColor } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getTags,
  getTagForTable,
  getTablesForTag,
} from "@/lib/tagStorage";

const colorClasses: Record<TagColor, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  yellow: "bg-yellow-500",
  lime: "bg-lime-500",
  green: "bg-green-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  cyan: "bg-cyan-500",
  sky: "bg-sky-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  purple: "bg-purple-500",
  fuchsia: "bg-fuchsia-500",
  pink: "bg-pink-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
  gray: "bg-gray-500",
  zinc: "bg-zinc-500",
  neutral: "bg-neutral-500",
  stone: "bg-stone-500",
};

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

  // Tag-related state
  const [tags, setTags] = useState<TableTag[]>([]);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [tagSelectOpen, setTagSelectOpen] = useState(false);
  const [tableForTag, setTableForTag] = useState<string>("");
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());
  const [untaggedCollapsed, setUntaggedCollapsed] = useState(false);

  // Refresh tags when dialog closes
  const refreshTags = useCallback(() => {
    setTags(getTags());
  }, []);

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
    refreshTags();
  }, [connection.id, refreshTags]);

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
              onClick={() => setTagManagerOpen(true)}
            >
              <TagIcon className="h-3.5 w-3.5" />
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
            <TooltipProvider delayDuration={300}>
              {/* Tag Groups */}
              {tags.map((tag) => {
                const tagTables = filteredTables.filter((table) => {
                  const tableTag = getTagForTable(table.name, connection.id);
                  return tableTag?.id === tag.id;
                });

                if (tagTables.length === 0) return null;

                const isCollapsed = collapsedTags.has(tag.id);

                return (
                  <div key={tag.id} className="mb-3">
                    <button
                      onClick={() => {
                        setCollapsedTags((prev) => {
                          const next = new Set(prev);
                          if (next.has(tag.id)) {
                            next.delete(tag.id);
                          } else {
                            next.add(tag.id);
                          }
                          return next;
                        });
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 w-full hover:bg-muted/50 rounded-md transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <div className={`w-2.5 h-2.5 rounded-full ${colorClasses[tag.color]}`} />
                      <span className="text-xs font-semibold text-muted-foreground flex-1 text-left">
                        {tag.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {tagTables.length}
                      </span>
                    </button>
                    {!isCollapsed && (
                      <div className="ml-4 mt-1 space-y-0.5">
                        {tagTables.map((table) => (
                          <TableRow
                            key={table.name}
                            table={table}
                            selectedTable={selectedTable}
                            onTableSelect={onTableSelect}
                            setTableToExport={setTableToExport}
                            setExportDialogOpen={setExportDialogOpen}
                            handleRenameTable={handleRenameTable}
                            setTableForTag={setTableForTag}
                            setTagSelectOpen={setTagSelectOpen}
                            handleDropTable={handleDropTable}
                            formatRowCount={formatRowCount}
                            formatSize={formatSize}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Untagged Tables */}
              <div>
                <button
                  onClick={() => setUntaggedCollapsed(!untaggedCollapsed)}
                  className="flex items-center gap-1.5 px-2 py-1 w-full hover:bg-muted/50 rounded-md transition-colors"
                >
                  {untaggedCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <div className="w-2.5 h-2.5 rounded-full bg-muted border border-border" />
                  <span className="text-xs font-semibold text-muted-foreground flex-1 text-left">
                    Untagged
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {
                      filteredTables.filter(
                        (table) => !getTagForTable(table.name, connection.id)
                      ).length
                    }
                  </span>
                </button>
                {!untaggedCollapsed && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    {filteredTables
                      .filter((table) => !getTagForTable(table.name, connection.id))
                      .map((table) => (
                        <TableRow
                          key={table.name}
                          table={table}
                          selectedTable={selectedTable}
                          onTableSelect={onTableSelect}
                          setTableToExport={setTableToExport}
                          setExportDialogOpen={setExportDialogOpen}
                          handleRenameTable={handleRenameTable}
                          setTableForTag={setTableForTag}
                          setTagSelectOpen={setTagSelectOpen}
                          handleDropTable={handleDropTable}
                          formatRowCount={formatRowCount}
                          formatSize={formatSize}
                        />
                      ))}
                  </div>
                )}
              </div>
            </TooltipProvider>
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

      <TagManager
        open={tagManagerOpen}
        onOpenChange={setTagManagerOpen}
        onTagsChange={refreshTags}
      />

      <TagSelectDialog
        open={tagSelectOpen}
        onOpenChange={setTagSelectOpen}
        tableName={tableForTag}
        connectionId={connection.id}
        onTagChange={refreshTags}
        onOpenTagManager={() => setTagManagerOpen(true)}
      />
    </div>
  );
}
