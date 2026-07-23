import { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  DatabaseZap,
  HelpCircle,
  History,
  Minus,
  Network,
  Plus,
  Settings,
  Shapes,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KeyboardTooltip } from "@/components/ui/keyboard-tooltip";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ConnectionConfig } from "@/types";

interface WindowTitleBarProps {
  connection: ConnectionConfig;
  showHistoryPanel: boolean;
  onSwitchConnection: () => void;
  onOpenQueryBuilder: () => void;
  onOpenSchemaDesigner: () => void;
  onOpenNewConnection: () => void;
  onToggleHistory: () => void;
  onOpenShortcuts: () => void;
  onOpenSettings: () => void;
}

export function WindowTitleBar({
  connection,
  showHistoryPanel,
  onSwitchConnection,
  onOpenQueryBuilder,
  onOpenSchemaDesigner,
  onOpenNewConnection,
  onToggleHistory,
  onOpenShortcuts,
  onOpenSettings,
}: WindowTitleBarProps) {
  const handleDragMouseDown = useCallback(
    async (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      try {
        const appWindow = getCurrentWindow();
        if (event.detail === 2) {
          await appWindow.toggleMaximize();
          return;
        }

        await appWindow.startDragging();
      } catch (error) {
        console.error("Failed to start window drag:", error);
      }
    },
    [],
  );

  const handleMinimize = useCallback(async () => {
    try {
      await getCurrentWindow().minimize();
    } catch (error) {
      console.error("Failed to minimize window:", error);
    }
  }, []);

  const handleToggleMaximize = useCallback(async () => {
    try {
      await getCurrentWindow().toggleMaximize();
    } catch (error) {
      console.error("Failed to toggle maximize:", error);
    }
  }, []);

  const handleClose = useCallback(async () => {
    try {
      await getCurrentWindow().close();
    } catch (error) {
      console.error("Failed to close window:", error);
    }
  }, []);

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4 text-foreground">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>

      <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-1 text-sm">
        <div className="h-2 w-2 animate-pulse rounded-full bg-green-500/50" />
        <span className="text-sm">{connection.name}</span>
        <span className="text-xs text-muted-foreground">
          ({connection.db_type})
        </span>
      </div>

      <div className="flex items-center">
        <KeyboardTooltip description="Switch Connection" keys={["Ctrl", "Shift", "C"]}>
          <Button variant="ghost" onClick={onSwitchConnection}>
            <DatabaseZap className="h-4 w-4" />
            Switch
          </Button>
        </KeyboardTooltip>
      </div>

      <div
        data-tauri-drag-region
        onMouseDown={handleDragMouseDown}
        className="drag-region flex h-full min-w-8 flex-1 cursor-grab items-center active:cursor-grabbing"
      >
        <div className="w-full select-none text-center text-xs text-muted-foreground">
          NodaDB
        </div>
      </div>

      <div className="flex items-center gap-1">
        <KeyboardTooltip description="Open Visual Query Builder" keys={["Ctrl", "B"]}>
          <Button variant="ghost" size="icon" onClick={onOpenQueryBuilder}>
            <Network className="h-4 w-4" />
          </Button>
        </KeyboardTooltip>
        <KeyboardTooltip description="Open Schema Designer" keys={["Ctrl", "Shift", "E"]}>
          <Button variant="ghost" size="icon" onClick={onOpenSchemaDesigner}>
            <Shapes className="h-4 w-4" />
          </Button>
        </KeyboardTooltip>
        <KeyboardTooltip description="New Connection">
          <Button variant="ghost" size="icon" onClick={onOpenNewConnection}>
            <Plus className="h-4 w-4" />
          </Button>
        </KeyboardTooltip>
        <KeyboardTooltip description="Query History">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleHistory}
            className={showHistoryPanel ? "bg-muted" : ""}
          >
            <History className="h-4 w-4" />
          </Button>
        </KeyboardTooltip>
        <KeyboardTooltip description="Keyboard Shortcuts" keys={["Ctrl", "?"]}>
          <Button variant="ghost" size="icon" onClick={onOpenShortcuts}>
            <HelpCircle className="h-4 w-4" />
          </Button>
        </KeyboardTooltip>
        <KeyboardTooltip description="Settings" keys={["Ctrl", ","]}>
          <Button variant="ghost" size="icon" onClick={onOpenSettings}>
            <Settings className="h-4 w-4" />
          </Button>
        </KeyboardTooltip>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={handleMinimize}>
          <Minus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleToggleMaximize}>
          <Square className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-destructive hover:text-destructive-foreground"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

