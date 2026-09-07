import React, { useState, useMemo } from "react";
import {
  Plus,
  Search,
  LayoutGrid,
  List as ListIcon,
  Pin,
  PinOff,
  MoreVertical,
  ExternalLink,
  Edit,
  Pencil,
  Copy,
  Trash2,
  X,
  ArrowLeft,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DbIcon } from "@/components/DbIcon";
import { ConnectionConfig } from "@/types";

export interface ConnectionsWorkspaceProps {
  connections: ConnectionConfig[];
  pinnedConnectionIds: string[];
  previousConnectionId: string | null;
  onConnect: (connection: ConnectionConfig) => Promise<void> | void;
  onOpenInNewWindow: (connectionId: string) => void;
  onEdit: (connectionId: string) => void;
  onRename: (connectionId: string, currentName: string) => void;
  onDelete: (connectionId: string) => void;
  onDuplicate: (connection: ConnectionConfig) => void;
  onCopyUrl: (connection: ConnectionConfig) => void;
  onTogglePin: (connectionId: string) => void;
  onAddNew: () => void;
  onBackToPrevious: () => void;
}

type ViewMode = "grid" | "list";

export function ConnectionsWorkspace({
  connections,
  pinnedConnectionIds,
  previousConnectionId,
  onConnect,
  onOpenInNewWindow,
  onEdit,
  onRename,
  onDelete,
  onDuplicate,
  onCopyUrl,
  onTogglePin,
  onAddNew,
  onBackToPrevious,
}: ConnectionsWorkspaceProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nodadb-connections-view-mode");
      if (saved === "grid" || saved === "list") return saved;
    }
    return connections.length > 5 ? "grid" : "grid";
  });

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("nodadb-connections-view-mode", mode);
    } catch {
      // Ignore localStorage errors
    }
  };

  const sortedConnections = useMemo(() => {
    return [
      ...connections.filter((c) => pinnedConnectionIds.includes(c.id)),
      ...connections.filter((c) => !pinnedConnectionIds.includes(c.id)),
    ];
  }, [connections, pinnedConnectionIds]);

  const filteredConnections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedConnections;

    return sortedConnections.filter((conn) => {
      const nameMatch = conn.name.toLowerCase().includes(q);
      const dbTypeMatch = conn.db_type.toLowerCase().includes(q);
      const providerMatch = conn.provider?.toLowerCase().includes(q);
      const hostMatch = conn.host?.toLowerCase().includes(q);
      const dbMatch = conn.database?.toLowerCase().includes(q);
      const pathMatch = conn.file_path?.toLowerCase().includes(q);
      return (
        nameMatch ||
        dbTypeMatch ||
        providerMatch ||
        hostMatch ||
        dbMatch ||
        pathMatch
      );
    });
  }, [sortedConnections, searchQuery]);

  const previousConnection = useMemo(() => {
    if (!previousConnectionId) return null;
    return connections.find((c) => c.id === previousConnectionId) || null;
  }, [connections, previousConnectionId]);

  const formatDbBadge = (conn: ConnectionConfig): string => {
    if (conn.provider) {
      const map: Record<string, string> = {
        supabase: "Supabase",
        neon: "Neon",
        mariadb: "MariaDB",
        planetscale: "PlanetScale",
        planetscale_postgres: "PlanetScale",
        prisma: "Prisma",
        turso: "Turso",
        valtown: "Val Town",
        cloudflare: "Cloudflare D1",
      };
      return map[conn.provider] ?? conn.provider;
    }
    switch (conn.db_type) {
      case "mongodb":
        return "MongoDB";
      case "clickhouse":
        return "ClickHouse";
      case "libsql":
        return "LibSQL";
      case "redis":
        return "Redis";
      default:
        return conn.db_type.toUpperCase();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Top Header Bar */}
      <header
        data-tauri-drag-region
        className="h-14 border-b border-border bg-card/60 backdrop-blur px-6 flex items-center justify-between gap-4 shrink-0"
      >
        <div className="flex items-center gap-3">
          {previousConnection && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackToPrevious}
              className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to {previousConnection.name}</span>
            </Button>
          )}
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-foreground tracking-tight">
              Connections
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
              {connections.length}
            </span>
          </div>
        </div>

        {/* Center/Right Toolbar */}
        <div className="flex items-center gap-2.5">
          {/* Search Box */}
          <div className="relative w-52 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search connections..."
              className="h-8 pl-8 pr-7 text-xs bg-background/80"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-md border border-border bg-background/50 p-0.5">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => handleSetViewMode("grid")}
              className="h-7 w-7 rounded-sm"
              title="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => handleSetViewMode("list")}
              className="h-7 w-7 rounded-sm"
              title="List view"
            >
              <ListIcon className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* New Connection Button */}
          <Button onClick={onAddNew} size="sm" className="h-8 gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            <span>New Connection</span>
          </Button>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto px-6 py-6 md:px-10">
        <div className="max-w-6xl mx-auto w-full">
          {filteredConnections.length === 0 ? (
            <div className="text-center py-16">
              <Database className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <h3 className="text-sm font-semibold text-foreground mb-1">
                No connections found
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                No database matches &ldquo;{searchQuery}&rdquo;
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="text-xs h-8"
              >
                Clear Search
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            /* ================= GRID VIEW ================= */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredConnections.map((conn) => {
                const isPinned = pinnedConnectionIds.includes(conn.id);
                return (
                  <div
                    key={conn.id}
                    className={`relative group rounded-xl border bg-card text-card-foreground hover:border-primary/60 hover:shadow-sm transition-all duration-150 flex flex-col justify-between p-4 ${
                      isPinned ? "border-primary/40 bg-primary/[0.02]" : "border-border"
                    }`}
                  >
                    {/* Top Row: Icon + Name + Actions */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <button
                        type="button"
                        onClick={() => void onConnect(conn)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left"
                      >
                        <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                          <DbIcon
                            dbType={conn.db_type}
                            provider={conn.provider}
                            className="h-5 w-5"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                              {conn.name}
                            </span>
                            {isPinned && (
                              <span
                                className="inline-flex items-center shrink-0 text-primary"
                                title="Pinned"
                              >
                                <Pin className="h-3 w-3 fill-primary/20" />
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">
                            {conn.file_path ||
                              (conn.host
                                ? `${conn.host}${conn.port ? `:${conn.port}` : ""}${conn.database ? ` / ${conn.database}` : ""}`
                                : "Default")}
                          </p>
                        </div>
                      </button>

                      {/* Dropdown Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => e.stopPropagation()}
                            className="h-7 w-7 opacity-50 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => onTogglePin(conn.id)}>
                            {isPinned ? (
                              <>
                                <PinOff className="h-3.5 w-3.5 mr-2" />
                                Unpin from Home
                              </>
                            ) : (
                              <>
                                <Pin className="h-3.5 w-3.5 mr-2" />
                                Pin to Home
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onOpenInNewWindow(conn.id)}
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-2" />
                            Open in New Window
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(conn.id)}>
                            <Edit className="h-3.5 w-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onRename(conn.id, conn.name)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onCopyUrl(conn)}>
                            <Copy className="h-3.5 w-3.5 mr-2" />
                            Copy URL
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDuplicate(conn)}>
                            <Copy className="h-3.5 w-3.5 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDelete(conn.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Bottom Row: Badge + Quick Connect */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-secondary/70 text-secondary-foreground font-mono text-[10px] uppercase tracking-wider">
                        {formatDbBadge(conn)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void onConnect(conn)}
                        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/10"
                      >
                        Connect &rarr;
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Add New Connection Card */}
              {!searchQuery && (
                <button
                  type="button"
                  onClick={onAddNew}
                  className="rounded-xl border-2 border-dashed border-border/80 hover:border-primary/80 hover:bg-accent/40 transition-all duration-150 flex flex-col items-center justify-center p-5 text-center min-h-[110px] group"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform mb-2">
                    <Plus className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    Add New Connection
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    Connect to a database
                  </span>
                </button>
              )}
            </div>
          ) : (
            /* ================= LIST VIEW ================= */
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {filteredConnections.map((conn) => {
                const isPinned = pinnedConnectionIds.includes(conn.id);
                return (
                  <div
                    key={conn.id}
                    onClick={() => void onConnect(conn)}
                    className={`flex items-center justify-between px-4 py-3 hover:bg-accent/50 cursor-pointer transition-colors group ${
                      isPinned ? "bg-primary/[0.015]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-8 w-8 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <DbIcon
                          dbType={conn.db_type}
                          provider={conn.provider}
                          className="h-4 w-4"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                            {conn.name}
                          </span>
                          {isPinned && (
                            <span
                              className="inline-flex items-center text-primary"
                              title="Pinned"
                            >
                              <Pin className="h-3 w-3 fill-primary/20" />
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono text-[10px] uppercase">
                            {formatDbBadge(conn)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate font-mono mt-0.5">
                          {conn.file_path ||
                            (conn.host
                              ? `${conn.host}${conn.port ? `:${conn.port}` : ""}${conn.database ? ` / ${conn.database}` : ""}`
                              : "Default")}
                        </p>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-2 ml-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void onConnect(conn)}
                        className="h-7 px-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Connect
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => onTogglePin(conn.id)}>
                            {isPinned ? (
                              <>
                                <PinOff className="h-3.5 w-3.5 mr-2" />
                                Unpin from Home
                              </>
                            ) : (
                              <>
                                <Pin className="h-3.5 w-3.5 mr-2" />
                                Pin to Home
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onOpenInNewWindow(conn.id)}
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-2" />
                            Open in New Window
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(conn.id)}>
                            <Edit className="h-3.5 w-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onRename(conn.id, conn.name)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onCopyUrl(conn)}>
                            <Copy className="h-3.5 w-3.5 mr-2" />
                            Copy URL
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDuplicate(conn)}>
                            <Copy className="h-3.5 w-3.5 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDelete(conn.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
