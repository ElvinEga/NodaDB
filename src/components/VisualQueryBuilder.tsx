import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ConnectionLineType,
  MarkerType,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { invoke } from '@tauri-apps/api/core';
import {
  Plus,
  Play,
  Trash2,
  Filter,
  SortAsc,
  Hash,
  Sparkles,
  Code,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { QueryBuilderTableNode, TableNodeData } from '@/components/QueryBuilderTableNode';
import { useQueryBuilderStore } from '@/stores/queryBuilderStore';
import { generateSQL } from '@/lib/queryGenerator';
import {
  ConnectionConfig,
  DatabaseTable,
  TableColumn,
  QueryResult,
} from '@/types';
import { toast } from 'sonner';

interface VisualQueryBuilderProps {
  connection: ConnectionConfig;
}

const nodeTypes: NodeTypes = {
  tableNode: QueryBuilderTableNode,
} as NodeTypes;

export function VisualQueryBuilder({ connection }: VisualQueryBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showSQL, setShowSQL] = useState(true);

  const {
    tables: builderTables,
    joins,
    selectedColumns,
    whereConditions,
    orderBy,
    limit,
    distinct,
    addTable,
    removeTable,
    updateTablePosition,
    addJoin,
    addSelectedColumn,
    removeSelectedColumn,
    addWhereCondition,
    removeWhereCondition,
    updateWhereCondition,
    addOrderBy,
    removeOrderBy,
    setLimit,
    setDistinct,
    reset,
  } = useQueryBuilderStore();

  // Load available tables
  useEffect(() => {
    const loadTables = async () => {
      try {
        const result = await invoke<DatabaseTable[]>('list_tables', {
          connectionId: connection.id,
          dbType: connection.db_type,
        });
        setTables(result);
      } catch (error) {
        toast.error(`Failed to load tables: ${error}`);
      }
    };
    loadTables();
  }, [connection]);

  // Generate SQL query
  const generatedSQL = useMemo(() => {
    return generateSQL(
      {
        tables: builderTables,
        joins,
        selectedColumns,
        whereConditions,
        orderBy,
        limit,
        distinct,
      },
      connection.db_type
    );
  }, [builderTables, joins, selectedColumns, whereConditions, orderBy, limit, distinct, connection.db_type]);

  // Handle adding a table to the canvas
  const handleAddTable = async () => {
    if (!selectedTable) {
      toast.error('Please select a table');
      return;
    }

    const tableInfo = tables.find((t) => t.name === selectedTable);
    if (!tableInfo) return;

    try {
      // Load table columns
      const columns = await invoke<TableColumn[]>('get_table_structure', {
        connectionId: connection.id,
        tableName: selectedTable,
        dbType: connection.db_type,
      });

      const tableId = `table-${Date.now()}`;
      const position = {
        x: 100 + builderTables.length * 50,
        y: 100 + builderTables.length * 50,
      };

      // Add to store
      addTable({
        id: tableId,
        tableName: selectedTable,
        position,
        columns,
      });

      // Add to React Flow
      const newNode: Node<TableNodeData> = {
        id: tableId,
        type: 'tableNode',
        position,
        data: {
          table: {
            id: tableId,
            tableName: selectedTable,
            position,
            columns,
          },
          onRemove: handleRemoveTable,
          onColumnSelect: handleColumnSelect,
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setSelectedTable('');
      toast.success(`Added table: ${selectedTable}`);
    } catch (error) {
      toast.error(`Failed to load table structure: ${error}`);
    }
  };

  // Handle removing a table
  const handleRemoveTable = useCallback(
    (tableId: string) => {
      removeTable(tableId);
      setNodes((nds) => nds.filter((n) => n.id !== tableId));
      setEdges((eds) => eds.filter((e) => e.source !== tableId && e.target !== tableId));
      toast.success('Table removed');
    },
    [removeTable, setNodes, setEdges]
  );

  // Handle column selection
  const handleColumnSelect = useCallback(
    (tableId: string, columnName: string, selected: boolean) => {
      if (selected) {
        addSelectedColumn({
          id: `${tableId}-${columnName}-${Date.now()}`,
          tableId,
          columnName,
        });
      } else {
        const col = selectedColumns.find(
          (c) => c.tableId === tableId && c.columnName === columnName
        );
        if (col) {
          removeSelectedColumn(col.id);
        }
      }
    },
    [addSelectedColumn, removeSelectedColumn, selectedColumns]
  );

  // Handle node position changes
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      updateTablePosition(node.id, node.position);
    },
    [updateTablePosition]
  );

  // Handle creating joins via edges
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target || !params.sourceHandle || !params.targetHandle) {
        return;
      }

      // Extract table and column from handle IDs
      const sourceColumn = params.sourceHandle.replace(`${params.source}-`, '');
      const targetColumn = params.targetHandle.replace(`${params.target}-`, '');

      // Create join
      const joinId = `join-${Date.now()}`;
      addJoin({
        id: joinId,
        leftTable: params.source,
        leftColumn: sourceColumn,
        rightTable: params.target,
        rightColumn: targetColumn,
        joinType: 'INNER',
      });

      // Add edge with custom styling
      const newEdge: Edge = {
        ...params,
        id: joinId,
        type: ConnectionLineType.SmoothStep,
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
      };

      setEdges((eds) => addEdge(newEdge, eds));
      toast.success('Join created');
    },
    [addJoin, setEdges]
  );

  // Execute query
  const handleExecuteQuery = async () => {
    if (builderTables.length === 0) {
      toast.error('Please add tables to the query');
      return;
    }

    if (selectedColumns.length === 0) {
      toast.error('Please select columns');
      return;
    }

    setIsExecuting(true);
    try {
      const result = await invoke<QueryResult>('execute_query', {
        connectionId: connection.id,
        query: generatedSQL,
      });

      setQueryResult(result);
      toast.success(`Query executed: ${result.rows.length} rows returned`);
    } catch (error) {
      toast.error(`Query failed: ${error}`);
      console.error('Query execution error:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar */}
      <div className="h-12 border-b border-border bg-secondary/50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Select value={selectedTable} onValueChange={setSelectedTable}>
            <SelectTrigger className="h-8 w-[200px]">
              <SelectValue placeholder="Select table..." />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table) => (
                <SelectItem key={table.name} value={table.name}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleAddTable} className="h-8">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Table
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            size="sm"
            onClick={handleExecuteQuery}
            disabled={isExecuting}
            className="h-8"
          >
            <Play className="h-3.5 w-3.5 mr-1.5" />
            Execute
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSQL(!showSQL)}
            className="h-8"
          >
            <Code className="h-3.5 w-3.5 mr-1.5" />
            {showSQL ? 'Hide' : 'Show'} SQL
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              reset();
              setNodes([]);
              setEdges([]);
              setQueryResult(null);
              toast.success('Query builder reset');
            }}
            className="h-8"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {builderTables.length} table(s) • {selectedColumns.length} column(s) • {joins.length} join(s)
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={handleNodeDragStop}
            nodeTypes={nodeTypes}
            connectionLineType={ConnectionLineType.SmoothStep}
            fitView
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls />
          </ReactFlow>

          {/* SQL Preview Overlay */}
          {showSQL && (
            <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg max-h-[200px] overflow-auto">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Generated SQL:</div>
              <pre className="text-xs font-mono whitespace-pre-wrap">{generatedSQL}</pre>
            </div>
          )}
        </div>

        {/* Right Sidebar - Query Options */}
        <div className="w-80 border-l border-border bg-secondary/20 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {/* WHERE Conditions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    WHERE Conditions
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      addWhereCondition({
                        id: `where-${Date.now()}`,
                        column: '',
                        operator: '=',
                        value: '',
                        logicalOperator: whereConditions.length > 0 ? 'AND' : undefined,
                      })
                    }
                    className="h-6"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                {whereConditions.map((condition) => (
                  <div key={condition.id} className="p-2 border border-border rounded bg-background space-y-2">
                    <div className="flex items-center gap-1">
                      <Input
                        placeholder="Column"
                        value={condition.column}
                        onChange={(e) =>
                          updateWhereCondition(condition.id, { column: e.target.value })
                        }
                        className="h-7 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeWhereCondition(condition.id)}
                        className="h-7 w-7 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      <Select
                        value={condition.operator}
                        onValueChange={(value) =>
                          updateWhereCondition(condition.id, { operator: value })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="=">= (equals)</SelectItem>
                          <SelectItem value="!=">!= (not equals)</SelectItem>
                          <SelectItem value=">">{'>'} (greater than)</SelectItem>
                          <SelectItem value="<">{'<'} (less than)</SelectItem>
                          <SelectItem value=">=">≥ (greater or equal)</SelectItem>
                          <SelectItem value="<=">≤ (less or equal)</SelectItem>
                          <SelectItem value="LIKE">LIKE</SelectItem>
                          <SelectItem value="IN">IN</SelectItem>
                          <SelectItem value="IS NULL">IS NULL</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Value"
                        value={condition.value}
                        onChange={(e) =>
                          updateWhereCondition(condition.id, { value: e.target.value })
                        }
                        className="h-7 text-xs flex-1"
                      />
                    </div>
                    {whereConditions.indexOf(condition) > 0 && (
                      <Select
                        value={condition.logicalOperator || 'AND'}
                        onValueChange={(value) =>
                          updateWhereCondition(condition.id, { logicalOperator: value as 'AND' | 'OR' })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">AND</SelectItem>
                          <SelectItem value="OR">OR</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>

              <Separator />

              {/* ORDER BY */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <SortAsc className="h-4 w-4" />
                    ORDER BY
                  </Label>
                </div>
                {selectedColumns.map((col) => {
                  const table = builderTables.find((t) => t.id === col.tableId);
                  const columnFullName = `${table?.alias || table?.tableName}.${col.columnName}`;
                  const hasOrder = orderBy.find((o) => o.column === columnFullName);

                  return (
                    <div key={col.id} className="flex items-center gap-2">
                      <div className="text-xs flex-1 truncate">{columnFullName}</div>
                      <Select
                        value={hasOrder ? hasOrder.direction : 'none'}
                        onValueChange={(value) => {
                          if (value === 'none') {
                            removeOrderBy(columnFullName);
                          } else {
                            removeOrderBy(columnFullName);
                            addOrderBy({ column: columnFullName, direction: value as 'ASC' | 'DESC' });
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="ASC">ASC</SelectItem>
                          <SelectItem value="DESC">DESC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>

              <Separator />

              {/* LIMIT */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  LIMIT
                </Label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={limit || ''}
                  onChange={(e) => setLimit(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="h-8 text-xs"
                />
              </div>

              <Separator />

              {/* DISTINCT */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  DISTINCT
                </Label>
                <Button
                  size="sm"
                  variant={distinct ? 'default' : 'outline'}
                  onClick={() => setDistinct(!distinct)}
                  className="h-7"
                >
                  {distinct ? 'ON' : 'OFF'}
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Results Panel */}
      {queryResult && (
        <div className="h-64 border-t border-border bg-background">
          <div className="h-full flex flex-col">
            <div className="p-2 border-b border-border bg-secondary/50 flex items-center justify-between">
              <div className="text-sm font-semibold">
                Results ({queryResult.rows.length} rows)
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setQueryResult(null)}
                className="h-6"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary">
                  <tr>
                    {queryResult.columns.map((col) => (
                      <th key={col} className="px-3 py-2 text-left font-semibold border-b">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResult.rows.map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-secondary/30">
                      {queryResult.columns.map((col) => (
                        <td key={col} className="px-3 py-1.5">
                          {String(row[col] ?? 'NULL')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
