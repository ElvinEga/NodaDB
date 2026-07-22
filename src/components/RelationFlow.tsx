import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
  Edge,
  Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table2,
  Workflow,
  ExternalLink,
  Layers,
  TableProperties,
  Database,
  ArrowRight,
  RefreshCw,
  Loader2,
  XCircle,
  Download,
} from "lucide-react";
import { ConnectionConfig, RelationMatch } from "@/types";
import { ExportDataDialog } from "@/components/ExportDataDialog";
import { ExportAllFlowDialog } from "./ExportAllFlowDialog";

interface RelationFlowProps {
  connection: ConnectionConfig;
  value: string;
  onNavigateToTable?: (tableName: string, columnName: string, value: string) => void;
}

// Custom Search Node
const SearchNode = ({ data }: NodeProps<any>) => {
  return (
    <Card className="px-4 py-3 bg-primary text-primary-foreground border-primary shadow-lg rounded-xl flex items-center gap-2 max-w-sm">
      <Workflow className="h-4.5 w-4.5 shrink-0 animate-pulse" />
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] text-primary-foreground/70 uppercase font-semibold tracking-wider">Search Origin</span>
        <span className="font-mono text-xs truncate max-w-[180px] font-bold">{data.label}</span>
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-primary-foreground border-primary-foreground" />
    </Card>
  );
};

