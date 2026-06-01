import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConnectionConfig, DatabaseTable, ForeignKeyDefinition, TableColumn, TableConstraint } from "@/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ForeignKeyManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionConfig;
  tables: DatabaseTable[];
  initialTableName?: string | null;
  onSuccess?: () => void;
}

interface ColumnMapping {
  id: string;
  sourceColumn: string;
  targetColumn: string;
}

const ACTION_OPTIONS = ["NO ACTION", "RESTRICT", "CASCADE", "SET NULL", "SET DEFAULT"];

function createMappingId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getTableRef(table: DatabaseTable) {
  return table.full_name ?? table.name;
}

function getConstraintActions(constraint: TableConstraint) {
  const expression = constraint.check_expression?.toUpperCase() ?? "";
  const onDelete = ACTION_OPTIONS.find((action) => expression.includes(`ON DELETE ${action}`)) ?? "NO ACTION";
  const onUpdate = ACTION_OPTIONS.find((action) => expression.includes(`ON UPDATE ${action}`)) ?? "NO ACTION";
  return { onDelete, onUpdate };
}

export function ForeignKeyManagerDialog({
  open,
  onOpenChange,
  connection,
  tables,
  initialTableName,
  onSuccess,
}: ForeignKeyManagerDialogProps) {
  const tableRefs = useMemo(() => tables.map(getTableRef), [tables]);
  const [selectedTableName, setSelectedTableName] = useState(initialTableName ?? tableRefs[0] ?? "");
  const [targetTableName, setTargetTableName] = useState(initialTableName ?? tableRefs[0] ?? "");
  const [constraintName, setConstraintName] = useState("");
  const [onDelete, setOnDelete] = useState("NO ACTION");
  const [onUpdate, setOnUpdate] = useState("NO ACTION");
  const [mappings, setMappings] = useState<ColumnMapping[]>([{ id: createMappingId(), sourceColumn: "", targetColumn: "" }]);
  const [sourceColumns, setSourceColumns] = useState<TableColumn[]>([]);
  const [targetColumns, setTargetColumns] = useState<TableColumn[]>([]);
  const [constraints, setConstraints] = useState<TableConstraint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const nextSource = initialTableName ?? tableRefs[0] ?? "";
    setSelectedTableName(nextSource);
    setTargetTableName((current) => current || nextSource);
  }, [open, initialTableName, tableRefs]);

  const loadColumns = async (tableName: string, setter: (columns: TableColumn[]) => void) => {
    if (!tableName) {
      setter([]);
      return;
    }

    try {
      const columns = await invoke<TableColumn[]>("get_table_structure", {
        connectionId: connection.id,
        tableName,
        dbType: connection.db_type,
      });
      setter(columns);
    } catch (error) {
      console.error("Failed to load table structure for foreign keys:", error);
      toast.error(`Failed to load columns: ${error}`);
      setter([]);
    }
  };

  const loadConstraints = async () => {
    if (!selectedTableName) {
      setConstraints([]);
      return;
    }

    setIsLoading(true);
    try {
      const data = await invoke<TableConstraint[]>("get_table_constraints", {
        connectionId: connection.id,
        tableName: selectedTableName,
        dbType: connection.db_type,
      });
      setConstraints(data.filter((constraint) => constraint.constraint_type === "FOREIGN KEY"));
    } catch (error) {
      console.error("Failed to load foreign keys:", error);
      toast.error(`Failed to load foreign keys: ${error}`);
      setConstraints([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadColumns(selectedTableName, setSourceColumns);
    void loadConstraints();
  }, [open, selectedTableName]);

  useEffect(() => {
    if (!open) return;
    void loadColumns(targetTableName, setTargetColumns);
  }, [open, targetTableName]);

  const resetForm = () => {
    setConstraintName("");
    setOnDelete("NO ACTION");
    setOnUpdate("NO ACTION");
    setMappings([{ id: createMappingId(), sourceColumn: "", targetColumn: "" }]);
  };

  const handleCreate = async () => {
    const validMappings = mappings.filter((mapping) => mapping.sourceColumn && mapping.targetColumn);
    if (!selectedTableName || !targetTableName || !constraintName.trim() || validMappings.length === 0) {
      toast.error("Constraint name, source table, target table, and column mappings are required");
      return;
    }

    const foreignKey: ForeignKeyDefinition = {
      constraint_name: constraintName.trim(),
      table_name: selectedTableName,
      column_names: validMappings.map((mapping) => mapping.sourceColumn),
      referenced_table_name: targetTableName,
      referenced_column_names: validMappings.map((mapping) => mapping.targetColumn),
      on_delete: onDelete,
      on_update: onUpdate,
    };

    setIsSaving(true);
    try {
      const result = await invoke<string>("create_foreign_key", {
        connectionId: connection.id,
        foreignKey,
        dbType: connection.db_type,
      });
      toast.success(result);
      resetForm();
      await loadConstraints();
      onSuccess?.();
    } catch (error) {
      console.error("Create foreign key error:", error);
      toast.error(`Failed to create foreign key: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDrop = async (constraint: TableConstraint) => {
    if (!confirm(`Drop foreign key ${constraint.constraint_name}?`)) {
      return;
    }

    try {
      const result = await invoke<string>("drop_foreign_key", {
        connectionId: connection.id,
        tableName: selectedTableName,
        constraintName: constraint.constraint_name,
        dbType: connection.db_type,
      });
      toast.success(result);
      await loadConstraints();
      onSuccess?.();
    } catch (error) {
      console.error("Drop foreign key error:", error);
      toast.error(`Failed to drop foreign key: ${error}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Foreign Key Management</DialogTitle>
          <DialogDescription>
            Create, inspect, and drop foreign key constraints for {connection.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[1.2fr,0.8fr] overflow-hidden flex-1">
          <div className="space-y-4 overflow-hidden">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Source table</label>
                <Select value={selectedTableName} onValueChange={setSelectedTableName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source table" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table) => (
                      <SelectItem key={getTableRef(table)} value={getTableRef(table)}>
                        {getTableRef(table)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Target table</label>
                <Select value={targetTableName} onValueChange={setTargetTableName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target table" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table) => (
                      <SelectItem key={getTableRef(table)} value={getTableRef(table)}>
                        {getTableRef(table)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-1 grid gap-2">
                <label className="text-sm font-medium">Constraint name</label>
                <Input
                  value={constraintName}
                  onChange={(event) => setConstraintName(event.target.value)}
                  placeholder="fk_orders_customer"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">On delete</label>
                <Select value={onDelete} onValueChange={setOnDelete}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">On update</label>
                <Select value={onUpdate} onValueChange={setOnUpdate}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Column mappings</h3>
                  <p className="text-xs text-muted-foreground">Map source columns to referenced columns. Add more rows for composite keys.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setMappings((current) => [...current, { id: createMappingId(), sourceColumn: "", targetColumn: "" }])}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add mapping
                </Button>
              </div>

              {mappings.map((mapping, index) => (
                <div key={mapping.id} className="grid gap-2 sm:grid-cols-[1fr,1fr,auto] items-end">
                  <div className="grid gap-2">
                    <label className="text-xs font-medium text-muted-foreground">Source column #{index + 1}</label>
                    <Select
                      value={mapping.sourceColumn}
                      onValueChange={(value) =>
                        setMappings((current) => current.map((item) => item.id === mapping.id ? { ...item, sourceColumn: value } : item))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select source column" />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceColumns.map((column) => (
                          <SelectItem key={column.name} value={column.name}>{column.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs font-medium text-muted-foreground">Target column #{index + 1}</label>
                    <Select
                      value={mapping.targetColumn}
                      onValueChange={(value) =>
                        setMappings((current) => current.map((item) => item.id === mapping.id ? { ...item, targetColumn: value } : item))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select target column" />
                      </SelectTrigger>
                      <SelectContent>
                        {targetColumns.map((column) => (
                          <SelectItem key={column.name} value={column.name}>{column.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mb-0.5"
                    disabled={mappings.length === 1}
                    onClick={() => setMappings((current) => current.filter((item) => item.id !== mapping.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden flex flex-col min-h-0">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
              <div>
                <h3 className="text-sm font-semibold">Existing foreign keys</h3>
                <p className="text-xs text-muted-foreground">For {selectedTableName || "selected table"}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => void loadConstraints()} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {constraints.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No foreign keys found for this table.</p>
                ) : (
                  constraints.map((constraint) => {
                    const actions = getConstraintActions(constraint);
                    return (
                      <div key={constraint.constraint_name} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-sm">{constraint.constraint_name}</div>
                            <div className="text-xs text-muted-foreground">
                              ({constraint.column_names.join(", ")}) → {constraint.foreign_table_name} ({constraint.foreign_column_names?.join(", ") || ""})
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => void handleDrop(constraint)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="secondary">ON DELETE {actions.onDelete}</Badge>
                          <Badge variant="secondary">ON UPDATE {actions.onUpdate}</Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => void handleCreate()} disabled={isSaving}>
            {isSaving ? "Creating..." : "Create Foreign Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
