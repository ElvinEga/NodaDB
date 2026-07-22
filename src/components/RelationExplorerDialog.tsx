import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Workflow,
  Loader2,
  Table2,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { ConnectionConfig, RelationMatch } from "@/types";

interface RelationExplorerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionConfig;
  value: string;
  onNavigateToTable?: (tableName: string, columnName: string, value: string) => void;
}

export function RelationExplorerDialog({
  open,
  onOpenChange,
  connection,
  value,
  onNavigateToTable,
}: RelationExplorerDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<RelationMatch[]>([]);

  useEffect(() => {
    if (open && value) {
      loadRelations();
    }
  }, [open, value, connection.id]);

  const loadRelations = async () => {
    setIsLoading(true);
    setError(null);
    setMatches([]);
    try {
      const results = await invoke<RelationMatch[]>("trace_id_relations", {
        connectionId: connection.id,
        value: value,
        dbType: connection.db_type,
      });
      // Sort matches so that primary key matches are displayed first
      const sortedResults = [...results].sort((a, b) => {
        if (a.is_primary_key && !b.is_primary_key) return -1;
        if (!a.is_primary_key && b.is_primary_key) return 1;
        return a.table_name.localeCompare(b.table_name);
      });
      setMatches(sortedResults);
    } catch (err: any) {
      console.error("Failed to load relations:", err);
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const renderValue = (val: any) => {
    if (val === null || val === undefined) {
      return <span className="text-muted-foreground italic text-[10px]">NULL</span>;
    }
    if (typeof val === "boolean") {
      return (
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            val
              ? "bg-green-500/10 text-green-600"
              : "bg-red-500/10 text-red-600"
          }`}
        >
          {val ? "TRUE" : "FALSE"}
        </span>
      );
    }
    if (typeof val === "object") {
      return (
        <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[150px]">
          {JSON.stringify(val)}
        </span>
      );
    }
    return <span className="font-mono text-[10px]">{String(val)}</span>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-6 gap-4">
        <DialogHeader className="border-b border-border pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Workflow className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Relation Explorer
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                Tracing references for value:{" "}
                <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground font-medium select-all">
                  {value}
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 relative">
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">
                Scanning database tables for relations...
              </p>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="bg-destructive/10 border border-destructive rounded-lg p-4 max-w-md">
                <h3 className="font-semibold text-destructive text-sm mb-1">
                  Search Failed
                </h3>
                <pre className="text-xs text-destructive whitespace-pre-wrap font-mono">
                  {error}
                </pre>
              </div>
            </div>
          ) : matches.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              <Table2 className="h-12 w-12 text-muted-foreground/35 mb-3" />
              <h3 className="font-semibold text-sm mb-1">No references found</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                No tables or columns in the database contain records matching this
                value.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full pr-4">
              <div className="space-y-6 pb-6">
                {matches.map((match) => (
                  <div
                    key={`${match.table_name}-${match.column_name}`}
                    className="border border-border rounded-lg bg-card overflow-hidden shadow-sm"
                  >
                    {/* Header */}
                    <div className="px-4 py-3 bg-muted/20 border-b border-border flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Table2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">
                          {match.table_name}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {match.column_name}
                        </span>
                        <Badge
                          variant={match.is_primary_key ? "default" : "secondary"}
                          className="text-[10px] h-5 px-1.5 font-medium"
                        >
                          {match.is_primary_key ? "Primary Key" : "Foreign Key / Ref"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({match.count} match{match.count === 1 ? "" : "es"})
                        </span>
                      </div>

                      {onNavigateToTable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] px-2.5 hover:bg-primary/5 hover:text-primary gap-1"
                          onClick={() => {
                            onNavigateToTable(
                              match.table_name,
                              match.column_name,
                              value
                            );
                            onOpenChange(false);
                          }}
                        >
                          Go to Table
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    {/* Table View */}
                    <div className="w-full overflow-auto max-h-[300px]">
                      <Table className="border-t-0">
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            {match.sample_rows.columns.map((col) => {
                              const isMatchedCol = col === match.column_name;
                              return (
                                <TableHead
                                  key={col}
                                  className={`text-[10px] font-medium py-1 px-3 ${
                                    isMatchedCol
                                      ? "bg-primary/10 text-primary font-semibold border-r border-primary/20"
                                      : ""
                                  }`}
                                >
                                  {col}
                                </TableHead>
                              );
                            })}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {match.sample_rows.rows.map((row, rIdx) => (
                            <TableRow key={rIdx} className="hover:bg-muted/30">
                              {match.sample_rows.columns.map((col) => {
                                const isMatchedCol = col === match.column_name;
                                const cellValue = row[col];
                                return (
                                  <TableCell
                                    key={col}
                                    className={`py-1.5 px-3 border-b border-border ${
                                      isMatchedCol
                                        ? "bg-primary/5 font-semibold text-primary border-r border-primary/10"
                                        : ""
                                    }`}
                                  >
                                    {renderValue(cellValue)}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
