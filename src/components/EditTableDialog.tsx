import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2, TableProperties } from "lucide-react";
import { ConnectionConfig, DatabaseTable, TableColumn } from "@/types";
import { toast } from "sonner";

interface EditTableDialogProps {
  table: DatabaseTable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionConfig;
  onSuccess: () => void;
}

interface ColumnEdit {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  isExisting: boolean;
  originalName: string;
}

const DATA_TYPES = {
  sqlite: [
    "INTEGER",
    "TEXT",
    "REAL",
    "BLOB",
    "NUMERIC",
    "VARCHAR(255)",
    "BOOLEAN",
    "DATE",
    "DATETIME",
  ],
  postgresql: [
    "INTEGER",
    "BIGINT",
    "SERIAL",
    "BIGSERIAL",
    "VARCHAR(255)",
    "TEXT",
    "BOOLEAN",
    "REAL",
    "DOUBLE PRECISION",
    "NUMERIC",
    "DATE",
    "TIMESTAMP",
    "TIMESTAMPTZ",
    "JSON",
    "JSONB",
    "UUID",
  ],
  mysql: [
    "INT",
    "BIGINT",
    "AUTO_INCREMENT",
    "VARCHAR(255)",
    "TEXT",
    "LONGTEXT",
    "BOOLEAN",
    "TINYINT(1)",
    "FLOAT",
    "DOUBLE",
    "DECIMAL",
    "DATE",
    "DATETIME",
    "TIMESTAMP",
    "JSON",
  ],
  mongodb: [
    "String",
    "Int32",
    "Int64",
    "Double",
    "Boolean",
    "Date",
    "ObjectId",
    "Object",
    "Array",
  ],
  clickhouse: [
    "UInt64",
    "Int64",
    "Int32",
    "Float64",
    "String",
    "Date",
    "DateTime",
    "DateTime64",
    "UUID",
    "Array(String)",
    "Map(String, String)",
    "JSON",
    "Enum8",
    "IPv4",
    "IPv6",
  ],
  libsql: [
    "INTEGER",
    "TEXT",
    "REAL",
    "BLOB",
    "NUMERIC",
    "VARCHAR(255)",
    "BOOLEAN",
    "DATE",
    "DATETIME",
  ],
};

