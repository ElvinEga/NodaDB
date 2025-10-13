import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { ConnectionConfig } from '@/types';
import { toast } from 'sonner';

interface CreateTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionConfig;
  onSuccess: () => void;
}

interface Column {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
}

const DATA_TYPES = {
  sqlite: [
    'INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC',
    'VARCHAR(255)', 'BOOLEAN', 'DATE', 'DATETIME'
  ],
  postgresql: [
    'INTEGER', 'BIGINT', 'SERIAL', 'BIGSERIAL',
    'VARCHAR(255)', 'TEXT', 'BOOLEAN',
    'REAL', 'DOUBLE PRECISION', 'NUMERIC',
    'DATE', 'TIMESTAMP', 'TIMESTAMPTZ',
    'JSON', 'JSONB', 'UUID'
  ],
  mysql: [
    'INT', 'BIGINT', 'AUTO_INCREMENT',
    'VARCHAR(255)', 'TEXT', 'LONGTEXT',
    'BOOLEAN', 'TINYINT(1)',
    'FLOAT', 'DOUBLE', 'DECIMAL',
    'DATE', 'DATETIME', 'TIMESTAMP',
    'JSON'
  ]
};

export function CreateTableDialog({
  open,
  onOpenChange,
  connection,
  onSuccess,
}: CreateTableDialogProps) {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<Column[]>([
    { id: '1', name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
  ]);
  const [isCreating, setIsCreating] = useState(false);

  const dataTypes = DATA_TYPES[connection.db_type] || DATA_TYPES.sqlite;

  const addColumn = () => {
    const newColumn: Column = {
      id: Date.now().toString(),
      name: `column_${columns.length + 1}`,
      type: dataTypes[0],
      nullable: true,
      primaryKey: false,
    };
    setColumns([...columns, newColumn]);
  };

  const removeColumn = (id: string) => {
    if (columns.length === 1) {
      toast.error('Table must have at least one column');
      return;
    }
    setColumns(columns.filter((col) => col.id !== id));
  };

  const updateColumn = (id: string, updates: Partial<Column>) => {
    setColumns(
      columns.map((col) =>
        col.id === id ? { ...col, ...updates } : col
      )
    );
  };

  const handleCreate = async () => {
    if (!tableName.trim()) {
      toast.error('Please enter a table name');
      return;
    }

    if (columns.length === 0) {
      toast.error('Table must have at least one column');
      return;
    }

    // Validate column names
    const names = columns.map((c) => c.name.trim());
    if (names.some((n) => !n)) {
      toast.error('All columns must have names');
      return;
    }

    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    if (duplicates.length > 0) {
      toast.error(`Duplicate column names: ${duplicates.join(', ')}`);
      return;
    }

    setIsCreating(true);

    try {
      // Format: Vec<(name, type, nullable, primary_key)>
      const columnDefs: [string, string, boolean, boolean][] = columns.map((col) => [
        col.name.trim(),
        col.type,
        col.nullable,
        col.primaryKey,
      ]);

      const result = await invoke<string>('create_table', {
        connectionId: connection.id,
        tableName: tableName.trim(),
        columns: columnDefs,
        dbType: connection.db_type,
      });

      toast.success(result);
      onSuccess();
      onOpenChange(false);

      // Reset form
      setTableName('');
      setColumns([
        { id: '1', name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
      ]);
    } catch (error) {
      toast.error(`Failed to create table: ${error}`);
      console.error('Create table error:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Table</DialogTitle>
          <DialogDescription>
            Design your table structure for {connection.name}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto pr-4">
          <div className="grid gap-4 py-4">
          {/* Table Name */}
          <div className="grid gap-2">
            <label htmlFor="tableName" className="text-sm font-medium">
              Table Name
            </label>
            <Input
              id="tableName"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g., users, products, orders"
            />
          </div>

          {/* Columns */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Columns</label>
              <Button type="button" size="sm" variant="outline" onClick={addColumn}>
                <Plus className="h-4 w-4 mr-2" />
                Add Column
              </Button>
            </div>

            <div className="max-h-[350px] overflow-y-auto pr-2">
              <div className="space-y-3">
                {columns.map((column) => (
                  <div
                    key={column.id}
                    className="grid grid-cols-12 gap-2 items-start p-3 border border-border rounded-lg bg-secondary/30"
                  >
                    {/* Column Name */}
                    <div className="col-span-3">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Name</label>
                      <Input
                        value={column.name}
                        onChange={(e) =>
                          updateColumn(column.id, { name: e.target.value })
                        }
                        placeholder="column_name"
                        className="mt-1 h-9 text-sm font-mono"
                      />
                    </div>

                    {/* Data Type */}
                    <div className="col-span-3">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Type</label>
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
                          {dataTypes.map((type) => (
                            <SelectItem key={type} value={type} className="text-xs font-mono">
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
                        id={`nullable-${column.id}`}
                        checked={column.nullable}
                        onChange={(e) =>
                          updateColumn(column.id, { nullable: e.target.checked })
                        }
                        className="cursor-pointer accent-primary"
                      />
                      <label
                        htmlFor={`nullable-${column.id}`}
                        className="text-xs cursor-pointer"
                      >
                        Nullable
                      </label>
                    </div>

                    {/* Primary Key */}
                    <div className="col-span-2 flex items-center gap-2 mt-6">
                      <input
                        type="checkbox"
                        id={`pk-${column.id}`}
                        checked={column.primaryKey}
                        onChange={(e) => {
                          const isPK = e.target.checked;
                          setColumns(
                            columns.map((col) =>
                              col.id === column.id
                                ? { ...col, primaryKey: isPK, nullable: !isPK }
                                : col
                            )
                          );
                        }}
                        className="cursor-pointer accent-primary"
                      />
                      <label
                        htmlFor={`pk-${column.id}`}
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Table'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
