import { DbIcon } from "@/components/DbIcon";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Database,
  Plus,
  Settings,
  FileCode2,
  HelpCircle,
  History,
  Network,
  Shapes,
  Trash2,
  MoreVertical,
  Pencil,
  ArrowLeft,
  Check,
  ChevronDown,
  Pin,
  PinOff,
  Copy,
  Edit,
  Terminal,
  Keyboard,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { ConnectionDialog } from "@/components/ConnectionDialog";
import { KeyboardShortcutsDialog } from "@/components/KeyboardShortcutsDialog";
import { KeyboardCheatSheet } from "@/components/KeyboardCheatSheet";
import { CommandPalette, type PaletteCommand } from "@/components/CommandPalette";
import { AgentsPanel } from "@/components/AgentsPanel";
import { SettingsDialog } from "@/components/SettingsDialog";
import { AboutDialog } from "@/components/AboutDialog";
import { QueryHistoryPanel } from "@/components/QueryHistoryPanel";
import { MenuBar } from "@/components/MenuBar";
import { AppSidebar } from "@/components/AppSidebar";
import { TableSkeleton } from "@/components/TableSkeleton";
import { QueryEditor } from "@/components/QueryEditor";
import { VisualQueryBuilder } from "@/components/VisualQueryBuilder";
import { SchemaDesigner } from "@/components/SchemaDesigner";
import { useConnectionStore } from "@/stores/connectionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { buildCommandRegistry } from "@/lib/commandRegistry";
import { Toaster, toast } from "sonner";
import { TabBar, type TabType } from "@/components/TabBar";
import { useTabKeyboardShortcuts } from "@/hooks/useTabKeyboardShortcuts";
import { KeyboardTooltip } from "@/components/ui/keyboard-tooltip";
import { DatabaseTable, TableColumn, ConnectionConfig } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TanStackTableViewer } from "./components/TanStackTableViewer";
import RelationFlow from "./components/RelationFlow";
import { OPEN_ABOUT_EVENT } from "@/lib/appEvents";
import { useAppUpdate } from "@/hooks/useAppUpdate";

