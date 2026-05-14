import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Loader2 } from "lucide-react";
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
import { ConnectionConfig, TableColumn, DatabaseTable } from "@/types";
import { parseInputValue, resolveColumnInputType } from "@/lib/db-types";
import { toast } from "sonner";
import { TableAction } from "@/stores/undoRedoStore";

interface AddRowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionConfig;
  table: DatabaseTable;
  columns: TableColumn[];
  onSuccess: () => void;
  tableKey?: string;
  onAddAction?: (tableKey: string, action: TableAction) => void;
}

export function AddRowDialog({
  open,
  onOpenChange,
  connection,
  table,
  columns,
  onSuccess,
  tableKey,
  onAddAction,
}: AddRowDialogProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [valueMode, setValueMode] = useState<Record<string, "value" | "null" | "default" | "empty">>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tableRef = table.full_name ?? table.name;

  useEffect(() => {
    // Initialize form with empty values or defaults
    const initialData: Record<string, string> = {};
    columns.forEach((col) => {
      if (col.default_value) {
        initialData[col.name] = col.default_value;
      } else {
        initialData[col.name] = "";
      }
    });
    setFormData(initialData);
    const initialModes: Record<string, "value" | "null" | "default" | "empty"> = {};
    columns.forEach((col) => {
      initialModes[col.name] = col.default_value ? "default" : "value";
    });
    setValueMode(initialModes);
  }, [columns, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Convert form data to proper types
      const data: Record<string, unknown> = {};

      columns.forEach((col) => {
        const value = formData[col.name];
        const mode = valueMode[col.name] ?? "value";

        // Skip generated columns and identity-always columns
        if ((col.generated_kind ?? "") !== "" || col.identity_kind === "a") {
          return;
        }

        if (mode === "default") {
          return;
        }
        if (mode === "null") {
          data[col.name] = null;
          return;
        }
        if (mode === "empty") {
          data[col.name] = "";
          return;
        }

        // Skip primary key if it's auto-increment
        if (col.is_primary_key && !value) {
          return;
        }

        // Handle empty values based on nullable
        if (!value) {
          if (col.is_nullable) {
            data[col.name] = null;
          } else if (col.default_value) {
            // Use default value
            return;
          } else {
            // Required field
            throw new Error(`${col.name} is required`);
          }
          return;
        }

        data[col.name] = parseInputValue(col, value);
      });

      // Generate INSERT SQL for tracking
      const columns_list = Object.keys(data).join(", ");
      const values_list = Object.values(data)
        .map((v) => {
          if (v === null) return "NULL";
          if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
          return v;
        })
        .join(", ");
      const insertSql = `INSERT INTO ${tableRef} (${columns_list}) VALUES (${values_list})`;

      const result = await invoke<string>("insert_row", {
        connectionId: connection.id,
        tableName: tableRef,
        data,
        dbType: connection.db_type,
      });

      // Add to undo/redo history if callback provided
      if (tableKey && onAddAction) {
        onAddAction(tableKey, {
          id: `insert-${Date.now()}`,
          type: "insert",
          timestamp: new Date(),
          tableName: tableRef,
          connectionId: connection.id,
          dbType: connection.db_type,
          data: {
            rows: [data],
          },
          undoSql: `-- Insert undo requires knowing the new primary key after insertion`,
          redoSql: insertSql,
        });
      }

      toast.success(result);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(`Failed to insert row: ${error}`);
      console.error("Insert error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (columnName: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [columnName]: value,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg">Add New Row</DialogTitle>
          <DialogDescription className="text-xs">
            Insert a new row into{" "}
            <span className="font-mono text-foreground">{table.name}</span>
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <ScrollArea className="flex-1 overflow-y-auto pr-4">
            <div className="grid gap-4 py-4 mx-2">
              {columns.map((column) => (
                <div key={column.name} className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={column.name}
                      className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                    >
                      {column.name}
                      {!column.is_nullable &&
                        !column.is_primary_key &&
                        (column.generated_kind ?? "") === "" &&
                        column.identity_kind !== "a" && (
                        <span className="ml-1 text-destructive">*</span>
                      )}
                    </label>
                    {column.is_primary_key && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary font-mono">
                        PK
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-secondary border border-border font-mono">
                      {column.data_type}
                    </span>
                    {column.identity_kind === "a" && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/10 text-amber-600 font-mono">
                        IDENTITY ALWAYS
                      </span>
                    )}
                    {column.identity_kind === "d" && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/10 text-amber-600 font-mono">
                        IDENTITY BY DEFAULT
                      </span>
                    )}
                    {(column.generated_kind ?? "") !== "" && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-500/10 text-blue-600 font-mono">
                        GENERATED
                      </span>
                    )}
                  </div>
                  {(column.is_nullable || column.default_value) && (
                    <div className="space-y-1 -mt-1">
                      <div className="text-[10px] text-muted-foreground">
                        {column.is_nullable && "Optional"}
                        {column.is_nullable && column.default_value && " • "}
                        {column.default_value &&
                          `Default: ${column.default_value}`}
                      </div>
                      <Select
                        value={valueMode[column.name] ?? "value"}
                        onValueChange={(val) =>
                          setValueMode((prev) => ({
                            ...prev,
                            [column.name]: val as "value" | "null" | "default" | "empty",
                          }))
                        }
                      >
                        <SelectTrigger className="h-7 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="value">Set Value</SelectItem>
                          {column.is_nullable && <SelectItem value="null">Set NULL</SelectItem>}
                          {column.default_value && <SelectItem value="default">Use DEFAULT</SelectItem>}
                          <SelectItem value="empty">Set Empty String</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="text-[10px] text-muted-foreground">
                        Choose how to write this field: value, SQL NULL, SQL DEFAULT, or empty string.
                      </div>
                    </div>
                  )}
                  {(valueMode[column.name] ?? "value") !== "value" ? null : column.type_family === "boolean" ? (
                    <div className="flex items-center gap-2 rounded-md border border-input px-3 py-2">
                      <input
                        id={column.name}
                        type="checkbox"
                        checked={formData[column.name] === "true"}
                        onChange={(e) =>
                          handleInputChange(
                            column.name,
                            e.target.checked ? "true" : "false",
                          )
                        }
                        className="h-4 w-4"
                      />
                      <span className="text-xs text-muted-foreground">
                        {formData[column.name] === "true" ? "true" : "false"}
                      </span>
                    </div>
                  ) : column.type_family === "json" ? (
                    <textarea
                      id={column.name}
                      value={formData[column.name] || ""}
                      onChange={(e) =>
                        handleInputChange(column.name, e.target.value)
                      }
                      placeholder={
                        column.is_nullable ? "NULL (optional)" : "Valid JSON"
                      }
                      className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                    />
                  ) : (
                    <Input
                      id={column.name}
                      type={resolveColumnInputType(column)}
                      value={formData[column.name] || ""}
                      onChange={(e) =>
                        handleInputChange(column.name, e.target.value)
                      }
                      placeholder={
                        column.is_primary_key
                          ? "Auto-generated (leave empty)"
                          : column.is_nullable
                          ? "NULL (optional)"
                          : "Required"
                      }
                      disabled={
                        (column.generated_kind ?? "") !== "" ||
                        column.identity_kind === "a" ||
                        (column.is_primary_key &&
                          (column.data_type.toUpperCase().includes("SERIAL") ||
                            column.default_value?.toLowerCase().includes("identity")))
                      }
                      className="h-9 text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="h-9">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Inserting...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5 mr-2" />
                  Insert Row
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