// Custom Table Node
const TableNode = ({
  data,
}: NodeProps<any>) => {
  const renderCellValue = (val: any) => {
    if (val === null || val === undefined) {
      return <span className="text-muted-foreground italic text-[9px]">NULL</span>;
    }
    if (typeof val === "boolean") {
      return (
        <span className={`px-1 py-0.2 rounded text-[9px] font-semibold ${val ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
          {val ? "TRUE" : "FALSE"}
        </span>
      );
    }
    return <span className="font-mono text-[9px] truncate max-w-[100px]">{String(val)}</span>;
  };

  return (
    <Card className="border border-border bg-card shadow-md rounded-xl overflow-hidden min-w-[320px] max-w-[450px] flex flex-col">
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 bg-muted border-border" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-primary border-primary" />

      {/* Node Header */}
      <div className="px-3.5 py-2.5 bg-muted/20 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <Table2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-bold text-xs truncate">{data.tableName}</span>
          <Badge variant={data.isPrimaryKey ? "default" : "secondary"} className="!text-sm h-4.5 px-1 py-0.1 font-medium shrink-0">
            {data.isPrimaryKey ? "PK" : "FK / Ref"}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-muted-foreground font-semibold">({data.count} match{data.count === 1 ? "" : "es"})</span>
          {data.onExport && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-md"
              onClick={(e) => {
                e.stopPropagation();
                data.onExport();
              }}
              title="Export Table Data"
            >
              <Download className="h-3 w-3" />
            </Button>
          )}
          {data.onNavigate && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-md"
              onClick={(e) => {
                e.stopPropagation();
                data.onNavigate?.();
              }}
              title="Go to Table View"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Node Data Preview (max 2 rows, 3 columns) */}
      <div className="p-2 bg-background/50 flex-1 overflow-x-auto min-w-0">
        <div className="text-[9px] text-muted-foreground mb-1.5 font-medium px-1 flex items-center gap-1">
          Matched Field: <span className="font-mono font-semibold bg-muted px-1 py-0.2 rounded text-foreground">{data.columnName}</span>
        </div>

        {data.sampleRows.rows.length > 0 ? (
          <div className="border border-border/70 rounded-lg overflow-hidden w-full">
            <table className="w-full text-[10px] border-collapse min-w-max">
              <thead>
                <tr className="border-b border-border/70 bg-muted/30">
                  {data.sampleRows.columns.slice(0, 3).map((col: string) => (
                    <th key={col} className={`py-1 px-2 text-left font-medium text-[9px] text-muted-foreground border-r border-border/70 last:border-r-0 ${col === data.columnName ? "bg-primary/10 text-primary font-semibold" : ""}`}>
                      {col}
                    </th>
                  ))}
                  {data.sampleRows.columns.length > 3 && (
                    <th className="py-1 px-1.5 text-left font-medium text-[9px] text-muted-foreground">...</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.sampleRows.rows.slice(0, 2).map((row: any, rIdx: number) => (
                  <tr key={rIdx} className="border-b border-border/70 last:border-b-0 hover:bg-muted/10">
                    {data.sampleRows.columns.slice(0, 3).map((col: string) => (
                      <td key={col} className={`py-1 px-2 border-r border-border/70 last:border-r-0 align-middle ${col === data.columnName ? "bg-primary/5 font-semibold text-primary" : ""}`}>
                        {renderCellValue(row[col])}
                      </td>
                    ))}
                    {data.sampleRows.columns.length > 3 && (
                      <td className="py-1 px-1.5 text-[8px] text-muted-foreground font-medium align-middle">...</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground italic p-2 text-center">No preview available</div>
        )}
      </div>
    </Card>
  );
};

const nodeTypes = {
  searchNode: SearchNode,
  tableNode: TableNode,
} as any;

export default function RelationFlow({
  connection,
  value,
  onNavigateToTable,
}: RelationFlowProps) {
  const [viewMode, setViewMode] = useState<"flow" | "comparison">("comparison");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<RelationMatch[]>([]);

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportData, setExportData] = useState<any>(null);
  const [exportTableName, setExportTableName] = useState("");
  const [exportAllDialogOpen, setExportAllDialogOpen] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (value) {
      loadRelations();
    }
  }, [value, connection.id]);

  const loadRelations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await invoke<RelationMatch[]>("trace_id_relations", {
        connectionId: connection.id,
        value: value,
        dbType: connection.db_type,
      });

      // Sort results so primary keys show first
      const sortedResults = [...results].sort((a, b) => {
        if (a.is_primary_key && !b.is_primary_key) return -1;
        if (!a.is_primary_key && b.is_primary_key) return 1;
        return a.table_name.localeCompare(b.table_name);
      });

      setMatches(sortedResults);
      buildGraph(sortedResults);
    } catch (err: any) {
      console.error("Failed to load relation flow data:", err);
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const buildGraph = (relationMatches: RelationMatch[]) => {
    if (relationMatches.length === 0) return;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // 1. Identify if there is a primary key table node
    const primaryKeyMatch = relationMatches.find((m) => m.is_primary_key);
    const hasPrimaryKey = primaryKeyMatch !== undefined;

    const centerX = 500;
    const centerY = 350;
    const radius = 380;

    // 2. Place Origin search node
    if (hasPrimaryKey) {
      newNodes.push({
        id: "search-origin",
        type: "searchNode",
        position: { x: 100, y: centerY },
        data: { label: value },
      });
    } else {
      newNodes.push({
        id: "search-origin",
        type: "searchNode",
        position: { x: centerX, y: centerY },
        data: { label: value },
      });
    }

    // 3. Render table nodes and connect edges
    const nonPkMatches = relationMatches.filter((m) => !m.is_primary_key);
    const numNonPk = nonPkMatches.length;

    let nonPkIndex = 0;

    relationMatches.forEach((match) => {
      const isPk = match.is_primary_key;
      const nodeId = `table-${match.table_name}`;

      let xPos = centerX;
      let yPos = centerY;

      if (hasPrimaryKey) {
        if (isPk) {
          xPos = centerX;
          yPos = centerY;
        } else {
          // Distribute along an arc of 270 degrees (from -135 to +135 deg) on the right
          const angle = numNonPk > 1
            ? -2.356 + (4.712 * nonPkIndex) / (numNonPk - 1)
            : 0; // if only 1 node, put it on the right (0 rad)

          xPos = centerX + radius * Math.cos(angle);
          yPos = centerY + radius * Math.sin(angle);
          nonPkIndex++;
        }
      } else {
        // Distribute in a full circle around the search-origin center
        const angle = (2 * Math.PI * nonPkIndex) / relationMatches.length;
        xPos = centerX + radius * Math.cos(angle);
        yPos = centerY + radius * Math.sin(angle);
        nonPkIndex++;
      }

      newNodes.push({
        id: nodeId,
        type: "tableNode",
        position: { x: Math.round(xPos), y: Math.round(yPos) },
        data: {
          tableName: match.table_name,
          columnName: match.column_name,
          isPrimaryKey: isPk,
          count: match.count,
          sampleRows: match.sample_rows,
          onNavigate: onNavigateToTable
            ? () => onNavigateToTable(match.table_name, match.column_name, value)
            : undefined,
          onExport: () => {
            setExportData(match.sample_rows);
            setExportTableName(match.table_name);
            setExportDialogOpen(true);
          },
        },
      });

      // 4. Connect Edges
      if (hasPrimaryKey) {
        if (isPk) {
          // Search Origin points to Primary Key table (e.g. search -> students)
          newEdges.push({
            id: `edge-origin-to-${nodeId}`,
            source: "search-origin",
            target: nodeId,
            animated: true,
            style: { stroke: "#6366f1", strokeWidth: 2 },
          });
        } else {
          // Foreign Key tables point to the Primary Key table (e.g. payments -> students)
          const pkNodeId = `table-${primaryKeyMatch.table_name}`;
          newEdges.push({
            id: `edge-${nodeId}-to-${pkNodeId}`,
            source: nodeId,
            target: pkNodeId,
            animated: true,
            label: `${match.column_name} ➔ ${primaryKeyMatch.column_name}`,
            labelStyle: { fill: "#71717a", fontSize: 9, fontWeight: 500 },
            style: { stroke: "#10b981", strokeWidth: 1.5 },
          });
        }
      } else {
        // Simple direct links: Search Origin points to all tables
        newEdges.push({
          id: `edge-origin-to-${nodeId}`,
          source: "search-origin",
          target: nodeId,
          animated: true,
          style: { stroke: "#6366f1", strokeWidth: 2 },
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
  };

  const renderValue = (val: any) => {
    if (val === null || val === undefined) {
      return <span className="text-muted-foreground italic text-[10px]">NULL</span>;
    }
    if (typeof val === "boolean") {
      return (
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${val ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
          {val ? "TRUE" : "FALSE"}
        </span>
      );
    }
    return <span className="font-mono text-[10px]">{String(val)}</span>;
  };

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden relative">
      {/* Header controls bar */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-4 shrink-0 bg-muted/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Workflow className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold flex items-center gap-2">
              Relation Flow Explorer
            </h1>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              Tracing value:{" "}
              <span className="font-mono font-bold bg-muted px-1.5 py-0.2 rounded text-foreground">{value}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggles */}
          <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/40 shadow-sm shrink-0">
            <Button
              variant={viewMode === "comparison" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3 font-semibold rounded-md gap-1"
              onClick={() => setViewMode("comparison")}
            >
              <TableProperties className="h-3.5 w-3.5" />
              Table Grid
            </Button>
            <Button
              variant={viewMode === "flow" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3 font-semibold rounded-md gap-1"
              onClick={() => setViewMode("flow")}
            >
              <Layers className="h-3.5 w-3.5" />
              Flow Graph
            </Button>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg hover:bg-primary/5 hover:text-primary"
            onClick={loadRelations}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Main body area */}
      <div className="flex-1 min-h-0 relative pb-12">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Scanning database relations graph...</p>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-destructive/10 border border-destructive rounded-lg p-4 max-w-md">
              <h3 className="font-semibold text-destructive text-sm mb-1">Search Failed</h3>
              <pre className="text-xs text-destructive whitespace-pre-wrap font-mono">{error}</pre>
            </div>
          </div>
        ) : matches.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
            <Database className="h-12 w-12 text-muted-foreground/35 mb-3" />
            <h3 className="font-semibold text-sm mb-1">No references found</h3>
            <p className="text-xs text-muted-foreground max-w-sm">No tables contain records matching this identifier.</p>
          </div>
        ) : viewMode === "flow" ? (
          // React Flow view
          <div className="h-full w-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.2}
              maxZoom={1.5}
            >
              <Background color="#ccc" gap={16} size={1} />
              <Controls className="border border-border/80 rounded-lg shadow-sm" />
              <MiniMap
                nodeColor={(node) => {
                  if (node.type === "searchNode") return "#6366f1";
                  return "#e4e4e7";
                }}
                className="border border-border/80 rounded-lg shadow-sm"
              />
            </ReactFlow>
          </div>
        ) : (
          // Comparison layout cards grid
          <div className="h-full w-full overflow-y-auto p-6 bg-secondary/10">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-6">
              {matches.map((match) => (
                <div key={`${match.table_name}-${match.column_name}`} className="border border-border rounded-xl bg-card overflow-hidden shadow-sm flex flex-col">
                  {/* Header */}
                  <div className="px-4 py-3 bg-muted/20 border-b border-border flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Table2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-xs">{match.table_name}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{match.column_name}</span>
                      <Badge variant={match.is_primary_key ? "default" : "secondary"} className="!text-xs h-4.5 px-1.5 font-medium">
                        {match.is_primary_key ? "Primary Key" : "Foreign Key / Ref"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">({match.count} match{match.count === 1 ? "" : "es"})</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] px-2.5 hover:bg-primary/5 hover:text-primary gap-1"
                        onClick={() => {
                          setExportData(match.sample_rows);
                          setExportTableName(match.table_name);
                          setExportDialogOpen(true);
                        }}
                      >
                        <Download className="h-3 w-3" />
                        Export
                      </Button>
                      {onNavigateToTable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px] px-2.5 hover:bg-primary/5 hover:text-primary gap-1"
                          onClick={() => onNavigateToTable(match.table_name, match.column_name, value)}
                        >
                          Go to Table
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Table View */}
                  <div className="w-full overflow-x-auto overflow-y-auto max-h-[250px] min-w-0">
                    {(() => {
                      const hasDeletedAtColumn = match.sample_rows.columns.includes("deleted_at");
                      return (
                        <table className="w-full min-w-max text-sm text-left border-collapse">
                          <thead>
                            <tr className="border-b border-border bg-muted/30">
                              {hasDeletedAtColumn && (
                                <th className="text-[10px] font-normal py-2 px-3 whitespace-nowrap border-r border-border text-muted-foreground align-middle w-12 text-center bg-muted/20">
                                  Status
                                </th>
                              )}
                              {match.sample_rows.columns.map((col) => {
                                const isMatchedCol = col === match.column_name;
                                return (
                                  <th key={col} className={`text-[10px] font-normal py-2 px-3 whitespace-nowrap border-r border-border text-muted-foreground align-middle ${isMatchedCol ? "bg-primary/10 text-primary font-semibold border-r border-primary/20" : ""}`}>
                                    {col}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {match.sample_rows.rows.map((row, rIdx) => {
                              const isDeleted = hasDeletedAtColumn && row["deleted_at"] !== null && row["deleted_at"] !== undefined;
                              return (
                                <tr key={rIdx} className={`border-b border-border hover:bg-muted/30 last:border-b-0 ${isDeleted ? "bg-destructive/5 text-destructive/95" : ""}`}>
                                  {hasDeletedAtColumn && (
                                    <td className="py-1.5 px-3 border-r border-border text-xs align-middle text-center w-12 bg-muted/5" title={isDeleted ? `Deleted at: ${String(row["deleted_at"])}` : undefined}>
                                      {isDeleted ? (
                                        <XCircle className="h-4 w-4 text-destructive inline-block align-middle" />
                                      ) : (
                                        <span className="text-[10px] text-muted-foreground/45 font-medium">-</span>
                                      )}
                                    </td>
                                  )}
                                  {match.sample_rows.columns.map((col) => {
                                    const isMatchedCol = col === match.column_name;
                                    const cellValue = row[col];
                                    return (
                                      <td key={col} className={`py-1.5 px-3 border-r border-border text-xs align-middle ${isMatchedCol ? "bg-primary/5 font-semibold text-primary border-r border-primary/10" : ""}`}>
                                        {renderValue(cellValue)}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!isLoading && !error && matches.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 z-10 h-12 border-t border-border bg-card/95 backdrop-blur-sm flex items-center justify-between px-4 gap-4 shadow-sm">
          <div className="flex items-center gap-4 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExportAllDialogOpen(true)}
              className="h-8 text-xs font-semibold gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Export All
            </Button>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Tables Scanned: <span className="font-semibold text-foreground">{matches.length}</span>
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Total Relations Traced:{" "}
              <span className="font-mono font-semibold text-foreground">
                {matches.reduce((acc, curr) => acc + curr.sample_rows.rows.length, 0)}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>Origin:</span>
            <span className="font-mono text-xs bg-muted/60 border border-border/80 px-1.5 py-0.5 rounded text-foreground font-semibold">{value}</span>
          </div>
        </div>
      )}

      {exportData && (
        <ExportDataDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          data={exportData}
          tableName={exportTableName}
        />
      )}

      {exportAllDialogOpen && (
        <ExportAllFlowDialog
          open={exportAllDialogOpen}
          onOpenChange={setExportAllDialogOpen}
          matches={matches}
          value={value}
        />
      )}
    </div>
  );
}
