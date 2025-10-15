import { useState } from 'react';
import { Trash2, Edit, Download, Copy, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TableColumn } from '@/types';

interface BatchOperationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRowCount: number;
  columns: TableColumn[];
  onBatchDelete: () => Promise<void>;
  onBatchUpdate: (columnName: string, value: string) => Promise<void>;
  onBatchExport: () => void;
  onBatchDuplicate: () => Promise<void>;
}

type OperationType = 'delete' | 'update' | 'export' | 'duplicate';

export function BatchOperationsDialog({
  open,
  onOpenChange,
  selectedRowCount,
  columns,
  onBatchDelete,
  onBatchUpdate,
  onBatchExport,
  onBatchDuplicate,
}: BatchOperationsDialogProps) {
  const [operationType, setOperationType] = useState<OperationType>('delete');
  const [updateColumn, setUpdateColumn] = useState<string>('');
  const [updateValue, setUpdateValue] = useState('');
  const [setToNull, setSetToNull] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleExecute = async () => {
    setIsProcessing(true);
    try {
      switch (operationType) {
        case 'delete':
          await onBatchDelete();
          break;
        case 'update':
          if (updateColumn) {
            const value = setToNull ? 'NULL' : updateValue;
            await onBatchUpdate(updateColumn, value);
          }
          break;
        case 'export':
          onBatchExport();
          break;
        case 'duplicate':
          await onBatchDuplicate();
          break;
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Batch operation failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const isExecuteDisabled = () => {
    if (isProcessing) return true;
    if (operationType === 'update' && !updateColumn) return true;
    if (operationType === 'update' && !setToNull && !updateValue) return true;
    return false;
  };

  const getOperationIcon = (type: OperationType) => {
    switch (type) {
      case 'delete':
        return <Trash2 className="h-4 w-4" />;
      case 'update':
        return <Edit className="h-4 w-4" />;
      case 'export':
        return <Download className="h-4 w-4" />;
      case 'duplicate':
        return <Copy className="h-4 w-4" />;
    }
  };

  const getOperationDescription = (type: OperationType) => {
    switch (type) {
      case 'delete':
        return 'Permanently delete all selected rows from the table.';
      case 'update':
        return 'Update a specific column value for all selected rows.';
      case 'export':
        return 'Export selected rows to various formats (CSV, JSON, Excel, etc.).';
      case 'duplicate':
        return 'Create copies of all selected rows (may fail if there are unique constraints).';
    }
  };

  const isDangerousOperation = operationType === 'delete';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Batch Operations
            <Badge variant="secondary">{selectedRowCount} rows selected</Badge>
          </DialogTitle>
          <DialogDescription>
            Perform operations on multiple rows at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Operation Type Selection */}
          <div className="space-y-3">
            <Label>Select Operation</Label>
            <div className="grid grid-cols-2 gap-3">
              {(['delete', 'update', 'export', 'duplicate'] as OperationType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setOperationType(type)}
                  className={`
                    flex items-center gap-3 p-4 rounded-lg border-2 transition-all
                    ${
                      operationType === type
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }
                  `}
                >
                  <div
                    className={`
                    p-2 rounded-md
                    ${
                      operationType === type
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }
                  `}
                  >
                    {getOperationIcon(type)}
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-sm capitalize">{type}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {getOperationDescription(type).split('.')[0]}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Operation-specific Configuration */}
          <div className="space-y-4">
            {operationType === 'update' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="column-select">Column to Update</Label>
                  <Select value={updateColumn} onValueChange={setUpdateColumn}>
                    <SelectTrigger id="column-select">
                      <SelectValue placeholder="Select a column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <ScrollArea className="h-64">
                        {columns
                          .filter((col) => !col.is_primary_key)
                          .map((col) => (
                            <SelectItem key={col.name} value={col.name}>
                              <div className="flex items-center gap-2">
                                <span>{col.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {col.data_type}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-value">New Value</Label>
                  <Input
                    id="new-value"
                    value={updateValue}
                    onChange={(e) => setUpdateValue(e.target.value)}
                    placeholder="Enter new value..."
                    disabled={setToNull}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="set-null"
                    checked={setToNull}
                    onCheckedChange={(checked) => setSetToNull(checked === true)}
                  />
                  <Label
                    htmlFor="set-null"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Set to NULL
                  </Label>
                </div>
              </>
            )}

            {operationType === 'delete' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This action cannot be undone. {selectedRowCount} row
                  {selectedRowCount !== 1 ? 's' : ''} will be permanently deleted.
                </AlertDescription>
              </Alert>
            )}

            {operationType === 'export' && (
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm text-muted-foreground">
                  The export dialog will open with only the selected rows. You can choose
                  from multiple formats including CSV, JSON, SQL, Excel, Markdown, and HTML.
                </p>
              </div>
            )}

            {operationType === 'duplicate' && (
              <Alert>
                <AlertDescription>
                  {selectedRowCount} row{selectedRowCount !== 1 ? 's' : ''} will be duplicated.
                  Primary keys and auto-increment columns will be automatically generated.
                  This operation may fail if there are unique constraints.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExecute}
            disabled={isExecuteDisabled()}
            variant={isDangerousOperation ? 'destructive' : 'default'}
          >
            {isProcessing ? (
              <>Processing...</>
            ) : (
              <>
                {getOperationIcon(operationType)}
                <span className="ml-2">
                  Execute {operationType.charAt(0).toUpperCase() + operationType.slice(1)}
                </span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
