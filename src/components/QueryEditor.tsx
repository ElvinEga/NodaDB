import { useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Editor from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { Play, Loader2, Copy, Download, History, Activity, BarChart3, Wand2, ChevronDown } from 'lucide-react';
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
import { ConnectionConfig, QueryResult, ExecutionPlan } from '@/types';
import { QueryHistory } from '@/components/QueryHistory';
import { QueryAnalyzer } from '@/components/QueryAnalyzer';
import { DataVisualization } from '@/components/DataVisualization';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatSQL, toggleComment } from '@/lib/sqlFormatter';
import { exportToCSV, exportToJSON, exportToExcel, copyToClipboard } from '@/lib/exportUtils';
import { useQueryHistoryStore } from '@/stores/queryHistoryStore';
import { toast } from 'sonner';

interface QueryEditorProps {
  connection: ConnectionConfig;
}

export function QueryEditor({ connection }: QueryEditorProps) {
  const [query, setQuery] = useState('-- Enter your SQL query here\nSELECT * FROM sqlite_master WHERE type=\'table\';');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [executionTime, setExecutionTime] = useState<number>(0);
  const [showHistory, setShowHistory] = useState(false);
  const [executionPlan, setExecutionPlan] = useState<ExecutionPlan | null>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const addQueryToHistory = useQueryHistoryStore((state) => state.addQuery);

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
      const execTime = endTime - startTime;
      setExecutionTime(execTime);
      setResult(result);
      
      // Add to history
      addQueryToHistory({
        query: query.trim(),
        connectionId: connection.id,
        connectionName: connection.name,
        timestamp: startTime,
        duration: execTime,
        status: 'success',
        rowsAffected: result.rows_affected,
      });
      
      toast.success(`Query executed successfully in ${execTime}ms`);
    } catch (err) {
      const errorMsg = String(err);
      const execTime = Date.now() - startTime;
      setError(errorMsg);
      
      // Add failed query to history
      addQueryToHistory({
        query: query.trim(),
        connectionId: connection.id,
        connectionName: connection.name,
        timestamp: startTime,
        duration: execTime,
        status: 'error',
        error: errorMsg,
      });
      
      toast.error('Query failed');
      console.error('Query execution error:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExplainQuery = async () => {
    if (!query.trim()) {
      toast.error('Please enter a query');
      return;
    }

    setIsExplaining(true);
    setError(null);

    try {
      const plan = await invoke<ExecutionPlan>('explain_query', {
        connectionId: connection.id,
        query: query.trim(),
        analyze: true,
        dbType: connection.db_type,
      });
      
      setExecutionPlan(plan);
      toast.success('Query analyzed successfully');
    } catch (err) {
      const errorMsg = String(err);
      setError(errorMsg);
      toast.error('Failed to analyze query');
      console.error('Query explain error:', err);
    } finally {
      setIsExplaining(false);
    }
  };

  const handleFormatSQL = () => {
    try {
      const formatted = formatSQL(query, connection.db_type);
      setQuery(formatted);
      toast.success('SQL formatted');
    } catch (error) {
      toast.error('Failed to format SQL');
      console.error('Format error:', error);
    }
  };

  const handleExecuteSelection = async () => {
    const editor = editorRef.current;
    if (!editor) {
      handleExecuteQuery();
      return;
    }

    const selection = editor.getSelection();
    const selectedText = selection ? editor.getModel()?.getValueInRange(selection) : '';
    
    const queryToExecute = selectedText?.trim() || query.trim();
    
    if (!queryToExecute) {
      toast.error('Please enter a query');
      return;
    }

    setIsExecuting(true);
    setError(null);
    const startTime = Date.now();

    try {
      const result = await invoke<QueryResult>('execute_query', {
        connectionId: connection.id,
        query: queryToExecute,
      });
      
      const endTime = Date.now();
      const execTime = endTime - startTime;
      setExecutionTime(execTime);
      setResult(result);
      
      addQueryToHistory({
        query: queryToExecute,
        connectionId: connection.id,
        connectionName: connection.name,
        timestamp: startTime,
        duration: execTime,
        status: 'success',
        rowsAffected: result.rows_affected,
      });
      
      toast.success(`Query executed successfully in ${execTime}ms`);
    } catch (err) {
      const errorMsg = String(err);
      const execTime = Date.now() - startTime;
      setError(errorMsg);
      
      addQueryToHistory({
        query: queryToExecute,
        connectionId: connection.id,
        connectionName: connection.name,
        timestamp: startTime,
        duration: execTime,
        status: 'error',
        error: errorMsg,
      });
      
      toast.error('Query failed');
      console.error('Query execution error:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleToggleComment = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = editor.getSelection();
    if (!selection) return;

    const model = editor.getModel();
    if (!model) return;

    const selectedText = model.getValueInRange(selection);
    const commented = toggleComment(selectedText);

    editor.executeEdits('toggle-comment', [
      {
        range: selection,
        text: commented,
      },
    ]);
  };

  const handleQuerySelect = (selectedQuery: string) => {
    setQuery(selectedQuery);
    setShowHistory(false);
    toast.success('Query loaded from history');
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
    <div className="h-full flex bg-background">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-12 border-b border-border bg-secondary/50 backdrop-blur-sm flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">SQL Query Editor</h2>
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{connection.db_type.toUpperCase()}</span>
            </div>
            {result && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>•</span>
                <span><span className="font-mono text-foreground">{result.rows.length}</span> rows</span>
                <span>•</span>
                <span><span className="font-mono text-foreground">{executionTime}</span>ms</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="h-4 w-4 mr-2" />
              History
            </Button>
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
              variant="outline"
              size="sm"
              onClick={handleFormatSQL}
              title="Format SQL (Shift+Alt+F)"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Format
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExplainQuery}
              disabled={isExplaining}
            >
              {isExplaining ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4 mr-2" />
                  Explain
                </>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={isExecuting} size="sm">
                  {isExecuting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Execute
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExecuteQuery}>
                  <Play className="mr-2 h-4 w-4" />
                  Execute Query
                  <span className="ml-auto text-xs text-muted-foreground">Ctrl+Enter</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExecuteSelection}>
                  <Play className="mr-2 h-4 w-4" />
                  Execute Selection
                  <span className="ml-auto text-xs text-muted-foreground">Ctrl+Shift+Enter</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleFormatSQL}>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Format SQL
                  <span className="ml-auto text-xs text-muted-foreground">Shift+Alt+F</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
              editorRef.current = editor;
              
              // Ctrl+Enter - Execute Query
              editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                () => {
                  handleExecuteQuery();
                }
              );
              
              // Ctrl+Shift+Enter - Execute Selection
              editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
                () => {
                  handleExecuteSelection();
                }
              );
              
              // Shift+Alt+F - Format SQL
              editor.addCommand(
                monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
                () => {
                  handleFormatSQL();
                }
              );
              
              // Ctrl+/ - Toggle Comment
              editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash,
                () => {
                  handleToggleComment();
                }
              );
              
              // SQL Autocomplete
              monaco.languages.registerCompletionItemProvider('sql', {
                provideCompletionItems: (model, position) => {
                  const word = model.getWordUntilPosition(position);
                  const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                  };

                  const sqlKeywords = [
                    'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE',
                    'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'VIEW',
                    'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'ON',
                    'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
                    'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL',
                    'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
                    'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'UNION', 'ALL',
                  ];

                  const suggestions = sqlKeywords.map((keyword) => ({
                    label: keyword,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: keyword,
                    range,
                    detail: 'SQL Keyword',
                  }));

                  return { suggestions };
                },
              });
            }}
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="results" className="h-full flex flex-col">
            <TabsList className="mx-4 mt-2">
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="chart" disabled={!result || result.rows.length === 0}>Chart</TabsTrigger>
              <TabsTrigger value="plan" disabled={!executionPlan}>Execution Plan</TabsTrigger>
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
                  <div className="px-4 py-2 text-sm border-b flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {result.rows.length} row{result.rows.length !== 1 ? 's' : ''} returned
                      {executionTime > 0 && ` in ${executionTime}ms`}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7">
                          <Download className="h-3.5 w-3.5 mr-1.5" />
                          Export
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          try {
                            copyToClipboard(result);
                            toast.success('Copied to clipboard');
                          } catch (error) {
                            toast.error(String(error));
                          }
                        }}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy to Clipboard
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => {
                          try {
                            exportToCSV(result);
                            toast.success('Exported to CSV');
                          } catch (error) {
                            toast.error(String(error));
                          }
                        }}>
                          <Download className="mr-2 h-4 w-4" />
                          Export as CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          try {
                            exportToJSON(result);
                            toast.success('Exported to JSON');
                          } catch (error) {
                            toast.error(String(error));
                          }
                        }}>
                          <Download className="mr-2 h-4 w-4" />
                          Export as JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          try {
                            exportToExcel(result);
                            toast.success('Exported to Excel');
                          } catch (error) {
                            toast.error(String(error));
                          }
                        }}>
                          <Download className="mr-2 h-4 w-4" />
                          Export as Excel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

            <TabsContent value="chart" className="flex-1 overflow-hidden mt-2">
              {result && result.rows.length > 0 ? (
                <DataVisualization queryResult={result} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Execute a query with results to create visualizations</p>
                    <p className="text-xs mt-2">Charts work best with numeric data</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="plan" className="flex-1 overflow-hidden mt-2">
              {executionPlan ? (
                <QueryAnalyzer executionPlan={executionPlan} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Click "Explain" to analyze query performance</p>
                    <p className="text-xs mt-2">View execution plan and optimization suggestions</p>
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

      {/* History Sidebar */}
      {showHistory && (
        <div className="w-80 border-l">
          <QueryHistory
            connectionId={connection.id}
            onQuerySelect={handleQuerySelect}
          />
        </div>
      )}
    </div>
  );
}
