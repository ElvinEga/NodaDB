import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Sparkles, Loader2, RefreshCw, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConnectionConfig, TableColumn, DatabaseTable } from '@/types';
import { toast } from 'sonner';
import {
  FakerMethod,
  getAllFakerMethods,
  autoDetectFakerMethod,
  generateRows,
  FAKER_METHODS,
} from '@/lib/fakerMappings';

interface DataGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionConfig;
  table: DatabaseTable;
  columns: TableColumn[];
  onSuccess: () => void;
}

export function DataGeneratorDialog({
  open,
  onOpenChange,
  connection,
  table,
  columns,
  onSuccess,
}: DataGeneratorDialogProps) {
  const [rowCount, setRowCount] = useState<number>(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [fakerMethods, setFakerMethods] = useState<Map<string, FakerMethod>>(new Map());
  const [previewData, setPreviewData] = useState<Record<string, any>[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const allFakerMethods = useMemo(() => getAllFakerMethods(), []);
  const fakerMethodsByCategory = useMemo(() => FAKER_METHODS, []);

  // Auto-detect faker methods when dialog opens
  useEffect(() => {
    if (open && columns.length > 0) {
      const detectedMethods = new Map<string, FakerMethod>();
      columns.forEach((column) => {
        const method = autoDetectFakerMethod(column);
        detectedMethods.set(column.name, method);
      });
      setFakerMethods(detectedMethods);
      setShowPreview(false);
      setPreviewData([]);
    }
  }, [open, columns]);

  // Filter out auto-increment primary key columns
  const editableColumns = useMemo(() => {
    return columns.filter(
      (col) =>
        !col.is_primary_key ||
        !(
          col.data_type.toLowerCase().includes('serial') ||
          col.default_value?.toLowerCase().includes('autoincrement') ||
          col.default_value?.toLowerCase().includes('identity')
        )
    );
  }, [columns]);

  const handleMethodChange = (columnName: string, methodKey: string) => {
    const method = allFakerMethods.find(
      (m) => `${m.category}.${m.method}` === methodKey
    );
    if (method) {
      setFakerMethods(new Map(fakerMethods.set(columnName, method)));
      setShowPreview(false); // Reset preview when changing methods
    }
  };

  const handlePreview = () => {
    try {
      const preview = generateRows(editableColumns, fakerMethods, Math.min(5, rowCount));
      setPreviewData(preview);
      setShowPreview(true);
      toast.success('Preview generated');
    } catch (error) {
      toast.error(`Failed to generate preview: ${error}`);
      console.error('Preview error:', error);
    }
  };

  const handleGenerate = async () => {
    if (rowCount <= 0 || rowCount > 10000) {
      toast.error('Row count must be between 1 and 10,000');
      return;
    }

    setIsGenerating(true);

    try {
      // Generate all rows
      const rows = generateRows(editableColumns, fakerMethods, rowCount);

      // Batch insert in chunks of 1000 for better performance
      const chunkSize = 1000;
      let totalInserted = 0;

      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);

        await invoke('bulk_insert_rows', {
          connectionId: connection.id,
          tableName: table.name,
          rows: chunk,
          dbType: connection.db_type,
        });

        totalInserted += chunk.length;

        // Show progress for large datasets
        if (rows.length > chunkSize) {
          toast.info(`Inserted ${totalInserted} / ${rows.length} rows...`);
        }
      }

      toast.success(`Successfully generated ${rowCount} row(s)`);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(`Failed to generate data: ${error}`);
      console.error('Generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAutoDetectAll = () => {
    const detectedMethods = new Map<string, FakerMethod>();
    columns.forEach((column) => {
      const method = autoDetectFakerMethod(column);
      detectedMethods.set(column.name, method);
    });
    setFakerMethods(detectedMethods);
    setShowPreview(false);
    toast.success('Auto-detected faker methods for all columns');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Generate Test Data
          </DialogTitle>
          <DialogDescription>
            Generate realistic test data for {table.name} using Faker.js
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Row Count Input */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30 border border-border">
            <div className="flex-1 space-y-2">
              <Label htmlFor="rowCount">Number of Rows</Label>
              <Input
                id="rowCount"
                type="number"
                min="1"
                max="10000"
                value={rowCount}
                onChange={(e) => setRowCount(parseInt(e.target.value) || 1)}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Maximum: 10,000 rows
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoDetectAll}
                className="gap-2"
              >
                <Wand2 className="h-4 w-4" />
                Auto-Detect All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePreview}
                disabled={isGenerating}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Preview
              </Button>
            </div>
          </div>

          {/* Column Mapping */}
          <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
            <Label>Column Data Types</Label>
            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-4 space-y-3">
                {editableColumns.map((column) => {
                  const selectedMethod = fakerMethods.get(column.name);
                  const methodKey = selectedMethod
                    ? `${selectedMethod.category}.${selectedMethod.method}`
                    : '';

                  return (
                    <div
                      key={column.name}
                      className="flex items-center gap-3 p-2 rounded bg-secondary/20"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {column.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {column.data_type}
                          {!column.is_nullable && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </div>
                      </div>
                      <Select
                        value={methodKey}
                        onValueChange={(value) =>
                          handleMethodChange(column.name, value)
                        }
                      >
                        <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="Select data type" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(fakerMethodsByCategory).map(
                            ([category, methods]) => (
                              <div key={category}>
                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                                  {category}
                                </div>
                                {methods.map((method) => (
                                  <SelectItem
                                    key={`${method.category}.${method.method}`}
                                    value={`${method.category}.${method.method}`}
                                  >
                                    {method.displayName}
                                  </SelectItem>
                                ))}
                              </div>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Preview Table */}
          {showPreview && previewData.length > 0 && (
            <div className="space-y-2">
              <Label>Preview (First 5 Rows)</Label>
              <ScrollArea className="h-[200px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {editableColumns.map((col) => (
                        <TableHead key={col.name} className="whitespace-nowrap">
                          {col.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, idx) => (
                      <TableRow key={idx}>
                        {editableColumns.map((col) => (
                          <TableCell
                            key={col.name}
                            className="font-mono text-xs max-w-[200px] truncate"
                          >
                            {row[col.name] === null
                              ? 'NULL'
                              : String(row[col.name])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate {rowCount} Row{rowCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
