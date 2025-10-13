import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
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

interface AddRowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionConfig;
  table: DatabaseTable;
  columns: TableColumn[];
  onSuccess: () => void;
}

export function AddRowDialog({
  open,
  onOpenChange,
  connection,
  table,
  columns,
  onSuccess,
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

      const result = await invoke<string>('insert_row', {
        connectionId: connection.id,
        tableName: table.name,
        data,
        dbType: connection.db_type,
      });

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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add New Row</DialogTitle>
          <DialogDescription>
            Insert a new row into <span className="font-semibold">{table.name}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="grid gap-4 py-4">
              {columns.map((column) => (
                <div key={column.name} className="grid gap-2">
                  <label htmlFor={column.name} className="text-sm font-medium">
                    {column.name}
                    {column.is_primary_key && (
                      <span className="ml-2 text-xs text-primary">PK</span>
                    )}
                    {!column.is_nullable && !column.is_primary_key && (
                      <span className="ml-2 text-xs text-destructive">*</span>
                    )}
                  </label>
                  <div className="text-xs text-muted-foreground mb-1">
                    {column.data_type}
                    {column.is_nullable && ' • Nullable'}
                    {column.default_value && ` • Default: ${column.default_value}`}
                  </div>
                  <Input
                    id={column.name}
                    type={getInputType(column.data_type)}
                    value={formData[column.name] || ''}
                    onChange={(e) => handleInputChange(column.name, e.target.value)}
                    placeholder={
                      column.is_primary_key
                        ? 'Auto-generated (leave empty)'
                        : column.is_nullable
                        ? 'NULL (leave empty)'
                        : 'Required'
                    }
                    disabled={column.is_primary_key && column.data_type.toUpperCase().includes('SERIAL')}
                  />
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Inserting...' : 'Insert Row'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
