import { Database, Check, ChevronDown } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DatabaseExplorer } from "@/components/DatabaseExplorer";
import { ConnectionConfig, DatabaseTable } from "@/types";

interface AppSidebarProps {
  connection: ConnectionConfig;
  recentConnections: ConnectionConfig[];
  onConnectToConnection: (connection: ConnectionConfig) => void;
  onOpenConnectionSwitcher: () => void;
  onTableSelect: (table: DatabaseTable) => void;
  selectedTable: DatabaseTable | null;
  onNewQuery: () => void;
}

export function AppSidebar({
  connection,
  recentConnections,
  onConnectToConnection,
  onOpenConnectionSwitcher,
  onTableSelect,
  selectedTable,
  onNewQuery,
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarHeader data-tauri-drag-region className="border-b border-border p-2">
        {/* Connection Selector Header */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-md bg-secondary/80 px-3 py-2 text-sm transition-colors hover:bg-secondary border border-border/50"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="h-2 w-2 shrink-0 rounded-full bg-green-500/80 animate-pulse" />
                <span className="truncate text-sm font-semibold">{connection.name}</span>
                <span className="shrink-0 text-muted-foreground text-xs font-mono">
                  ({connection.db_type})
                </span>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 z-[120]">
            <DropdownMenuLabel>Recent Connections</DropdownMenuLabel>
            {recentConnections.length > 0 ? (
              recentConnections.map((conn) => {
                const isActive = conn.id === connection.id;

                return (
                  <DropdownMenuItem
                    key={conn.id}
                    onClick={() => {
                      if (!isActive) {
                        onConnectToConnection(conn);
                      }
                    }}
                    className="items-start py-2 cursor-pointer"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <div className="pt-0.5">
                        {isActive ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <Database className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {conn.name}
                          </span>
                          {isActive && (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground font-mono">
                          {conn.db_type.toUpperCase()}
                          {conn.file_path
                            ? ` • ${conn.file_path}`
                            : conn.host
                              ? ` • ${conn.host}:${conn.port}`
                              : ""}
                        </div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })
            ) : (
              <div className="px-2 py-3 text-sm text-muted-foreground">
                No recent connections yet.
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onOpenConnectionSwitcher}
              className="cursor-pointer"
            >
              Browse all connections
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        <DatabaseExplorer
          connection={connection}
          onTableSelect={onTableSelect}
          selectedTable={selectedTable}
          onNewQuery={onNewQuery}
        />
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
