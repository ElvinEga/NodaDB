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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableColumn, ConnectionConfig, DatabaseTable } from '@/types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionConfig;
  table: DatabaseTable;
  selectedCells: Array<{
    rowIndex: number;
    columnName: string;
    currentValue: any;
    primaryKeyValue: any;
  }>;
  columns: TableColumn[];
  onSuccess: () => void;
}

type BulkEditMode = 'replace' | 'append' | 'prepend' | 'math' | 'set_null';

export function BulkEditDialog({
  open,
  onOpenChange,
  connection,
  table,
  selectedCells,
  columns,
  onSuccess,
}: BulkEditDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<BulkEditMode>('replace');
  const [value, setValue] = useState('');

  // Group cells by column
  const cellsByColumn = selectedCells.reduce((acc, cell) => {
    if (!acc[cell.columnName]) {
      acc[cell.columnName] = [];
    }
    acc[cell.columnName].push(cell);
    return acc;
  }, {} as Record<string, typeof selectedCells>);

  const affectedColumns = Object.keys(cellsByColumn);
  const primaryKeyColumn = columns.find(c => c.is_primary_key);

  const handleBulkEdit = async () => {
    if (!primaryKeyColumn) {
      toast.error('No primary key found - cannot perform bulk edit');
      return;
    }

    if (mode !== 'set_null' && !value.trim()) {
      toast.error('Please enter a value');
      return;
    }

    setIsProcessing(true);

    try {
      let successCount = 0;
      let errorCount = 0;

      // Process each cell
      for (const cell of selectedCells) {
        try {
          let newValue: any;

          switch (mode) {
            case 'replace':
              newValue = value;
              break;
            case 'append':
              newValue = `${cell.currentValue || ''}${value}`;
              break;
            case 'prepend':
              newValue = `${value}${cell.currentValue || ''}`;
              break;
            case 'math':
              // Simple math operations on numbers
              if (typeof cell.currentValue === 'number') {
                const operation = value.trim();
                if (operation.startsWith('+')) {
                  newValue = cell.currentValue + parseFloat(operation.substring(1));
                } else if (operation.startsWith('-')) {
                  newValue = cell.currentValue - parseFloat(operation.substring(1));
                } else if (operation.startsWith('*')) {
                  newValue = cell.currentValue * parseFloat(operation.substring(1));
                } else if (operation.startsWith('/')) {
                  newValue = cell.currentValue / parseFloat(operation.substring(1));
                } else {
                  newValue = parseFloat(value);
                }
              } else {
                throw new Error('Math operations only work on numeric columns');
              }
              break;
            case 'set_null':
              newValue = null;
              break;
            default:
              newValue = value;
          }

          const whereClause =
            typeof cell.primaryKeyValue === 'string'
              ? `${primaryKeyColumn.name} = '${cell.primaryKeyValue}'`
              : `${primaryKeyColumn.name} = ${cell.primaryKeyValue}`;

          const updateData: Record<string, unknown> = {
            [cell.columnName]: newValue,
          };

          await invoke<string>('update_row', {
            connectionId: connection.id,
            tableName: table.name,
            data: updateData,
            whereClause,
            dbType: connection.db_type,
          });

          successCount++;
        } catch (error) {
          console.error('Error updating cell:', error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully updated ${successCount} cell(s)`);
        onSuccess();
        onOpenChange(false);
      }

      if (errorCount > 0) {
        toast.error(`Failed to update ${errorCount} cell(s)`);
      }
    } catch (error) {
      toast.error(`Bulk edit failed: ${error}`);
      console.error('Bulk edit error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getModeDescription = () => {
    switch (mode) {
      case 'replace':
        return 'Replace all selected cells with the new value';
      case 'append':
        return 'Add the value to the end of each cell';
      case 'prepend':
        return 'Add the value to the beginning of each cell';
      case 'math':
        return 'Perform math operation (e.g., +10, -5, *2, /2) on numeric cells';
      case 'set_null':
        return 'Set all selected cells to NULL';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bulk Edit Cells</DialogTitle>
          <DialogDescription>
            Edit {selectedCells.length} selected cell(s) across {affectedColumns.length} column(s)
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Affected Columns</Label>
            <div className="flex flex-wrap gap-2">
              {affectedColumns.map(col => (
                <span
                  key={col}
                  className="px-2 py-1 rounded text-xs bg-secondary border border-border"
                >
                  {col} ({cellsByColumn[col].length} cells)
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="mode">Edit Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as BulkEditMode)}>
              <SelectTrigger id="mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="replace">Replace</SelectItem>
                <SelectItem value="append">Append</SelectItem>
                <SelectItem value="prepend">Prepend</SelectItem>
                <SelectItem value="math">Math Operation</SelectItem>
                <SelectItem value="set_null">Set NULL</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{getModeDescription()}</p>
          </div>

          {mode !== 'set_null' && (
            <div className="grid gap-2">
              <Label htmlFor="value">
                {mode === 'math' ? 'Operation (e.g., +10, -5, *2, /2)' : 'Value'}
              </Label>
              <Input
                id="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={
                  mode === 'math'
                    ? 'e.g., +10 or *2'
                    : mode === 'append'
                    ? 'Text to append'
                    : mode === 'prepend'
                    ? 'Text to prepend'
                    : 'New value'
                }
                autoFocus
              />
            </div>
          )}

          <div className="rounded-md bg-muted/50 border border-border p-3">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Warning:</strong> This operation cannot be undone.
              {selectedCells.length} cell(s) will be modified.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button onClick={handleBulkEdit} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `Update ${selectedCells.length} Cell(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