function App() {
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [deleteConnectionId, setDeleteConnectionId] = useState<string | null>(
    null,
  );
  const [renameConnectionId, setRenameConnectionId] = useState<string | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState("");
  const [editConnectionId, setEditConnectionId] = useState<string | null>(null);
  const { fontFamily, fontSize, colorTheme } = useSettingsStore();
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [agentsPanelOpen, setAgentsPanelOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tabs, setTabs] = useState<TabType[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const connections = useConnectionStore((state) => state.connections);
  const activeConnectionId = useConnectionStore(
    (state) => state.activeConnectionId,
  );
  const setActiveConnection = useConnectionStore(
    (state) => state.setActiveConnection,
  );
  const previousConnectionId = useConnectionStore(
    (state) => state.previousConnectionId,
  );
  const recentConnectionIds = useConnectionStore(
    (state) => state.recentConnectionIds,
  );
  const openConnectionSwitcher = useConnectionStore(
    (state) => state.openConnectionSwitcher,
  );
  const restorePreviousConnection = useConnectionStore(
    (state) => state.restorePreviousConnection,
  );
  const getActiveConnection = useConnectionStore(
    (state) => state.getActiveConnection,
  );
  const removeConnection = useConnectionStore(
    (state) => state.removeConnection,
  );
  const updateConnection = useConnectionStore(
    (state) => state.updateConnection,
  );
  const pinnedConnectionIds = useConnectionStore(
    (state) => state.pinnedConnectionIds,
  );
  const togglePinConnection = useConnectionStore(
    (state) => state.togglePinConnection,
  );
  const setAutoCheckForUpdates = useSettingsStore(
    (state) => state.setAutoCheckForUpdates,
  );
  const autoCheckForUpdates = useSettingsStore(
    (state) => state.autoCheckForUpdates,
  );
  const appUpdate = useAppUpdate();

  const activeConnection = getActiveConnection();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const recentConnections = recentConnectionIds
    .map((connectionId) =>
      connections.find((connection) => connection.id === connectionId),
    )
    .filter((connection): connection is (typeof connections)[number] =>
      Boolean(connection),
    );

  // Connections sorted with pinned at top
  const sortedConnections = [
    ...connections.filter((c) => pinnedConnectionIds.includes(c.id)),
    ...connections.filter((c) => !pinnedConnectionIds.includes(c.id)),
  ];

  const editConnection = editConnectionId
    ? connections.find((c) => c.id === editConnectionId)
    : undefined;

  const handleDuplicateConnection = (conn: ConnectionConfig) => {
    const duplicate: ConnectionConfig = {
      ...conn,
      id: crypto.randomUUID(),
      name: `${conn.name} (Copy)`,
    };
    const addConnection = useConnectionStore.getState().addConnection;
    addConnection(duplicate);
    toast.success(`Duplicated "${conn.name}"`);
  };

  const handleCopyConnectionUrl = (conn: ConnectionConfig) => {
    let url = "";
    if (conn.db_type === "sqlite") {
      url = conn.file_path ?? "";
    } else {
      const user = conn.username ?? "";
      const pass = conn.password ? `:${conn.password}` : "";
      const host = conn.host ?? "localhost";
      const port = conn.port ? `:${conn.port}` : "";
      const db = conn.database ?? "";
      const scheme = conn.db_type === "mysql" ? "mysql" : "postgresql";
      url = `${scheme}://${user}${pass}@${host}${port}/${db}`;
    }
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Connection URL copied to clipboard");
    }).catch(() => {
      toast.error("Failed to copy to clipboard");
    });
  };

  // Clear all tabs when active connection changes
  useEffect(() => {
    setTabs([]);
    setActiveTabId(null);
  }, [activeConnectionId]);

  useEffect(() => {
    const handleOpenAbout = () => {
      setAboutDialogOpen(true);
    };

    window.addEventListener(OPEN_ABOUT_EVENT, handleOpenAbout);
    return () => {
      window.removeEventListener(OPEN_ABOUT_EVENT, handleOpenAbout);
    };
  }, []);

  useEffect(() => {
    if (!autoCheckForUpdates) {
      return;
    }

    void appUpdate.checkForUpdates({
      silent: true,
      onViewDetails: () => setAboutDialogOpen(true),
    });
  }, [appUpdate.checkForUpdates, autoCheckForUpdates]);

  const handleTableSelect = async (table: DatabaseTable) => {
    const existingTab = tabs.find(
      (t) => t.type === "table" && t.table?.name === table.name,
    );
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      // Create tab without loading columns (lazy loading)
      const newTab: TabType = {
        id: `table-${table.name}-${Date.now()}`,
        type: "table",
        title: table.name,
        table,
        columns: undefined, // Will be loaded when tab becomes active
        isPinned: false,
        isDirty: false,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
    }
  };

  const handleOpenTableInNewTab = (table: DatabaseTable) => {
    const newTab: TabType = {
      id: `table-${table.name}-${Date.now()}`,
      type: "table",
      title: table.name,
      table,
      isPinned: false,
      isDirty: false,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleOpenTableInSqlEditor = (table: DatabaseTable) => {
    const query = `SELECT * FROM ${table.name};`;
    const newTab: TabType = {
      id: `query-${Date.now()}`,
      type: "query",
      title: `SELECT ${table.name}`,
      isPinned: false,
      isDirty: true,
      queryContent: query,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const connectToConnection = async (
    connection: (typeof connections)[number],
  ) => {
    try {
      await invoke("connect_database", {
        config: connection,
      });
      setActiveConnection(connection.id);
    } catch (error) {
      console.error("Failed to connect:", error);
      alert(`Failed to connect to ${connection.name}: ${error}`);
    }
  };

  const openQueryTab = () => {
    const newTab: TabType = {
      id: `query-${Date.now()}`,
      type: "query",
      title: "New Query",
      isPinned: false,
      isDirty: false,
      queryContent: "",
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const openQueryBuilderTab = () => {
    const newTab: TabType = {
      id: `query-builder-${Date.now()}`,
      type: "query-builder",
      title: "Visual Query Builder",
      isPinned: false,
      isDirty: false,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const openSchemaDesignerTab = () => {
    // Check if schema tab already exists
    const existingSchemaTab = tabs.find((t) => t.type === "schema");
    if (existingSchemaTab) {
      setActiveTabId(existingSchemaTab.id);
      return;
    }

    const newTab: TabType = {
      id: `schema-${Date.now()}`,
      type: "schema",
      title: "Schema Designer",
      isPinned: false,
      isDirty: false,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleLoadQueryFromHistory = (query: string) => {
    // Find or create a query tab
    let queryTab = tabs.find((t) => t.type === "query");

    if (!queryTab) {
      // Create new query tab with the query
      const newTab: TabType = {
        id: `query-${Date.now()}`,
        type: "query",
        title: "Query 1",
        isPinned: false,
        isDirty: true,
        queryContent: query,
      };
      setTabs([...tabs, newTab]);
      setActiveTabId(newTab.id);
    } else {
      // Update existing query tab
      setTabs(
        tabs.map((t) =>
          t.id === queryTab!.id
            ? { ...t, queryContent: query, isDirty: true }
            : t,
        ),
      );
      setActiveTabId(queryTab.id);
    }
  };

  const closeTab = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    // Don't close if pinned (unless it's the last tab)
    if (tab?.isPinned && tabs.length > 1) {
      return;
    }

    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(
        newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null,
      );
    }
  };

  const togglePin = (tabId: string) => {
    setTabs(
      tabs.map((t) => (t.id === tabId ? { ...t, isPinned: !t.isPinned } : t)),
    );
  };

  const duplicateTab = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || tab.type !== "query") return;

    const newTab: TabType = {
      ...tab,
      id: `query-${Date.now()}`,
      title: `${tab.title} (Copy)`,
      isPinned: false,
      isDirty: false,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeOtherTabs = (tabId: string) => {
    const newTabs = tabs.filter((t) => t.id === tabId || t.isPinned);
    setTabs(newTabs);
    setActiveTabId(tabId);
  };

  const closeAllTabs = () => {
    const newTabs = tabs.filter((t) => t.isPinned);
    setTabs(newTabs);
    setActiveTabId(newTabs.length > 0 ? newTabs[0].id : null);
  };

  const closeTabsToRight = (tabId: string) => {
    const index = tabs.findIndex((t) => t.id === tabId);
    if (index === -1) return;

    const newTabs = tabs
      .slice(0, index + 1)
      .concat(tabs.slice(index + 1).filter((t) => t.isPinned));
    setTabs(newTabs);
  };

  const goToNextTab = () => {
    if (tabs.length === 0) return;
    const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
    const nextIndex = (currentIndex + 1) % tabs.length;
    setActiveTabId(tabs[nextIndex].id);
  };

  const goToPrevTab = () => {
    if (tabs.length === 0) return;
    const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
    const prevIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1;
    setActiveTabId(tabs[prevIndex].id);
  };

  const jumpToTab = (index: number) => {
    if (index < tabs.length) {
      setActiveTabId(tabs[index].id);
    }
  };

  // Lazy load table columns when tab becomes active
  useEffect(() => {
    const loadColumnsForActiveTab = async () => {
      if (!activeTab || activeTab.type !== "table" || !activeTab.table) {
        return;
      }

      // Check if columns are already loaded
      if (activeTab.columns !== undefined) {
        return;
      }

      // Load columns
      try {
        const columns = await invoke<TableColumn[]>("get_table_structure", {
          connectionId: activeConnection?.id,
          tableName: activeTab.table.name,
          dbType: activeConnection?.db_type,
        });

        // Update the tab with loaded columns
        setTabs(
          tabs.map((t) => (t.id === activeTab.id ? { ...t, columns } : t)),
        );
      } catch (error) {
        console.error("Failed to load table columns:", error);
        // Set empty array to prevent infinite retry
        setTabs(
          tabs.map((t) => (t.id === activeTab.id ? { ...t, columns: [] } : t)),
        );
      }
    };

    loadColumnsForActiveTab();
  }, [activeTabId, activeTab, activeConnection, tabs]);

  // Setup keyboard shortcuts
  useTabKeyboardShortcuts({
    onNewTab: openQueryTab,
    onCloseTab: activeTabId ? () => closeTab(activeTabId) : undefined,
    onNextTab: goToNextTab,
    onPrevTab: goToPrevTab,
    onJumpToTab: jumpToTab,
    onCloseAllTabs: closeAllTabs,
  });

  // Global keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac =
        typeof navigator !== "undefined" &&
        (/Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ||
          /Mac/.test(navigator.platform));
      // On macOS use Cmd (metaKey); on Win/Linux use Ctrl (ctrlKey)
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key ? e.key.toLowerCase() : "";

      // Cmd+Shift+P (mac) / Ctrl+Shift+P (win)  →  Command Palette
      if (modKey && e.shiftKey && key === "p") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }
      // Cmd+K (mac) / Ctrl+K (win)  →  Command Palette quick-open
      if (modKey && !e.shiftKey && !e.altKey && key === "k") {
        const target = e.target as HTMLElement;
        if (!target?.closest?.(".monaco-editor")) {
          e.preventDefault();
          setCommandPaletteOpen((prev) => !prev);
          return;
        }
      }
      // Cmd+, (mac) / Ctrl+, (win)  →  Settings
      if (modKey && key === ",") {
        e.preventDefault();
        setSettingsDialogOpen((prev) => !prev);
        return;
      }
      // Cmd+Shift+? (mac) / Ctrl+Shift+? (win)  →  Shortcuts dialog
      if (modKey && e.shiftKey && (key === "?" || key === "/")) {
        e.preventDefault();
        setShortcutsDialogOpen((prev) => !prev);
        return;
      }
      // Cmd+Shift+E (mac) / Ctrl+Shift+E (win)  →  Schema Designer
      if (modKey && e.shiftKey && key === "e") {
        e.preventDefault();
        openSchemaDesignerTab();
        return;
      }
      // Cmd+Shift+C (mac) / Ctrl+Shift+C (win)  →  Switch Connection
      if (modKey && e.shiftKey && key === "c") {
        e.preventDefault();
        openConnectionSwitcher();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [openConnectionSwitcher, openSchemaDesignerTab]);

  // Command palette command registry
  const paletteCommands = useMemo<PaletteCommand[]>(() => [
    // ── Connections ────────────────────────────────────────────────
    {
      id: 'new-connection',
      label: 'New Connection',
      description: 'Add a new database connection',
      icon: <Plus className="h-3.5 w-3.5" />,
      macShortcut: undefined,
      winShortcut: undefined,
      category: 'Connections',
      action: () => setConnectionDialogOpen(true),
    },
    {
      id: 'switch-connection',
      label: 'Switch Connection',
      description: 'Switch to a different database connection',
      icon: <Network className="h-3.5 w-3.5" />,
      macShortcut: ['⌘', '⇧', 'C'],
      winShortcut: ['Ctrl', 'Shift', 'C'],
      category: 'Connections',
      action: () => openConnectionSwitcher(),
      disabled: !activeConnectionId,
    },
    // ── Tabs ──────────────────────────────────────────────────────
    {
      id: 'new-query-tab',
      label: 'New Query Tab',
      description: 'Open a blank SQL query editor tab',
      icon: <Terminal className="h-3.5 w-3.5" />,
      macShortcut: ['⌘', 'N'],
      winShortcut: ['Ctrl', 'N'],
      category: 'Tabs',
      action: openQueryTab,
      disabled: !activeConnectionId,
    },
    {
      id: 'close-tab',
      label: 'Close Current Tab',
      description: 'Close the active tab',
      icon: <Terminal className="h-3.5 w-3.5" />,
      macShortcut: ['⌘', 'W'],
      winShortcut: ['Ctrl', 'W'],
      category: 'Tabs',
      action: () => activeTabId && closeTab(activeTabId),
      disabled: !activeTabId,
    },
    {
      id: 'close-all-tabs',
      label: 'Close All Tabs',
      description: 'Close all open tabs',
      icon: <Terminal className="h-3.5 w-3.5" />,
      macShortcut: ['⌘', '⇧', 'W'],
      winShortcut: ['Ctrl', 'Shift', 'W'],
      category: 'Tabs',
      action: closeAllTabs,
      disabled: !activeConnectionId,
    },
    // ── View ──────────────────────────────────────────────────────
    {
      id: 'schema-designer',
      label: 'Schema Designer',
      description: 'Open the visual ERD / schema designer',
      icon: <LayoutGrid className="h-3.5 w-3.5" />,
      macShortcut: ['⌘', '⇧', 'E'],
      winShortcut: ['Ctrl', 'Shift', 'E'],
      category: 'View',
      action: openSchemaDesignerTab,
      disabled: !activeConnectionId,
    },
    {
      id: 'query-builder',
      label: 'Visual Query Builder',
      description: 'Build queries visually with drag-and-drop',
      icon: <Database className="h-3.5 w-3.5" />,
      category: 'View',
      action: openQueryBuilderTab,
      disabled: !activeConnectionId,
    },
    {
      id: 'query-history',
      label: 'Query History',
      description: 'View recently executed queries',
      icon: <History className="h-3.5 w-3.5" />,
      category: 'View',
      action: () => setShowHistoryPanel((p) => !p),
    },
    // ── Settings ──────────────────────────────────────────────────
    {
      id: 'settings',
      label: 'Open Settings',
      description: 'Font, theme, and application preferences',
      icon: <Settings className="h-3.5 w-3.5" />,
      macShortcut: ['⌘', ','],
      winShortcut: ['Ctrl', ','],
      category: 'Settings',
      action: () => setSettingsDialogOpen(true),
    },
    {
      id: 'keyboard-shortcuts',
      label: 'Keyboard Shortcuts',
      description: 'Show all keyboard shortcuts',
      icon: <Keyboard className="h-3.5 w-3.5" />,
      macShortcut: ['⌘', '⇧', '?'],
      winShortcut: ['Ctrl', 'Shift', '?'],
      category: 'Settings',
      action: () => setShortcutsDialogOpen(true),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [activeConnectionId, activeTabId, openConnectionSwitcher, openQueryTab, openQueryBuilderTab, openSchemaDesignerTab, closeAllTabs]);

  // NodaDB slash-command registry (shared between palette and MCP layer)
  const nodaCommands = useMemo(() => buildCommandRegistry({
    connectionId: activeConnectionId,
    dbType: activeConnection?.db_type ?? null,
    openQueryTab,
    openSchemaDesigner: openSchemaDesignerTab,
    openRelationFlow: () => {
      if (!activeConnectionId || !activeConnection) return;
      const tabId = crypto.randomUUID();
      const newTab: TabType = { id: tabId, type: 'relation-flow', title: 'Relation Flow', isPinned: false, isDirty: false };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(tabId);
    },
    openVisualQueryBuilder: openQueryBuilderTab,
    openConnectionDialog: () => setConnectionDialogOpen(true),
    openSettings: () => setSettingsDialogOpen(true),
    openAgentsPanel: () => setAgentsPanelOpen(true),
    openHistory: () => setShowHistoryPanel(prev => !prev),
    openShortcutsDialog: () => setShortcutsDialogOpen(true),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [activeConnectionId, activeConnection?.db_type, openQueryTab, openQueryBuilderTab, openSchemaDesignerTab]);

  // Apply font family and font size to root element
  useEffect(() => {
    const root = window.document.documentElement;

    // Apply font family
    root.classList.remove("font-outfit", "font-jetbrains-mono", "font-system");
    root.classList.add(`font-${fontFamily.toLowerCase().replace(/ /g, "-")}`);

    // Apply font size
    root.classList.remove(
      "font-size-small",
      "font-size-medium",
      "font-size-large",
    );
    root.classList.add(`font-size-${fontSize}`);
  }, [fontFamily, fontSize]);

  // Apply color theme on load and when changed
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", colorTheme);
  }, [colorTheme]);

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <div className="relative flex min-h-screen w-full overflow-hidden">
        {activeConnectionId && activeConnection ? (
          <>
            <AppSidebar
              connection={activeConnection}
              recentConnections={recentConnections}
              onConnectToConnection={(conn) => void connectToConnection(conn)}
              onOpenConnectionSwitcher={openConnectionSwitcher}
              onTableSelect={handleTableSelect}
              onOpenInNewTab={handleOpenTableInNewTab}
              onOpenInSqlEditor={handleOpenTableInSqlEditor}
              onEditTable={() => openSchemaDesignerTab()}
              selectedTable={activeTab?.table || null}
              onNewQuery={openQueryTab}
              onOpenQueryBuilder={openQueryBuilderTab}
            />

            <SidebarInset className="flex flex-col flex-1 min-w-0">
              {/* MenuBar for Linux/Windows (macOS uses native menu) */}
              {!navigator.userAgent.includes("Mac") && (
                <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
                  <MenuBar onOpenAbout={() => setAboutDialogOpen(true)} />
                </header>
              )}
              {/* Top Navigation Bar */}
              <header
                data-tauri-drag-region
                className={`border-b border-border bg-background text-foreground flex items-center px-4 gap-4 ${sidebarOpen ? "pl-0" : "pl-20"}`}
              >
                {/* Logo & App Name */}
                {activeConnectionId && activeConnection && (
                  <div className="flex items-center justify-center gap-2">
                    <SidebarTrigger />
                    {!navigator.userAgent.includes("Mac") && (
                      <header className="w-full">
                        <MenuBar onOpenAbout={() => setAboutDialogOpen(true)} />
                      </header>)}
                  </div>
                )}

                <div className="flex-1" />

                {/* Right Actions */}
                <KeyboardTooltip
                  description="Schema Designer"
                  keys={["Ctrl", "Shift", "E"]}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={openSchemaDesignerTab}
                  >
                    <Shapes className="h-4 w-4" />
                  </Button>
                </KeyboardTooltip>

                {/*<KeyboardTooltip
                  description="Open Connections"
                  keys={["Ctrl", "Shift", "C"]}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={openConnectionSwitcher}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </KeyboardTooltip>*/}
                <KeyboardTooltip description="Query History">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                    className={showHistoryPanel ? "bg-muted" : ""}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                </KeyboardTooltip>
                <KeyboardTooltip
                  description="Keyboard Shortcuts"
                  keys={["Ctrl", "?"]}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShortcutsDialogOpen(true)}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </KeyboardTooltip>
                <KeyboardTooltip description="Settings" keys={["Ctrl", ","]}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSettingsDialogOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </KeyboardTooltip>
              </header>

              {/* Tab Bar */}
              <TabBar
                tabs={tabs}
                activeTabId={activeTabId}
                onTabClick={setActiveTabId}
                onTabClose={closeTab}
                onTabPin={togglePin}
                onTabDuplicate={duplicateTab}
                onCloseOthers={closeOtherTabs}
                onCloseAll={closeAllTabs}
                onCloseToRight={closeTabsToRight}
              />
              <main className="flex-1 overflow-hidden bg-secondary/20 flex">
                <div className="flex-1 overflow-hidden">
                  {/* Render all tabs but only show the active one via CSS.
                      Query tabs are kept mounted to preserve their state (query text,
                      results, execution history). Table/schema tabs unmount normally
                      since they always reload fresh data. */}
                  {tabs.map((tab) => {
                    const isActive = tab.id === activeTabId;
                    return (
                      <div
                        key={tab.id}
                        className={`h-full w-full ${isActive ? "block" : "hidden"}`}
                      >
                        {tab.type === "table" && tab.table ? (
                          // Only render table content when this tab is active (avoids
                          // fetching data for background table tabs unnecessarily).
                          isActive ? (
                            tab.columns === undefined ? (
                              <TableSkeleton />
                            ) : (
                              <TanStackTableViewer
                                connection={activeConnection}
                                table={tab.table}
                                columns={tab.columns}
                                initialFilters={tab.initialFilters}
                                onNavigateToTable={(tableName, columnName, val) => {
                                  const newTab: TabType = {
                                    id: `table-${tableName}-filtered-${Date.now()}`,
                                    type: "table",
                                    title: `${tableName} (${columnName}=${val})`,
                                    table: { name: tableName },
                                    columns: undefined,
                                    isPinned: false,
                                    isDirty: false,
                                    initialFilters: [{ id: columnName, value: val }],
                                  };
                                  setTabs([...tabs, newTab]);
                                  setActiveTabId(newTab.id);
                                }}
                                onViewFlow={(val) => {
                                  const newTab: TabType = {
                                    id: `relation-flow-${val}-${Date.now()}`,
                                    type: "relation-flow",
                                    title: `Flow: ${val.substring(0, 8)}...`,
                                    isPinned: false,
                                    isDirty: false,
                                    relationFlowValue: val,
                                  };
                                  setTabs([...tabs, newTab]);
                                  setActiveTabId(newTab.id);
                                }}
                                onRefresh={async () => {
                                  try {
                                    const columns = await invoke<TableColumn[]>(
                                      "get_table_structure",
                                      {
                                        connectionId: activeConnection.id,
                                        tableName: tab.table!.name,
                                        dbType: activeConnection.db_type,
                                      },
                                    );
                                    setTabs(
                                      tabs.map((t) =>
                                        t.id === tab.id
                                          ? { ...t, columns }
                                          : t,
                                      ),
                                    );
                                  } catch (error) {
                                    console.error(
                                      "Failed to reload columns:",
                                      error,
                                    );
                                  }
                                }}
                              />
                            )
                          ) : null
                        ) : tab.type === "query-builder" ? (
                          isActive ? (
                            <VisualQueryBuilder connection={activeConnection} />
                          ) : null
                        ) : tab.type === "schema" ? (
                          isActive ? (
                            <SchemaDesigner connection={activeConnection} />
                          ) : null
                        ) : tab.type === "relation-flow" ? (
                          <RelationFlow
                            connection={activeConnection}
                            value={tab.relationFlowValue || ""}
                            onNavigateToTable={(tableName, columnName, val) => {
                              const newTab: TabType = {
                                id: `table-${tableName}-filtered-${Date.now()}`,
                                type: "table",
                                title: `${tableName} (${columnName}=${val})`,
                                table: { name: tableName },
                                columns: undefined,
                                isPinned: false,
                                isDirty: false,
                                initialFilters: [{ id: columnName, value: val }],
                              };
                              setTabs([...tabs, newTab]);
                              setActiveTabId(newTab.id);
                            }}
                          />
                        ) : (
                          // "query" tabs: always keep mounted to preserve state
                          <QueryEditor connection={activeConnection} initialQuery={tab.queryContent} />
                        )}
                      </div>
                    );
                  })}

                  {/* Empty state when no tabs are open */}
                  {tabs.length === 0 && (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <Database className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                        <h2 className="text-xl font-semibold mb-2">
                          Welcome to {activeConnection?.name}
                        </h2>
                        <p className="text-sm text-muted-foreground mb-6">
                          Select a table from the sidebar or open a new query
                        </p>
                        <KeyboardTooltip
                          description="Create New Query Tab"
                          keys={["Ctrl", "N"]}
                        >
                          <Button onClick={openQueryTab} variant="outline">
                            <FileCode2 className="h-4 w-4 mr-2" />
                            New Query
                          </Button>
                        </KeyboardTooltip>
                      </div>
                    </div>
                  )}
                </div>

                {/* Query History Panel */}
                {showHistoryPanel && (
                  <div className="w-80 shrink-0">
                    <QueryHistoryPanel
                      connectionId={activeConnection.id}
                      onSelectQuery={handleLoadQueryFromHistory}
                    />
                  </div>
                )}
              </main>
            </SidebarInset>
          </>
        ) : connections.length > 0 ? (
          /* Connection List when no active connection */
          <div className="flex-1 flex flex-col">
            <header
              data-tauri-drag-region
              className="pl-24 md:pl-0 h-9 py-1 border-b border-border bg-background text-foreground flex items-center px-4 gap-4"
            ></header>
            {/* Back button when switching connections */}
            {previousConnectionId && (
              <div className="flex items-center p-6 mb-6">
                <Button
                  variant="outline"
                  onClick={restorePreviousConnection}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to{" "}
                  {connections.find((c) => c.id === previousConnectionId)
                    ?.name || "Connection"}
                </Button>
              </div>
            )}
            <div className="flex-1 flex items-center justify-center">
              <div className="max-w-2xl w-full">
                <h2 className="text-2xl font-bold mb-2">Your Connections</h2>
                <p className="text-muted-foreground mb-6">
                  Select a connection to start exploring your database
                </p>
                <div className="grid gap-3">
                  {sortedConnections.map((conn) => {
                    const isPinned = pinnedConnectionIds.includes(conn.id);
                    return (
                    <div
                      key={conn.id}
                      className={`relative group text-left p-5 rounded-lg border bg-card hover:border-primary hover:bg-accent transition-all duration-150 ${
                        isPinned ? 'border-primary/50' : 'border-border'
                      }`}
                    >
                      <button
                        onClick={async () => {
                          await connectToConnection(conn);
                        }}
                        className="w-full"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <DbIcon dbType={conn.db_type} provider={conn.provider} className="h-6 w-6 shrink-0" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold mb-1 text-left flex items-center gap-2">
                              {conn.name}
                              {isPinned && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                  <Pin className="h-2.5 w-2.5" />
                                  Pinned
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-secondary font-mono text-xs">
                                {conn.provider
                                  ? ({ supabase: 'Supabase', neon: 'Neon', mariadb: 'MariaDB', planetscale: 'PlanetScale (MySQL)', planetscale_postgres: 'PlanetScale (Postgres)', prisma: 'Prisma', turso: 'Turso', valtown: 'Val Town', cloudflare: 'Cloudflare D1' } as Record<string, string>)[conn.provider] ?? conn.provider
                                  : conn.db_type === 'mongodb' ? 'MongoDB' : conn.db_type === 'clickhouse' ? 'ClickHouse' : conn.db_type === 'libsql' ? 'LibSQL' : conn.db_type === 'redis' ? 'Redis' : conn.db_type.toUpperCase()}
                              </span>
                              {conn.file_path && (
                                <span className="truncate">
                                  {conn.file_path}
                                </span>
                              )}
                              {conn.host && (
                                <span>
                                  {conn.host}:{conn.port}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePinConnection(conn.id);
                            }}
                          >
                            {isPinned ? (
                              <><PinOff className="h-4 w-4 mr-2" />Unpin from Home</>
                            ) : (
                              <><Pin className="h-4 w-4 mr-2" />Pin to Home</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditConnectionId(conn.id);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameConnectionId(conn.id);
                              setRenameValue(conn.name);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyConnectionUrl(conn);
                            }}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy URL
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateConnection(conn);
                            }}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConnectionId(conn.id);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    );
                  })}

                  {/* Add New Connection Card */}
                  <button
                    onClick={() => setConnectionDialogOpen(true)}
                    className="text-left p-5 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-accent/50 transition-all duration-150"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Plus className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold mb-1">
                          Add New Connection
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Connect to a new database
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Welcome screen for new users */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="h-20 w-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                <img src="/logo.png" alt="NodaDB Logo" className="h-10w-10" />
              </div>
              <h2 className="text-3xl font-bold mb-3">NodaDB</h2>
              <p className="text-muted-foreground mb-8 text-lg">
                A modern, professional database management tool built with Tauri
              </p>
              <Button onClick={() => setConnectionDialogOpen(true)} size="lg">
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Connection
              </Button>
              <div className="mt-8 grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                <div className="flex flex-col items-center">
                  <DbIcon dbType="sqlite" className="h-6 w-6 mb-1.5 shrink-0" />
                  <div className="font-semibold text-foreground mb-1">
                    SQLite
                  </div>
                  <div className="text-xs">Local databases</div>
                </div>
                <div className="flex flex-col items-center">
                  <DbIcon dbType="postgresql" className="h-6 w-6 mb-1.5 shrink-0" />
                  <div className="font-semibold text-foreground mb-1">
                    PostgreSQL
                  </div>
                  <div className="text-xs">Remote servers</div>
                </div>
                <div className="flex flex-col items-center">
                  <DbIcon dbType="mysql" className="h-6 w-6 mb-1.5 shrink-0" />
                  <div className="font-semibold text-foreground mb-1">
                    MySQL
                  </div>
                  <div className="text-xs">Cloud & on-premise</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <Toaster richColors position="top-right" />
        <AlertDialog
          open={renameConnectionId !== null}
          onOpenChange={(open) => !open && setRenameConnectionId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rename Connection</AlertDialogTitle>
              <AlertDialogDescription>
                Enter a new name for this connection.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Connection name"
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameValue.trim()) {
                  if (renameConnectionId) {
                    updateConnection(renameConnectionId, {
                      name: renameValue.trim(),
                    });
                    setRenameConnectionId(null);
                  }
                }
              }}
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (renameConnectionId && renameValue.trim()) {
                    updateConnection(renameConnectionId, {
                      name: renameValue.trim(),
                    });
                    setRenameConnectionId(null);
                  }
                }}
                disabled={!renameValue.trim()}
              >
                Rename
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={deleteConnectionId !== null}
          onOpenChange={(open) => !open && setDeleteConnectionId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Connection</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this connection? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteConnectionId) {
                    removeConnection(deleteConnectionId);
                    setDeleteConnectionId(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <ConnectionDialog
          open={connectionDialogOpen}
          onOpenChange={setConnectionDialogOpen}
        />
        <ConnectionDialog
          open={editConnectionId !== null}
          onOpenChange={(open) => !open && setEditConnectionId(null)}
          editConnection={editConnection}
        />
        <KeyboardShortcutsDialog
          open={shortcutsDialogOpen}
          onOpenChange={setShortcutsDialogOpen}
        />
        <SettingsDialog
          open={settingsDialogOpen}
          onOpenChange={setSettingsDialogOpen}
          appUpdate={appUpdate}
        />
        <AboutDialog
          open={aboutDialogOpen}
          onOpenChange={setAboutDialogOpen}
          appUpdate={appUpdate}
          autoCheckForUpdates={autoCheckForUpdates}
          onAutoCheckChange={setAutoCheckForUpdates}
        />
        <KeyboardCheatSheet onOpenShortcutsDialog={() => setShortcutsDialogOpen(true)} />
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          commands={paletteCommands}
          nodaCommands={nodaCommands}
        />
        <AgentsPanel
          open={agentsPanelOpen}
          onOpenChange={setAgentsPanelOpen}
        />
      </div>
    </SidebarProvider>
  );
}

export default App;
