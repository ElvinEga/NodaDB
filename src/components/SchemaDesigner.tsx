import { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  NodeTypes,
  Panel,
} from '@xyflow/react';
import { invoke } from '@tauri-apps/api/core';
import { SchemaNode, SchemaNodeData } from '@/components/SchemaNode';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Maximize2, Download, Loader2 } from 'lucide-react';
import { ConnectionConfig, DatabaseTable, TableColumn } from '@/types';
import { toast } from 'sonner';
import '@xyflow/react/dist/style.css';

interface SchemaDesignerProps {
  connection: ConnectionConfig;
}

const nodeTypes: NodeTypes = {
  schemaNode: SchemaNode,
} as NodeTypes;

export function SchemaDesigner({ connection }: SchemaDesignerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<SchemaNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tableCount, setTableCount] = useState(0);

  // Auto-layout nodes in a grid
  const autoLayout = useCallback((tables: DatabaseTable[], columnsMap: Map<string, any[]>) => {
    const nodesPerRow = Math.ceil(Math.sqrt(tables.length));
    const nodeWidth = 320;
    const nodeHeight = 300;
    const horizontalSpacing = 100;
    const verticalSpacing = 150;

    const newNodes: Node<SchemaNodeData>[] = tables.map((table, index) => {
      const row = Math.floor(index / nodesPerRow);
      const col = index % nodesPerRow;

      const columns = columnsMap.get(table.name) || [];

      return {
        id: table.name,
        type: 'schemaNode',
        position: {
          x: col * (nodeWidth + horizontalSpacing) + 50,
          y: row * (nodeHeight + verticalSpacing) + 50,
        },
        data: {
          tableName: table.name,
          columns: columns.map((col: any) => ({
            name: col.name,
            type: col.data_type,
            isPrimaryKey: col.is_primary_key || false,
            isForeignKey: false, // Will be determined by foreign keys
            isNullable: col.is_nullable || false,
          })),
          rowCount: table.row_count,
        },
      };
    });

    return newNodes;
  }, []);

  // Load schema
  const loadSchema = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get all tables
      const tables = await invoke<DatabaseTable[]>('get_tables', {
        connectionId: connection.id,
        dbType: connection.db_type,
      });

      setTableCount(tables.length);

      // Get columns for each table
      const columnsMap = new Map<string, TableColumn[]>();
      await Promise.all(
        tables.map(async (table) => {
          try {
            const columns = await invoke<TableColumn[]>('get_table_structure', {
              connectionId: connection.id,
              tableName: table.name,
              dbType: connection.db_type,
            });
            columnsMap.set(table.name, columns);
          } catch (error) {
            console.error(`Failed to load columns for ${table.name}:`, error);
          }
        })
      );

      // Auto-layout nodes
      const layoutedNodes = autoLayout(tables, columnsMap);
      setNodes(layoutedNodes);

      // Try to detect foreign key relationships
      // This is a simplified approach - real FK detection would require backend support
      const detectedEdges: Edge[] = [];
      layoutedNodes.forEach((sourceNode) => {
        sourceNode.data.columns.forEach((sourceCol) => {
          // Simple heuristic: column names like "table_id" or "tableId" might be FKs
          const colNameLower = sourceCol.name.toLowerCase();
          if (colNameLower.endsWith('_id') || colNameLower.endsWith('id')) {
            // Try to find matching table
            const possibleTableName = colNameLower
              .replace(/_id$/, '')
              .replace(/id$/, '');

            const targetNode = layoutedNodes.find(
              (n) => n.data.tableName.toLowerCase() === possibleTableName
            );

            if (targetNode && targetNode.id !== sourceNode.id) {
              // Find primary key in target table
              const targetPK = targetNode.data.columns.find((c) => c.isPrimaryKey);
              if (targetPK) {
                detectedEdges.push({
                  id: `${sourceNode.id}-${sourceCol.name}-${targetNode.id}`,
                  source: targetNode.id,
                  target: sourceNode.id,
                  sourceHandle: `${targetNode.data.tableName}-${targetPK.name}-source`,
                  targetHandle: `${sourceNode.data.tableName}-${sourceCol.name}-target`,
                  type: 'smoothstep',
                  animated: true,
                  style: { stroke: '#f97316', strokeWidth: 2 },
                  markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: '#f97316',
                  },
                  label: sourceCol.name,
                  labelStyle: { fontSize: 10, fill: '#666' },
                  labelBgStyle: { fill: '#fff' },
                });

                // Mark column as foreign key
                sourceCol.isForeignKey = true;
              }
            }
          }
        });
      });

      setEdges(detectedEdges);
      toast.success(`Loaded schema with ${tables.length} tables`);
    } catch (error) {
      toast.error(`Failed to load schema: ${error}`);
      console.error('Schema load error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [connection, autoLayout, setNodes, setEdges]);

  // Load schema on mount
  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  // Auto-fit view
  const handleFitView = useCallback(() => {
    // This would require reactFlowInstance.fitView() - we'd need to use useReactFlow hook
    toast.info('Use mouse wheel to zoom, drag to pan');
  }, []);

  // Export schema as image (placeholder)
  const handleExportImage = useCallback(() => {
    toast.info('Image export coming soon!');
  }, []);

  return (
    <div className="h-full w-full bg-background relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
        }}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            return node.selected ? '#6366f1' : '#94a3b8';
          }}
          maskColor="rgba(0, 0, 0, 0.2)"
        />

        {/* Top Panel */}
        <Panel position="top-left" className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 m-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Schema Viewer</h2>
              <Badge variant="secondary" className="text-xs">
                {tableCount} tables
              </Badge>
              {edges.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {edges.length} relationships
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadSchema}
                disabled={isLoading}
                className="h-8"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleFitView}
                className="h-8"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportImage}
                className="h-8"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Panel>

        {/* Legend */}
        <Panel position="bottom-right" className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 m-4">
          <div className="text-xs space-y-2">
            <div className="font-semibold mb-2">Legend</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">Primary Key</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">Foreign Key</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-orange-500" />
              <span className="text-muted-foreground">Relationship</span>
            </div>
          </div>
        </Panel>

        {/* Loading Overlay */}
        {isLoading && (
          <Panel position="top-center" className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-4 py-2 m-4">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Loading schema...</span>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
