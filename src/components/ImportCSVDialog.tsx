import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Loader2, Upload, FileSpreadsheet, CheckCircle, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConnectionConfig, DatabaseTable, TableColumn } from '@/types';
import { toast } from 'sonner';
import {
  parseCSV,
  createDefaultMappings,
  prepareRowsForInsert,
  validateCSVData,
  ColumnMapping,
} from '@/lib/csvParser';

interface ImportCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionConfig;
  table: DatabaseTable;
  columns: TableColumn[];
  onSuccess: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

export function ImportCSVDialog({
  open,
  onOpenChange,
  connection,
  table,
  columns,
  onSuccess,
}: ImportCSVDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [csvData, setCSVData] = useState<{ headers: string[]; rows: string[][]; rowCount: number } | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = parseCSV(content);
        
        if (parsed.headers.length === 0) {
          toast.error('CSV file appears to be empty');
          return;
        }

        setCSVData(parsed);
        
        // Create default mappings
        const defaultMappings = createDefaultMappings(parsed.headers, columns);
        setMappings(defaultMappings);
        
        setStep('mapping');
        toast.success(`Loaded ${parsed.rowCount} rows from CSV`);
      } catch (error) {
        toast.error(`Failed to parse CSV: ${error}`);
        console.error('CSV parse error:', error);
      }
    };

    reader.readAsText(file);
  };

  const updateMapping = (csvIndex: number, updates: Partial<ColumnMapping>) => {
    setMappings(prev => 
      prev.map((m, i) => i === csvIndex ? { ...m, ...updates } : m)
    );
  };

  const handleContinueToPreview = () => {
    if (!csvData) return;

    const validation = validateCSVData(csvData.rows, mappings);
    if (!validation.valid) {
      setErrors(validation.errors);
      toast.error('Please fix validation errors before continuing');
      return;
    }

    setErrors([]);
    setStep('preview');
  };

  const handleImport = async () => {
    if (!csvData) return;

    setStep('importing');
    setIsProcessing(true);

    try {
      const rows = prepareRowsForInsert(csvData.rows, mappings);
      
      const result = await invoke<string>('bulk_insert_rows', {
        connectionId: connection.id,
        tableName: table.name,
        rows,
        dbType: connection.db_type,
      });

      setImportedCount(rows.length);
      setStep('complete');
      toast.success(result);
      onSuccess();
    } catch (error) {
      toast.error(`Failed to import data: ${error}`);
      console.error('Import error:', error);
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setCSVData(null);
    setMappings([]);
    setErrors([]);
    setImportedCount(0);
    onOpenChange(false);
  };

  const renderUploadStep = () => (
    <div className="py-12">
      <div className="flex flex-col items-center justify-center gap-4">
        <FileSpreadsheet className="h-16 w-16 text-muted-foreground/50" />
        <div className="text-center">
          <p className="text-sm font-medium mb-1">Select CSV file to import</p>
          <p className="text-xs text-muted-foreground">File should have headers in the first row</p>
        </div>
        <div>
          <input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <label htmlFor="csv-file">
            <Button type="button" onClick={() => document.getElementById('csv-file')?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Choose CSV File
            </Button>
          </label>
        </div>
      </div>
    </div>
  );

  const renderMappingStep = () => (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-muted-foreground">
        Map CSV columns to table columns. Unmapped columns will be skipped.
      </div>

      {errors.length > 0 && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">Validation Errors:</span>
          </div>
          <ul className="text-xs text-destructive space-y-1 ml-6 list-disc">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <ScrollArea className="h-[300px] border border-border rounded-md">
        <div className="p-4 space-y-3">
          {mappings.map((mapping, index) => (
            <div key={index} className="flex items-center gap-3 p-2 rounded-md bg-secondary/30">
              <div className="flex-1">
                <div className="text-xs font-medium">{mapping.csvColumn}</div>
                <div className="text-[10px] text-muted-foreground">CSV Column</div>
              </div>
              <div className="text-muted-foreground">→</div>
              <div className="flex-1">
                <Select
                  value={mapping.skip ? '_skip' : mapping.tableColumn}
                  onValueChange={(value) => {
                    if (value === '_skip') {
                      updateMapping(index, { skip: true, tableColumn: '' });
                    } else {
                      const column = columns.find(c => c.name === value);
                      updateMapping(index, {
                        skip: false,
                        tableColumn: value,
                        dataType: column?.data_type || 'TEXT',
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Skip column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_skip" className="text-xs text-muted-foreground">
                      Skip this column
                    </SelectItem>
                    {columns.map(col => (
                      <SelectItem key={col.name} value={col.name} className="text-xs">
                        <div className="flex items-center gap-2">
                          <span>{col.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {col.data_type}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  const renderPreviewStep = () => {
    if (!csvData) return null;

    const previewRows = csvData.rows.slice(0, 5);
    const mappedColumns = mappings.filter(m => !m.skip);

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            Ready to import <span className="font-semibold">{csvData.rowCount}</span> rows into{' '}
            <span className="font-mono font-semibold">{table.name}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {mappedColumns.length} columns mapped
          </div>
        </div>

        <div className="text-xs text-muted-foreground">Preview (first 5 rows):</div>

        <ScrollArea className="h-[250px] border border-border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-secondary sticky top-0">
              <tr>
                {mappedColumns.map((mapping, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium border-r border-border">
                    <div>{mapping.tableColumn}</div>
                    <div className="text-[10px] text-muted-foreground font-normal">
                      {mapping.dataType}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-border hover:bg-secondary/20">
                  {mappedColumns.map((mapping, colIndex) => (
                    <td key={colIndex} className="px-3 py-2 border-r border-border">
                      {row[mapping.csvIndex] || <span className="text-muted-foreground italic">empty</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </div>
    );
  };

  const renderImportingStep = () => (
    <div className="py-12 flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <div className="text-center">
        <p className="text-sm font-medium">Importing data...</p>
        <p className="text-xs text-muted-foreground">Please wait</p>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="py-12 flex flex-col items-center justify-center gap-4">
      <CheckCircle className="h-16 w-16 text-green-500" />
      <div className="text-center">
        <p className="text-sm font-medium mb-1">Import complete!</p>
        <p className="text-xs text-muted-foreground">
          Successfully imported {importedCount} rows
        </p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import CSV Data
          </DialogTitle>
          <DialogDescription>
            Import data from CSV file into <span className="font-mono font-semibold text-foreground">{table.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'upload' && renderUploadStep()}
          {step === 'mapping' && renderMappingStep()}
          {step === 'preview' && renderPreviewStep()}
          {step === 'importing' && renderImportingStep()}
          {step === 'complete' && renderCompleteStep()}
        </div>

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleContinueToPreview}>
                Continue to Preview
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>Import Data</>
                )}
              </Button>
            </>
          )}

          {step === 'complete' && (
            <Button onClick={handleClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
