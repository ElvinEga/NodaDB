import { useState, useCallback, useEffect } from "react";
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
} from "@xyflow/react";
import { invoke } from "@tauri-apps/api/core";
import { SchemaNode, SchemaNodeData } from "@/components/SchemaNode";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Maximize2, Download, Loader2 } from "lucide-react";
import { ConnectionConfig, DatabaseTable, TableColumn } from "@/types";
import { toast } from "sonner";
import "@xyflow/react/dist/style.css";

interface SchemaDesignerProps {
  connection: ConnectionConfig;
}

const nodeTypes: NodeTypes = {
  schemaNode: SchemaNode,
} as NodeTypes;

export function SchemaDesigner({ connection }: SchemaDesignerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<SchemaNodeData>>(
    []
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tableCount, setTableCount] = useState(0);

  // Auto-layout nodes in a hierarchical way
  const autoLayout = useCallback(
    (tables: DatabaseTable[], columnsMap: Map<string, any[]>) => {
      const nodeWidth = 320;
      const nodeHeight = 300;
      const horizontalSpacing = 150;
      const verticalSpacing = 180;

      // Create nodes first
      const newNodes: Node<SchemaNodeData>[] = tables.map((table) => {
        const columns = columnsMap.get(table.name) || [];

        return {
          id: table.name,
          type: "schemaNode",
          position: { x: 0, y: 0 }, // Will be calculated
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

      // Analyze relationships to group related tables
      const hasPrimaryKey = new Set<string>();
      const hasForeignKey = new Set<string>();

      newNodes.forEach((node) => {
        const hasPK = node.data.columns.some((c) => c.isPrimaryKey);
        const hasFK = node.data.columns.some((c) => {
          const name = c.name.toLowerCase();
          return (
            (name.endsWith("_id") || name.endsWith("id")) && !c.isPrimaryKey
          );
        });

        if (hasPK && !hasFK) hasPrimaryKey.add(node.id);
        if (hasFK) hasForeignKey.add(node.id);
      });

      // Position nodes: parent tables on top, child tables on bottom (horizontal layout)
      let parentX = 50;
      let childX = 50;

      newNodes.forEach((node, index) => {
        if (hasPrimaryKey.has(node.id)) {
          // Parent table - position on top row
          node.position = {
            x: parentX,
            y: 50,
          };
          parentX += nodeWidth + horizontalSpacing;
        } else if (hasForeignKey.has(node.id)) {
          // Child table - position on bottom row
          node.position = {
            x: childX,
            y: nodeHeight + verticalSpacing + 50,
          };
          childX += nodeWidth + horizontalSpacing;
        } else {
          // Other tables - use horizontal grid layout
          const nodesPerRow = Math.ceil(Math.sqrt(tables.length));
          const row = Math.floor(index / nodesPerRow);
          const col = index % nodesPerRow;
          node.position = {
            x: col * (nodeWidth + horizontalSpacing) + 50,
            y: row * (nodeHeight + verticalSpacing) + 50,
          };
        }
      });

      return newNodes;
    },
    []
  );

  // Load schema
  const loadSchema = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get all tables
      const tables = await invoke<DatabaseTable[]>("list_tables", {
        connectionId: connection.id,
        dbType: connection.db_type,
      });

      setTableCount(tables.length);

      // Get columns for each table
      const columnsMap = new Map<string, TableColumn[]>();
      await Promise.all(
        tables.map(async (table) => {
          try {
            const columns = await invoke<TableColumn[]>("get_table_structure", {
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

      // Enhanced foreign key relationship detection
      const detectedEdges: Edge[] = [];
      const foreignKeyColumns = new Set<string>();

      layoutedNodes.forEach((sourceNode) => {
        sourceNode.data.columns.forEach((sourceCol) => {
          const colNameLower = sourceCol.name.toLowerCase();

          // Skip if it's the primary key of this table
          if (sourceCol.isPrimaryKey) return;

          // Enhanced heuristics for FK detection
          let possibleTableNames: string[] = [];

          // Pattern 1: table_id, tableid
          if (colNameLower.endsWith("_id")) {
            const tableName = colNameLower.replace(/_id$/, "");
            possibleTableNames.push(tableName);
            // Also try plural forms
            possibleTableNames.push(tableName + "s");
            // Try removing 's' for plural to singular
            if (tableName.endsWith("s")) {
              possibleTableNames.push(tableName.slice(0, -1));
            }
          } else if (colNameLower.endsWith("id") && colNameLower.length > 2) {
            const tableName = colNameLower.slice(0, -2);
            possibleTableNames.push(tableName);
            possibleTableNames.push(tableName + "s");
            if (tableName.endsWith("s")) {
              possibleTableNames.push(tableName.slice(0, -1));
            }
          }

          // Pattern 2: tableId (camelCase)
          if (/[a-z][A-Z]/.test(sourceCol.name)) {
            const parts = sourceCol.name.split(/(?=[A-Z])/);
            if (parts[parts.length - 1]?.toLowerCase() === "id") {
              const tableName = parts.slice(0, -1).join("").toLowerCase();
              possibleTableNames.push(tableName);
              possibleTableNames.push(tableName + "s");
            }
          }

          // Try to find matching table
          for (const possibleTableName of possibleTableNames) {
            const targetNode = layoutedNodes.find(
              (n) => n.data.tableName.toLowerCase() === possibleTableName
            );

            if (targetNode && targetNode.id !== sourceNode.id) {
              // Find primary key in target table
              const targetPK = targetNode.data.columns.find(
                (c) => c.isPrimaryKey
              );
              if (targetPK) {
                const edgeId = `${sourceNode.id}-${sourceCol.name}-${targetNode.id}`;

                // Check if edge already exists
                if (!detectedEdges.find((e) => e.id === edgeId)) {
                  const edge: Edge = {
                    id: edgeId,
                    source: targetNode.id,
                    target: sourceNode.id,
                    sourceHandle: `${targetNode.data.tableName}-${targetPK.name}-source`,
                    targetHandle: `${sourceNode.data.tableName}-${sourceCol.name}-target`,
                    type: "smoothstep",
                    animated: false,
                    style: { stroke: "#f97316", strokeWidth: 2.5 },
                    markerEnd: {
                      type: MarkerType.ArrowClosed,
                      color: "#f97316",
                      width: 20,
                      height: 20,
                    },
                    label: sourceCol.name,
                    labelStyle: {
                      fontSize: 11,
                      fill: "#f97316",
                      fontWeight: 600,
                    },
                    labelBgStyle: {
                      fill: "#fff",
                      fillOpacity: 0.9,
                    },
                    labelBgPadding: [4, 6] as [number, number],
                    labelBgBorderRadius: 4,
                  };
                  detectedEdges.push(edge);

                  // Mark column as foreign key
                  foreignKeyColumns.add(`${sourceNode.id}-${sourceCol.name}`);
                }
                break; // Found a match, stop looking
              }
            }
          }
        });
      });

      // Update nodes to mark foreign key columns
      layoutedNodes.forEach((node) => {
        node.data.columns.forEach((col) => {
          const key = `${node.id}-${col.name}`;
          if (foreignKeyColumns.has(key)) {
            col.isForeignKey = true;
          }
        });
      });

      setNodes(layoutedNodes);
      setEdges(detectedEdges);
      toast.success(`Loaded schema with ${tables.length} tables`);
    } catch (error) {
      toast.error(`Failed to load schema: ${error}`);
      console.error("Schema load error:", error);
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
    toast.info("Use mouse wheel to zoom, drag to pan");
  }, []);

  // Export schema as image (placeholder)
  const handleExportImage = useCallback(() => {
    toast.info("Image export coming soon!");
  }, []);

  // Handle edge hover
  const handleEdgeMouseEnter = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edge.id
            ? {
                ...e,
                animated: true,
                style: { ...e.style, strokeWidth: 4, stroke: "#ea580c" },
              }
            : e
        )
      );
    },
    [setEdges]
  );

  const handleEdgeMouseLeave = useCallback(() => {
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        animated: false,
        style: { ...e.style, strokeWidth: 2.5, stroke: "#f97316" },
      }))
    );
  }, [setEdges]);

  return (
    <div className="h-full w-full bg-background relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgeMouseEnter={handleEdgeMouseEnter}
        onEdgeMouseLeave={handleEdgeMouseLeave}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: false,
        }}
      >
        <Background />
        <Controls className="react-flow__controls" />
        <MiniMap
          nodeColor={(node) => {
            return node.selected ? "hsl(var(--primary))" : "hsl(var(--accent))";
          }}
          maskColor="hsl(0 0% 0% / 0.17)"
          style={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
          }}
        />

        {/* Top Panel */}
        <Panel
          position="top-left"
          className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 m-4"
        >
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
        <Panel
          position="top-right"
          className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 m-4"
        >
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
          <Panel
            position="top-center"
            className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-4 py-2 m-4"
          >
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
