import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Editor from '@monaco-editor/react';
import { Play, Loader2, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConnectionConfig, QueryResult } from '@/types';
import { toast } from 'sonner';

interface QueryEditorProps {
  connection: ConnectionConfig;
}

export function QueryEditor({ connection }: QueryEditorProps) {
  const [query, setQuery] = useState('-- Enter your SQL query here\nSELECT * FROM sqlite_master WHERE type=\'table\';');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionTime, setExecutionTime] = useState<number>(0);

  const handleExecuteQuery = async () => {
    if (!query.trim()) {
      toast.error('Please enter a query');
      return;
    }

    setIsExecuting(true);
    setError(null);
    const startTime = Date.now();

    try {
      const result = await invoke<QueryResult>('execute_query', {
        connectionId: connection.id,
        query: query.trim(),
      });
      
      const endTime = Date.now();
      setExecutionTime(endTime - startTime);
      setResult(result);
      toast.success(`Query executed successfully in ${endTime - startTime}ms`);
    } catch (err) {
      setError(String(err));
      toast.error('Query failed');
      console.error('Query execution error:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyResults = () => {
    if (!result) return;
    
    const csv = [
      result.columns.join(','),
      ...result.rows.map(row => 
        result.columns.map(col => JSON.stringify(row[col])).join(',')
      ),
    ].join('\n');
    
    navigator.clipboard.writeText(csv);
    toast.success('Results copied to clipboard as CSV');
  };

  const handleDownloadResults = () => {
    if (!result) return;
    
    const csv = [
      result.columns.join(','),
      ...result.rows.map(row => 
        result.columns.map(col => JSON.stringify(row[col])).join(',')
      ),
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_results_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Results downloaded as CSV');
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">SQL Query Editor</h2>
          <p className="text-sm text-muted-foreground">
            {connection.name} • {connection.db_type.toUpperCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyResults}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadResults}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </>
          )}
          <Button
            onClick={handleExecuteQuery}
            disabled={isExecuting}
            size="sm"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Execute (Ctrl+Enter)
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Editor and Results */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Editor */}
        <div className="h-64 border-b">
          <Editor
            height="100%"
            defaultLanguage="sql"
            value={query}
            onChange={(value) => setQuery(value || '')}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
            }}
            onMount={(editor, monaco) => {
              editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                () => {
                  handleExecuteQuery();
                }
              );
            }}
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="results" className="h-full flex flex-col">
            <TabsList className="mx-4 mt-2">
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="messages">Messages</TabsTrigger>
            </TabsList>

            <TabsContent value="results" className="flex-1 overflow-hidden mt-2">
              {error ? (
                <div className="p-4">
                  <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
                    <h3 className="font-semibold text-destructive mb-2">Query Error</h3>
                    <pre className="text-sm text-destructive whitespace-pre-wrap font-mono">
                      {error}
                    </pre>
                  </div>
                </div>
              ) : result ? (
                <div className="h-full flex flex-col">
                  <div className="px-4 py-2 text-sm text-muted-foreground border-b">
                    {result.rows.length} row{result.rows.length !== 1 ? 's' : ''} returned
                    {executionTime > 0 && ` in ${executionTime}ms`}
                  </div>
                  <ScrollArea className="flex-1">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-center">#</TableHead>
                          {result.columns.map((column) => (
                            <TableHead key={column}>{column}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.rows.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={result.columns.length + 1}
                              className="text-center text-muted-foreground"
                            >
                              No rows returned
                            </TableCell>
                          </TableRow>
                        ) : (
                          result.rows.map((row, index) => (
                            <TableRow key={index}>
                              <TableCell className="text-center text-muted-foreground font-mono text-xs">
                                {index + 1}
                              </TableCell>
                              {result.columns.map((column) => (
                                <TableCell key={column} className="font-mono text-sm">
                                  <div className="max-w-xs truncate">
                                    {formatValue(row[column])}
                                  </div>
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Play className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Execute a query to see results</p>
                    <p className="text-xs mt-2">Press Ctrl+Enter to run</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="messages" className="flex-1 overflow-auto px-4 py-2">
              {error ? (
                <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
                  <h3 className="font-semibold text-destructive mb-2">Error</h3>
                  <pre className="text-sm text-destructive whitespace-pre-wrap font-mono">
                    {error}
                  </pre>
                </div>
              ) : result ? (
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-semibold">Status:</span> Success
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold">Rows:</span> {result.rows.length}
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold">Execution Time:</span> {executionTime}ms
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold">Columns:</span> {result.columns.join(', ')}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No messages yet. Execute a query to see details.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
