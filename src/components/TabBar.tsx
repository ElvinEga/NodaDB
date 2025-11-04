import {
  FileCode2,
  Table2,
  X,
  Pin,
  Copy,
  XCircle,
  Network,
  Shapes,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DatabaseTable, TableColumn } from "@/types";

export type TabType = {
  id: string;
  type: "table" | "query" | "query-builder" | "schema";
  title: string;
  table?: DatabaseTable;
  columns?: TableColumn[];
  isPinned: boolean;
  isDirty: boolean;
  queryContent?: string;
  lastModified?: Date;
};

interface TabBarProps {
  tabs: TabType[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabPin: (tabId: string) => void;
  onTabDuplicate: (tabId: string) => void;
  onCloseOthers: (tabId: string) => void;
  onCloseAll: () => void;
  onCloseToRight: (tabId: string) => void;
}

export function TabBar({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onTabPin,
  onTabDuplicate,
  onCloseOthers,
  onCloseAll,
  onCloseToRight,
}: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="h-10 border-b border-border bg-card flex items-center px-2 gap-1 overflow-x-auto scrollbar-thin">
      {tabs.map((tab) => (
        <ContextMenu key={tab.id}>
          <ContextMenuTrigger>
            <button
              onClick={() => onTabClick(tab.id)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-none text-sm whitespace-nowrap
                transition-colors duration-150 min-w-[120px] max-w-[200px] border-r-2
                ${
                  activeTabId === tab.id
                    ? "bg-secondary text-foreground font-extrabold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
            >
              {tab.isPinned && <Pin className="h-3 w-3 flex-shrink-0" />}
              {tab.isDirty && (
                <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
              )}
              {tab.type === "table" ? (
                <Table2 className="h-3.5 w-3.5 flex-shrink-0" />
              ) : tab.type === "query-builder" ? (
                <Network className="h-3.5 w-3.5 flex-shrink-0" />
              ) : tab.type === "schema" ? (
                <Shapes className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <FileCode2 className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              <span className="truncate flex-1">{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }}
                  className="ml-1 hover:bg-border rounded p-0.5 flex-shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </button>
          </ContextMenuTrigger>

          <ContextMenuContent>
            <ContextMenuItem onClick={() => onTabClose(tab.id)}>
              <X className="mr-2 h-4 w-4" />
              Close Tab
              <span className="ml-auto text-xs text-muted-foreground">
                Ctrl+W
              </span>
            </ContextMenuItem>

            <ContextMenuItem onClick={() => onCloseOthers(tab.id)}>
              <XCircle className="mr-2 h-4 w-4" />
              Close Other Tabs
            </ContextMenuItem>

            <ContextMenuItem onClick={() => onCloseToRight(tab.id)}>
              <XCircle className="mr-2 h-4 w-4" />
              Close Tabs to the Right
            </ContextMenuItem>

            <ContextMenuItem onClick={onCloseAll}>
              <XCircle className="mr-2 h-4 w-4" />
              Close All Tabs
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem onClick={() => onTabPin(tab.id)}>
              <Pin className="mr-2 h-4 w-4" />
              {tab.isPinned ? "Unpin Tab" : "Pin Tab"}
            </ContextMenuItem>

            {tab.type === "query" && (
              <ContextMenuItem onClick={() => onTabDuplicate(tab.id)}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate Tab
              </ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </div>
  );
}
