import * as React from "react";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  Plus,
  X,
  Save,
  Copy,
  Clipboard,
  Scissors,
  Undo2,
  Redo2,
  Search,
  Replace,
  Maximize2,
  Minimize2,
  PanelLeft,
  History,
  Moon,
  Sun,
  Keyboard,
  BookOpen,
  Info,
  ExternalLink,
  FolderOpen,
  Database,
  Table,
  FileCode2,
  Layout,
  MousePointer,
} from "lucide-react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function MenuBar() {
  const [isWindowMaximized, setIsWindowMaximized] = React.useState(false);

  React.useEffect(() => {
    const checkMaximized = async () => {
      try {
        const current = await getCurrentWindow();
        const maximized = await current.isMaximized();
        setIsWindowMaximized(maximized);
      } catch (error) {
        console.error("Failed to check window state:", error);
      }
    };
    checkMaximized();
  }, []);

  const handleNewWindow = React.useCallback(async () => {
    try {
      await invoke("create_new_window");
      toast.success("New window opened");
    } catch (error) {
      console.log("Creating new window via command:", error);
      try {
        const label = `nodadb-${Date.now()}`;
        await invoke("create_window_from_label", { label });
        toast.success("New window opened");
      } catch (e) {
        console.error("Failed to create new window:", e);
        // @ts-ignore - import.meta.env is available in Vite
        if (import.meta.env?.DEV) {
          window.open("/", "_blank");
          toast.success("Opened new tab");
        } else {
          toast.error("Failed to create new window");
        }
      }
    }
  }, []);

  const handleCloseWindow = React.useCallback(async () => {
    try {
      const current = await getCurrentWindow();
      await current.close();
    } catch (error) {
      console.error("Failed to close window:", error);
    }
  }, []);

  const handleMaximizeWindow = React.useCallback(async () => {
    try {
      const current = await getCurrentWindow();
      const maximized = await current.isMaximized();
      if (maximized) {
        await current.unmaximize();
        setIsWindowMaximized(false);
      } else {
        await current.maximize();
        setIsWindowMaximized(true);
      }
    } catch (error) {
      console.error("Failed to maximize window:", error);
    }
  }, []);

  const handleMinimizeWindow = React.useCallback(async () => {
    try {
      const current = await getCurrentWindow();
      await current.minimize();
    } catch (error) {
      console.error("Failed to minimize window:", error);
    }
  }, []);

  const handleSaveQuery = React.useCallback(() => {
    toast.info("Save query - implement as needed");
  }, []);

  const handleExportData = React.useCallback(() => {
    toast.info("Export data - implement as needed");
  }, []);

  const handleUndo = React.useCallback(() => {
    document.execCommand("undo");
  }, []);

  const handleRedo = React.useCallback(() => {
    document.execCommand("redo");
  }, []);

  const handleCut = React.useCallback(() => {
    document.execCommand("cut");
  }, []);

  const handleCopy = React.useCallback(() => {
    document.execCommand("copy");
  }, []);

  const handlePaste = React.useCallback(() => {
    document.execCommand("paste");
  }, []);

  const handleSelectAll = React.useCallback(() => {
    document.execCommand("selectAll");
  }, []);

  const handleFind = React.useCallback(() => {
    toast.info("Find in page - Ctrl+F");
  }, []);

  const handleReplace = React.useCallback(() => {
    toast.info("Find and replace - Ctrl+H");
  }, []);

  const handleToggleDarkMode = React.useCallback(() => {
    document.documentElement.classList.toggle("dark");
    const isDark = document.documentElement.classList.contains("dark");
    toast.success(isDark ? "Switched to light mode" : "Switched to dark mode");
  }, []);

  return (
    <Menubar className="rounded-none border-0 border-b bg-card px-0 h-9 font-normal">
      <MenubarMenu>
        <MenubarTrigger className="font-normal">File</MenubarTrigger>
        <MenubarContent className="font-normal">
          <MenubarItem onSelect={() => invoke("open_connection_dialog")}>
            <Plus className="mr-2 h-4 w-4" />
            New Connection
            <MenubarShortcut>Ctrl+Shift+N</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onSelect={() => invoke("open_new_query_tab")}>
            <FileCode2 className="mr-2 h-4 w-4" />
            New Query
            <MenubarShortcut>Ctrl+N</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onSelect={handleNewWindow}>
            <Layout className="mr-2 h-4 w-4" />
            New Window
            <MenubarShortcut>Ctrl+Shift+W</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onSelect={handleSaveQuery}>
            <Save className="mr-2 h-4 w-4" />
            Save Query
            <MenubarShortcut>Ctrl+S</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onSelect={handleExportData}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Export Data
            <MenubarShortcut>Ctrl+E</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onSelect={handleCloseWindow}>
            <X className="mr-2 h-4 w-4" />
            Close Window
            <MenubarShortcut>Alt+F4</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="font-normal">Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onSelect={handleUndo}>
            <Undo2 className="mr-2 h-4 w-4" />
            Undo
            <MenubarShortcut>Ctrl+Z</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onSelect={handleRedo}>
            <Redo2 className="mr-2 h-4 w-4" />
            Redo
            <MenubarShortcut>Ctrl+Y</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onSelect={handleCut}>
            <Scissors className="mr-2 h-4 w-4" />
            Cut
            <MenubarShortcut>Ctrl+X</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onSelect={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
            <MenubarShortcut>Ctrl+C</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onSelect={handlePaste}>
            <Clipboard className="mr-2 h-4 w-4" />
            Paste
            <MenubarShortcut>Ctrl+V</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onSelect={handleFind}>
            <Search className="mr-2 h-4 w-4" />
            Find
            <MenubarShortcut>Ctrl+F</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onSelect={handleReplace}>
            <Replace className="mr-2 h-4 w-4" />
            Replace
            <MenubarShortcut>Ctrl+H</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onSelect={handleSelectAll}>
            <MousePointer className="mr-2 h-4 w-4" />
            Select All
            <MenubarShortcut>Ctrl+A</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="font-normal">Selection</MenubarTrigger>
        <MenubarContent className="font-normal">
          <MenubarItem onSelect={() => toast.info("Expand selection")}>
            <MousePointer className="mr-2 h-4 w-4" />
            Expand Selection
            <MenubarShortcut>Shift+Alt+→</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onSelect={() => toast.info("Shrink selection")}>
            <MousePointer className="mr-2 h-4 w-4" />
            Shrink Selection
            <MenubarShortcut>Shift+Alt+←</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onSelect={() => toast.info("Copy line up")}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Line Up
            <MenubarShortcut>Shift+Alt+↑</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onSelect={() => toast.info("Copy line down")}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Line Down
            <MenubarShortcut>Shift+Alt+↓</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onSelect={() => toast.info("Move line up")}>
            <Undo2 className="mr-2 h-4 w-4" />
            Move Line Up
            <MenubarShortcut>Alt+↑</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onSelect={() => toast.info("Move line down")}>
            <Redo2 className="mr-2 h-4 w-4" />
            Move Line Down
            <MenubarShortcut>Alt+↓</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onSelect={() => toast.info("Column selection")}>
            <Table className="mr-2 h-4 w-4" />
            Column Selection
            <MenubarShortcut>Shift+Alt+Drag</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="font-normal">View</MenubarTrigger>
        <MenubarContent className="font-normal">
          <MenubarItem onSelect={() => invoke("open_query_builder")}>
            <Database className="mr-2 h-4 w-4" />
            Query Builder
            <MenubarShortcut>Ctrl+B</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onSelect={() => invoke("open_schema_designer")}>
            <Table className="mr-2 h-4 w-4" />
            Schema Designer
            <MenubarShortcut>Ctrl+Shift+E</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onSelect={() => invoke("toggle_sidebar")}>
            <PanelLeft className="mr-2 h-4 w-4" />
            Sidebar
            <MenubarShortcut>Ctrl+B</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onSelect={() => invoke("toggle_query_history")}>
            <History className="mr-2 h-4 w-4" />
            Query History
            <MenubarShortcut>Ctrl+Shift+H</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onSelect={handleMaximizeWindow}>
            {isWindowMaximized ? (
              <Minimize2 className="mr-2 h-4 w-4" />
            ) : (
              <Maximize2 className="mr-2 h-4 w-4" />
            )}
            {isWindowMaximized ? "Restore Down" : "Maximize"}
            <MenubarShortcut>Ctrl+Shift+M</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onSelect={handleMinimizeWindow}>
            <Minimize2 className="mr-2 h-4 w-4" />
            Minimize
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onSelect={handleToggleDarkMode}>
            {document.documentElement.classList.contains("dark") ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            {document.documentElement.classList.contains("dark")
              ? "Light Mode"
              : "Dark Mode"}
            <MenubarShortcut>Ctrl+Shift+D</MenubarShortcut>
          </MenubarItem>
          <MenubarSub>
            <MenubarSubTrigger>
              <Layout className="mr-2 h-4 w-4" />
              Appearance
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem onSelect={() => toast.info("Compact view")}>
                Compact
              </MenubarItem>
              <MenubarItem onSelect={() => toast.info("Comfortable view")}>
                Comfortable
              </MenubarItem>
              <MenubarItem onSelect={() => toast.info("Spacious view")}>
                Spacious
              </MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="font-normal">Help</MenubarTrigger>
        <MenubarContent className="font-normal">
          <MenubarItem onSelect={() => invoke("show_keyboard_shortcuts")}>
            <Keyboard className="mr-2 h-4 w-4" />
            Keyboard Shortcuts
            <MenubarShortcut>Ctrl+?</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onSelect={() => invoke("open_documentation")}>
            <BookOpen className="mr-2 h-4 w-4" />
            Documentation
          </MenubarItem>
          <MenubarItem onSelect={() => invoke("open_github")}>
            <ExternalLink className="mr-2 h-4 w-4" />
            GitHub Repository
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem
            onSelect={() =>
              toast.info(
                "NodaDB v0.1.2\n\nA modern database management tool built with Tauri 2, React, and Rust."
              )
            }
          >
            <Info className="mr-2 h-4 w-4" />
            About NodaDB
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <div className="flex-1" />

      <div className="flex items-center pr-2">
        {/* <button
          onClick={handleMinimizeWindow}
          className="p-2 hover:bg-accent rounded-sm transition-colors"
          title="Minimize"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
        <button
          onClick={handleMaximizeWindow}
          className="p-2 hover:bg-accent rounded-sm transition-colors"
          title={isWindowMaximized ? "Restore Down" : "Maximize"}
        >
          {isWindowMaximized ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={handleCloseWindow}
          className="p-2 hover:bg-destructive hover:text-destructive-foreground rounded-sm transition-colors"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button> */}
      </div>
    </Menubar>
  );
}