export function EditTableDialog({
  table,
  open,
  onOpenChange,
  connection,
  onSuccess,
}: EditTableDialogProps) {
  const [tableName, setTableName] = useState("");
  const [columns, setColumns] = useState<ColumnEdit[]>([]);
  const [isLoadingStructure, setIsLoadingStructure] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const dataTypes = (DATA_TYPES as Record<string, string[]>)[connection.db_type] || DATA_TYPES.sqlite;

  useEffect(() => {
    if (!open || !table) return;
    setTableName(table.name);

    const fetchStructure = async () => {
      setIsLoadingStructure(true);
      try {
        const result = await invoke<TableColumn[]>("get_table_structure", {
          connectionId: connection.id,
          tableName: table.name,
          dbType: connection.db_type,
        });

        const mapped: ColumnEdit[] = result.map((col, index) => ({
          id: `existing-${index}-${col.name}`,
          name: col.name,
          type: col.data_type.toUpperCase(),
          nullable: col.is_nullable,
          primaryKey: col.is_primary_key,
          isExisting: true,
          originalName: col.name,
        }));

        setColumns(mapped);
      } catch (error) {
        toast.error(`Failed to load table structure: ${error}`);
        console.error("Error loading table structure:", error);
      } finally {
        setIsLoadingStructure(false);
      }
    };

    void fetchStructure();
  }, [open, table, connection.id, connection.db_type]);

  const addColumn = () => {
    const newCol: ColumnEdit = {
      id: `new-${Date.now()}`,
      name: `column_${columns.length + 1}`,
      type: dataTypes[0],
      nullable: true,
      primaryKey: false,
      isExisting: false,
      originalName: "",
    };
    setColumns([...columns, newCol]);
  };

  const removeColumn = (id: string) => {
    if (columns.length === 1) {
      toast.error("Table must have at least one column");
      return;
    }
    setColumns(columns.filter((c) => c.id !== id));
  };

  const updateColumn = (id: string, updates: Partial<ColumnEdit>) => {
    setColumns(
      columns.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleSave = async () => {
    if (!table) return;
    if (!tableName.trim()) {
      toast.error("Please enter a table name");
      return;
    }

    if (columns.length === 0) {
      toast.error("Table must have at least one column");
      return;
    }

    // Validate column names
    const names = columns.map((c) => c.name.trim());
    if (names.some((n) => !n)) {
      toast.error("All columns must have valid names");
      return;
    }

    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    if (duplicates.length > 0) {
      toast.error(`Duplicate column names: ${duplicates.join(", ")}`);
      return;
    }

    setIsSaving(true);

    try {
      // 1. Rename table if changed
      if (tableName.trim() !== table.name) {
        await invoke<string>("rename_table", {
          connectionId: connection.id,
          oldName: table.name,
          newName: tableName.trim(),
          dbType: connection.db_type,
        });
      }

      const activeTableName = tableName.trim();

      // 2. Process added new columns
      const newColumns = columns.filter((c) => !c.isExisting);
      for (const col of newColumns) {
        const nullClause = col.nullable ? "" : " NOT NULL";
        const sql = `ALTER TABLE "${activeTableName}" ADD COLUMN "${col.name.trim()}" ${col.type}${nullClause};`;
        await invoke("execute_query", {
          connectionId: connection.id,
          query: sql,
        });
      }

      toast.success(`Table "${activeTableName}" structure updated successfully`);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(`Failed to update table structure: ${error}`);
      console.error("Update table error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TableProperties className="h-5 w-5 text-primary" />
            Edit Table: {table?.name}
          </DialogTitle>
          <DialogDescription>
            Update columns and structure for table "{table?.name}"
          </DialogDescription>
        </DialogHeader>

        {isLoadingStructure ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Loading table structure...</span>
          </div>
        ) : (
          <ScrollArea className="flex-1 overflow-y-auto pr-4">
            <div className="grid gap-4 py-4 mx-2">
              {/* Table Name */}
              <div className="grid gap-2">
                <label htmlFor="editTableName" className="text-sm font-medium">
                  Table Name
                </label>
                <Input
                  id="editTableName"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="table_name"
                  className="font-mono text-sm"
                />
              </div>

              {/* Columns */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Columns ({columns.length})</label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addColumn}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Column
                  </Button>
                </div>

                <div className="max-h-[350px] overflow-y-auto pr-2">
                  <div className="space-y-3">
                    {columns.map((column) => (
                      <div
                        key={column.id}
                        className={`grid grid-cols-12 gap-2 items-start p-3 border rounded-lg transition-colors ${
                          column.isExisting
                            ? "bg-card border-border"
                            : "bg-primary/5 border-primary/30"
                        }`}
                      >
                        {/* Column Name */}
                        <div className="col-span-3">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                              Name
                            </label>
                            {column.isExisting && (
                              <span className="text-[9px] px-1 bg-muted rounded text-muted-foreground font-mono">
                                EXISTING
                              </span>
                            )}
                          </div>
                          <Input
                            value={column.name}
                            onChange={(e) =>
                              updateColumn(column.id, { name: e.target.value })
                            }
                            placeholder="column_name"
                            className="mt-1 h-9 text-xs font-mono"
                          />
                        </div>

                        {/* Data Type */}
                        <div className="col-span-3">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                            Type
                          </label>
                          <Select
                            value={column.type}
                            onValueChange={(value) =>
                              updateColumn(column.id, { type: value })
                            }
                          >
                            <SelectTrigger className="mt-1 h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {dataTypes.map((type: string) => (
                                <SelectItem
                                  key={type}
                                  value={type}
                                  className="text-xs font-mono"
                                >
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Nullable */}
                        <div className="col-span-2 flex items-center gap-2 mt-6">
                          <input
                            type="checkbox"
                            id={`edit-nullable-${column.id}`}
                            checked={column.nullable}
                            onChange={(e) =>
                              updateColumn(column.id, {
                                nullable: e.target.checked,
                              })
                            }
                            className="cursor-pointer accent-primary"
                          />
                          <label
                            htmlFor={`edit-nullable-${column.id}`}
                            className="text-xs cursor-pointer"
                          >
                            Nullable
                          </label>
                        </div>

                        {/* Primary Key */}
                        <div className="col-span-2 flex items-center gap-2 mt-6">
                          <input
                            type="checkbox"
                            id={`edit-pk-${column.id}`}
                            checked={column.primaryKey}
                            onChange={(e) => {
                              const isPK = e.target.checked;
                              updateColumn(column.id, {
                                primaryKey: isPK,
                                nullable: isPK ? false : column.nullable,
                              });
                            }}
                            className="cursor-pointer accent-primary"
                          />
                          <label
                            htmlFor={`edit-pk-${column.id}`}
                            className="text-xs cursor-pointer"
                          >
                            PK
                          </label>
                        </div>

                        {/* Delete */}
                        <div className="col-span-2 flex justify-end mt-6">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => removeColumn(column.id)}
                            disabled={columns.length === 1}
                            className="h-9 w-9 p-0"
                            title="Remove column"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoadingStructure}>
            {isSaving ? "Saving..." : "Update Table"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
