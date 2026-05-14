import { useState, useEffect } from 'react';
import { Edit2, Loader2 } from 'lucide-react';
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
import { TableColumn } from '@/types';
import { resolveColumnInputType } from '@/lib/db-types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EditCellDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnName: string;
  columnType: string;
  column: TableColumn;
  currentValue: any;
  onSave: (newValue: string) => Promise<void>;
}

export function EditCellDialog({
  open,
  onOpenChange,
  columnName,
  columnType,
  column,
  currentValue,
  onSave,
}: EditCellDialogProps) {
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBoolean = column.type_family === 'boolean';
  const isReadOnlyGenerated = (column.generated_kind ?? '') !== '';

  useEffect(() => {
    if (open) {
      if (isBoolean) {
        if (currentValue === true || currentValue === 1 || currentValue === '1' || currentValue === 'true' || currentValue === 't') {
          setValue('true');
        } else if (currentValue === false || currentValue === 0 || currentValue === '0' || currentValue === 'false' || currentValue === 'f') {
          setValue('false');
        } else {
          setValue(''); // Default/Null
        }
      } else {
        const displayValue = currentValue === null || currentValue === undefined ? '' : String(currentValue);
        setValue(displayValue);
      }
    }
  }, [open, currentValue, isBoolean]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnlyGenerated) {
      return;
    }
    setIsSubmitting(true);

    try {
      await onSave(value);
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in parent component
      console.error('Save error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputType = (): string => {
    return resolveColumnInputType(column);
  };

  const getPlaceholder = (): string => {
    switch (column.type_family) {
      case 'integer':
        return 'Enter integer value';
      case 'float':
      case 'decimal':
        return 'Enter decimal number';
      case 'boolean':
        return 'true/false';
      case 'date':
        return 'Select date';
      case 'date_time':
        return 'Select date and time';
      case 'time':
        return 'Select time';
      case 'json':
        return '{"key":"value"}';
      default:
        return 'Enter value or leave empty for NULL';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="h-4 w-4 text-primary" />
            Edit Cell Value
          </DialogTitle>
          <DialogDescription>
            Editing column: <span className="font-mono font-semibold text-foreground">{columnName}</span>
            {' '}
            <span className="text-xs text-muted-foreground">({columnType})</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="cell-value" className="text-sm font-medium">
                New Value
              </label>
              {isReadOnlyGenerated ? (
                <Input
                  id="cell-value"
                  value={value}
                  disabled
                  className="h-9"
                />
              ) : isBoolean ? (
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select boolean value" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
              ) : column.type_family === 'enum' && (column.enum_values?.length ?? 0) > 0 ? (
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select enum value" />
                  </SelectTrigger>
                  <SelectContent>
                    {column.enum_values?.map((enumValue) => (
                      <SelectItem key={enumValue} value={enumValue}>
                        {enumValue}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : column.type_family === 'json' ? (
                <textarea
                  id="cell-value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={getPlaceholder()}
                  autoFocus
                  className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                />
              ) : (
                <Input
                  id="cell-value"
                  type={getInputType()}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={getPlaceholder()}
                  autoFocus
                  className="h-9"
                />
              )}
              <p className="text-xs text-muted-foreground">
                {isReadOnlyGenerated
                  ? 'Generated columns are read-only'
                  : 'Leave empty to set as NULL'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isReadOnlyGenerated}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
