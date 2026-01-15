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
  currentValue: any;
  onSave: (newValue: string) => Promise<void>;
}

export function EditCellDialog({
  open,
  onOpenChange,
  columnName,
  columnType,
  currentValue,
  onSave,
}: EditCellDialogProps) {
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBoolean = columnType.toUpperCase().includes('BOOL') || columnType.toUpperCase() === 'BIT';

  useEffect(() => {
    if (open) {
      if (isBoolean) {
        // Normalize boolean values to '1' or '0'
        if (currentValue === true || currentValue === 1 || currentValue === '1' || currentValue === 'true' || currentValue === 't') {
          setValue('1');
        } else if (currentValue === false || currentValue === 0 || currentValue === '0' || currentValue === 'false' || currentValue === 'f') {
          setValue('0');
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
    const type = columnType.toUpperCase();
    if (type.includes('INT') || type.includes('SERIAL')) return 'number';
    if (type.includes('FLOAT') || type.includes('REAL') || type.includes('DOUBLE') || type.includes('NUMERIC')) return 'number';
    if (type.includes('BOOL')) return 'text';
    if (type.includes('DATE') && !type.includes('TIME')) return 'date';
    if (type.includes('DATETIME') || type.includes('TIMESTAMP')) return 'datetime-local';
    if (type.includes('TIME') && !type.includes('DATE')) return 'time';
    return 'text';
  };

  const getPlaceholder = (): string => {
    const type = columnType.toUpperCase();
    if (type.includes('INT')) return 'Enter integer value';
    if (type.includes('FLOAT') || type.includes('REAL') || type.includes('DOUBLE') || type.includes('NUMERIC')) return 'Enter decimal number';
    if (type.includes('BOOL')) return 'true/false or 1/0';
    if (type.includes('DATE')) return 'Select date';
    if (type.includes('TIME')) return 'Select time';
    return 'Enter value or leave empty for NULL';
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
              {isBoolean ? (
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select boolean value" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">True</SelectItem>
                    <SelectItem value="0">False</SelectItem>
                  </SelectContent>
                </Select>
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
                Leave empty to set as NULL
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
            <Button type="submit" disabled={isSubmitting}>
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
