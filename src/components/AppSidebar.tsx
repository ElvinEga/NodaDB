import { Database, FileCode2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { DatabaseExplorer } from "@/components/DatabaseExplorer";
import { ConnectionConfig, DatabaseTable } from "@/types";

interface AppSidebarProps {
  connection: ConnectionConfig;
  onTableSelect: (table: DatabaseTable) => void;
  selectedTable: DatabaseTable | null;
  onNewQuery: () => void;
}

export function AppSidebar({
  connection,
  onTableSelect,
  selectedTable,
  onNewQuery,
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" tooltip="New Query">
              {/* Logo & App Name */}
              <div className="flex items-center gap-4">
                {/* <Database className="h-5 w-5 text-primary" /> */}
                <img src="/logo.svg" alt="NodaDB Logo" className="h-5 w-5" />
                <h1 className="text-lg font-bold text-primary">NodaDB</h1>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
