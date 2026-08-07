import { useRef, useEffect, useState } from "react";
import {
  FileCode2,
  Table2,
  X,
  Pin,
  Copy,
  XCircle,
  Network,
  Shapes,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator as DropdownSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { DatabaseTable, TableColumn, TabFilter } from "@/types";

export type TabType = {
  id: string;
  type: "table" | "query" | "query-builder" | "schema" | "relation-flow";
  title: string;
  table?: DatabaseTable;
  columns?: TableColumn[];
  isPinned: boolean;
  isDirty: boolean;
  queryContent?: string;
  lastModified?: Date;
  initialFilters?: TabFilter[];
  relationFlowValue?: string;
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check overflow state to toggle left/right scroll buttons
  const checkOverflow = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  };

  useEffect(() => {
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [tabs]);

  // Scroll active tab into view when activeTabId changes
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
    checkOverflow();
  }, [activeTabId]);

  if (tabs.length === 0) return null;

  const scrollByAmount = (amount: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  return (
    <div className="relative flex items-center h-10 w-full min-w-0 border-b border-border bg-card select-none">
      {/* Scroll Left Button */}
      {canScrollLeft && (
        <Button
          variant="ghost"
          size="icon"
          className="h-full w-7 rounded-none border-r border-border shrink-0 z-10 bg-card hover:bg-muted"
          onClick={() => scrollByAmount(-160)}
          title="Scroll tabs left"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Tabs Strip Container */}
      <div
        ref={scrollContainerRef}
        onScroll={checkOverflow}
        onWheel={(e) => {
          if (e.deltaY !== 0 && scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft += e.deltaY;
          }
        }}
        className="flex-1 flex items-center overflow-x-auto scrollbar-none h-full min-w-0"
      >
        {tabs.map((tab) => {
          const isActive = activeTabId === tab.id;
          return (
            <ContextMenu key={tab.id}>
              <ContextMenuTrigger asChild>
                <button
                  ref={isActive ? activeTabRef : null}
                  onClick={() => onTabClick(tab.id)}
                  className={`
                    group flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap h-full
                    transition-all border-r border-border min-w-[36px] max-w-[180px] shrink-0 sm:shrink flex-1
                    ${
                      isActive
                        ? "bg-secondary text-foreground font-extrabold border-b-2 border-b-primary"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    }
                  `}
                >
                  {tab.isPinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                  {tab.isDirty && (
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                  {tab.type === "table" ? (
                    <Table2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : tab.type === "query-builder" ? (
                    <Network className="h-3.5 w-3.5 shrink-0 text-purple-400" />
                  ) : tab.type === "schema" ? (
                    <Shapes className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <FileCode2 className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  )}
                  <span className="truncate flex-1 text-left">{tab.title}</span>
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTabClose(tab.id);
                      }}
                      className="ml-1 opacity-60 group-hover:opacity-100 hover:bg-muted-foreground/20 rounded p-0.5 shrink-0 transition-opacity"
                      title="Close tab"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </button>
              </ContextMenuTrigger>

              <ContextMenuContent className="w-52">
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
          );
        })}
      </div>

      {/* Scroll Right Button */}
      {canScrollRight && (
        <Button
          variant="ghost"
          size="icon"
          className="h-full w-7 rounded-none border-l border-border shrink-0 z-10 bg-card hover:bg-muted"
          onClick={() => scrollByAmount(160)}
          title="Scroll tabs right"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Quick Tab Switcher Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-full w-8 rounded-none border-l border-border shrink-0 bg-card hover:bg-muted"
            title="Open tabs list"
          >
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 max-h-80 overflow-y-auto">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center justify-between border-b border-border mb-1">
            <span>Open Tabs ({tabs.length})</span>
            <button
              onClick={onCloseAll}
              className="text-[10px] text-destructive hover:underline"
            >
              Close All
            </button>
          </div>
          {tabs.map((tab) => (
            <DropdownMenuItem
              key={tab.id}
              onClick={() => onTabClick(tab.id)}
              className="flex items-center gap-2 text-xs py-1.5 cursor-pointer"
            >
              {tab.type === "table" ? (
                <Table2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              ) : tab.type === "query-builder" ? (
                <Network className="h-3.5 w-3.5 text-purple-400 shrink-0" />
              ) : tab.type === "schema" ? (
                <Shapes className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              ) : (
                <FileCode2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              )}
              <span className="truncate flex-1 font-medium">{tab.title}</span>
              {activeTabId === tab.id && (
                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
