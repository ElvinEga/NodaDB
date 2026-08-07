import { Check, ChevronDown } from "lucide-react";
import { DbIcon } from "@/components/DbIcon";
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
  onOpenQueryBuilder?: () => void;
}

export function AppSidebar({
  connection,
  recentConnections,
  onConnectToConnection,
  onOpenConnectionSwitcher,
  onTableSelect,
  selectedTable,
  onNewQuery,
  onOpenQueryBuilder,
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarHeader data-tauri-drag-region className="p-0 pl-20">
        {/* Connection Selector Header */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-secondary"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <DbIcon dbType={connection.db_type} className="h-4 w-4 shrink-0" />
                <span className="truncate text-xs font-semibold">{connection.name}</span>
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
                    className={`items-start py-2 cursor-pointer ${isActive ? 'bg-primary/20' : ''}`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <div className="pt-0.5 flex items-center gap-1.5">
                        <DbIcon dbType={conn.db_type} className="h-4 w-4 shrink-0" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {conn.name}
                          </span>
                        </div>
                      </div>
                        {isActive && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
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
          onOpenQueryBuilder={onOpenQueryBuilder}
        />
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
