import { FileCode2 } from "lucide-react";
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
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              onClick={onNewQuery}
              tooltip="New Query"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <FileCode2 className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">New Query</span>
                <span className="text-xs text-muted-foreground">Execute SQL</span>
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
