import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConnectionConfig, TableColumn, DatabaseTable } from '@/types';
import { toast } from 'sonner';
import { TableAction } from '@/stores/undoRedoStore';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Initialize form with empty values or defaults
    const initialData: Record<string, string> = {};
    columns.forEach((col) => {
      if (col.default_value) {
        initialData[col.name] = col.default_value;
      } else {
        initialData[col.name] = '';
      }
    });
    setFormData(initialData);
  }, [columns, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Convert form data to proper types
      const data: Record<string, unknown> = {};
      
      columns.forEach((col) => {
        const value = formData[col.name];
        
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

        // Type conversion based on data type
        const dataType = col.data_type.toUpperCase();
        if (dataType.includes('INT') || dataType.includes('SERIAL')) {
          data[col.name] = parseInt(value);
        } else if (dataType.includes('FLOAT') || dataType.includes('REAL') || dataType.includes('DOUBLE') || dataType.includes('NUMERIC')) {
          data[col.name] = parseFloat(value);
        } else if (dataType.includes('BOOL')) {
          data[col.name] = value.toLowerCase() === 'true' || value === '1';
        } else {
          data[col.name] = value;
        }
      });

      // Generate INSERT SQL for tracking
      const columns_list = Object.keys(data).join(', ');
      const values_list = Object.values(data).map(v => {
        if (v === null) return 'NULL';
        if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
        return v;
      }).join(', ');
      const insertSql = `INSERT INTO ${table.name} (${columns_list}) VALUES (${values_list})`;

      const result = await invoke<string>('insert_row', {
        connectionId: connection.id,
        tableName: table.name,
        data,
        dbType: connection.db_type,
      });

      // Add to undo/redo history if callback provided
      if (tableKey && onAddAction) {
        onAddAction(tableKey, {
          id: `insert-${Date.now()}`,
          type: 'insert',
          timestamp: new Date(),
          tableName: table.name,
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
      console.error('Insert error:', error);
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

  const getInputType = (dataType: string): string => {
    const type = dataType.toUpperCase();
    if (type.includes('INT') || type.includes('SERIAL')) return 'number';
    if (type.includes('FLOAT') || type.includes('REAL') || type.includes('DOUBLE') || type.includes('NUMERIC')) return 'number';
    if (type.includes('BOOL')) return 'checkbox';
    if (type.includes('DATE') || type.includes('TIME')) return 'datetime-local';
    return 'text';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg">Add New Row</DialogTitle>
          <DialogDescription className="text-xs">
            Insert a new row into <span className="font-mono text-foreground">{table.name}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <ScrollArea className="flex-1 overflow-y-auto pr-4">
            <div className="grid gap-4 py-4">
              {columns.map((column) => (
                <div key={column.name} className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <label htmlFor={column.name} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {column.name}
                      {!column.is_nullable && !column.is_primary_key && (
                        <span className="ml-1 text-destructive">*</span>
                      )}
                    </label>
                    {column.is_primary_key && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary font-mono">PK</span>
                    )}
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-secondary border border-border font-mono">
                      {column.data_type}
                    </span>
                  </div>
                  {(column.is_nullable || column.default_value) && (
                    <div className="text-[10px] text-muted-foreground -mt-1">
                      {column.is_nullable && 'Optional'}
                      {column.is_nullable && column.default_value && ' • '}
                      {column.default_value && `Default: ${column.default_value}`}
                    </div>
                  )}
                  <Input
                    id={column.name}
                    type={getInputType(column.data_type)}
                    value={formData[column.name] || ''}
                    onChange={(e) => handleInputChange(column.name, e.target.value)}
                    placeholder={
                      column.is_primary_key
                        ? 'Auto-generated (leave empty)'
                        : column.is_nullable
                        ? 'NULL (optional)'
                        : 'Required'
                    }
                    disabled={column.is_primary_key && column.data_type.toUpperCase().includes('SERIAL')}
                    className="h-9 text-sm"
                  />
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-9">
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
