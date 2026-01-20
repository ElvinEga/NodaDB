import { useState, useEffect } from "react";
import {
  Database,
  Plus,
  Settings,
  FileCode2,
  HelpCircle,
  History,
  Network,
  Shapes,
  LogOut,
  DatabaseZap,
  Trash2,
  MoreVertical,
  Pencil,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { SettingsDialog } from "@/components/SettingsDialog";
import { QueryHistoryPanel } from "@/components/QueryHistoryPanel";
import { MenuBar } from "@/components/MenuBar";
import { AppSidebar } from "@/components/AppSidebar";
import { OptimizedTableViewer } from "@/components/OptimizedTableViewer";
import { TableSkeleton } from "@/components/TableSkeleton";
import { QueryEditor } from "@/components/QueryEditor";
import { VisualQueryBuilder } from "@/components/VisualQueryBuilder";
import { SchemaDesigner } from "@/components/SchemaDesigner";
import { useConnectionStore } from "@/stores/connectionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { toast, Toaster } from "sonner";
import { TabBar, type TabType } from "@/components/TabBar";
import { useTabKeyboardShortcuts } from "@/hooks/useTabKeyboardShortcuts";
import { KeyboardTooltip } from "@/components/ui/keyboard-tooltip";
import { DatabaseTable, TableColumn } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TanStackTableViewer } from "./components/TanStackTableViewer";

function App() {
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [deleteConnectionId, setDeleteConnectionId] = useState<string | null>(
    null
  );
  const [renameConnectionId, setRenameConnectionId] = useState<string | null>(
    null
  );
  const [renameValue, setRenameValue] = useState("");
  const { fontFamily, fontSize } = useSettingsStore();
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [tabs, setTabs] = useState<TabType[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const connections = useConnectionStore((state) => state.connections);
  const activeConnectionId = useConnectionStore(
    (state) => state.activeConnectionId
  );
  const setActiveConnection = useConnectionStore(
    (state) => state.setActiveConnection
  );
  const getActiveConnection = useConnectionStore(
    (state) => state.getActiveConnection
  );
  const removeConnection = useConnectionStore(
    (state) => state.removeConnection
  );
  const updateConnection = useConnectionStore(
    (state) => state.updateConnection
  );

  const activeConnection = getActiveConnection();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Clear all tabs when active connection changes
  useEffect(() => {
    setTabs([]);
    setActiveTabId(null);
  }, [activeConnectionId]);

  const handleTableSelect = async (table: DatabaseTable) => {
    const existingTab = tabs.find(
      (t) => t.type === "table" && t.table?.name === table.name
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
      setTabs([...tabs, newTab]);
      setActiveTabId(newTab.id);
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
            : t
        )
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
        newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null
      );
    }
  };

  const togglePin = (tabId: string) => {
    setTabs(
      tabs.map((t) => (t.id === tabId ? { ...t, isPinned: !t.isPinned } : t))
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
          tabs.map((t) => (t.id === activeTab.id ? { ...t, columns } : t))
        );
      } catch (error) {
        console.error("Failed to load table columns:", error);
        // Set empty array to prevent infinite retry
        setTabs(
          tabs.map((t) => (t.id === activeTab.id ? { ...t, columns: [] } : t))
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

  // Global keyboard listener for shortcuts dialog (Ctrl+? or Cmd+?)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+? or Cmd+? (Shift+/ with Ctrl/Cmd)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "?") {
        e.preventDefault();
        setShortcutsDialogOpen((prev) => !prev);
      }
      // Also support just ? when no input is focused
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (
          target.tagName !== "INPUT" &&
          target.tagName !== "TEXTAREA" &&
          !target.isContentEditable
        ) {
          e.preventDefault();
          setShortcutsDialogOpen(true);
        }
      }
      // Ctrl+Shift+E for Schema Designer/ERD Viewer
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "E") {
        e.preventDefault();
        openSchemaDesignerTab();
      }
      // Ctrl+Shift+C for Switch Connection
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
        e.preventDefault();
        setActiveConnection(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openSchemaDesignerTab, setActiveConnection]);

  // Apply font family and font size to root element
  useEffect(() => {
    const root = window.document.documentElement;

    // Apply font family
    root.classList.remove("font-outfit", "font-jetbrains-mono");
    root.classList.add(`font-${fontFamily.toLowerCase().replace(" ", "-")}`);

    // Apply font size
    root.classList.remove("font-small", "font-medium", "font-large");
    root.classList.add(`font-${fontSize}`);
  }, [fontFamily, fontSize]);

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full">
        {activeConnectionId && activeConnection ? (
          <>
            <AppSidebar
              connection={activeConnection}
              onTableSelect={handleTableSelect}
              selectedTable={activeTab?.table || null}
              onNewQuery={openQueryTab}
            />

            <SidebarInset className="flex flex-col flex-1">
              {/* MenuBar for Linux/Windows (macOS uses native menu) */}
              {!navigator.userAgent.includes("Mac") && (
                <header className="bg-background sticky top-0 z-50 w-full">
                  <MenuBar />
                </header>
              )}
              {/* Top Navigation Bar */}
              <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
                {/* Logo & App Name */}
                {activeConnectionId && activeConnection && (
                  <div className="flex items-center gap-2">
                    <SidebarTrigger />
                  </div>
                )}

                {/* Connection Selector */}
                {activeConnection && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary text-sm">
                    <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    <span className="font-medium">{activeConnection.name}</span>
                    <span className="text-muted-foreground">
                      ({activeConnection.db_type})
                    </span>
                  </div>
                )}
                {activeConnectionId && activeConnection && (
                  <div className="flex items-center">
                    <KeyboardTooltip
                      description="Switch Connection"
                      keys={["Ctrl", "Shift", "C"]}
                    >
                      <Button
                        variant="ghost"
                        onClick={() => setActiveConnection(null)}
                      >
                        <DatabaseZap className="h-4 w-4" />
                        Switch
                      </Button>
                    </KeyboardTooltip>
                  </div>
                )}
                <div className="flex-1" />

                {/* Right Actions */}

                <KeyboardTooltip
                  description="Open Visual Query Builder"
                  keys={["Ctrl", "B"]}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={openQueryBuilderTab}
                  >
                    <Network className="h-4 w-4" />
                  </Button>
                </KeyboardTooltip>
                <KeyboardTooltip
                  description="Open Schema Designer"
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

                <KeyboardTooltip description="New Connection">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConnectionDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </KeyboardTooltip>
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
                  {activeTab ? (
                    <>
                      {activeTab.type === "table" && activeTab.table ? (
                        activeTab.columns === undefined ? (
                          <TableSkeleton />
                        ) : (
                          // <OptimizedTableViewer
                          //   connection={activeConnection}
                          //   table={activeTab.table}
                          // />
                          <TanStackTableViewer
                            connection={activeConnection}
                            table={activeTab.table}
                            columns={activeTab.columns}
                            onRefresh={async () => {
                              // Reload columns
                              try {
                                const columns = await invoke<TableColumn[]>(
                                  "get_table_structure",
                                  {
                                    connectionId: activeConnection.id,
                                    tableName: activeTab.table!.name,
                                    dbType: activeConnection.db_type,
                                  }
                                );
                                setTabs(
                                  tabs.map((t) =>
                                    t.id === activeTab.id
                                      ? { ...t, columns }
                                      : t
                                  )
                                );
                              } catch (error) {
                                console.error(
                                  "Failed to reload columns:",
                                  error
                                );
                              }
                            }}
                          />
                        )
                      ) : activeTab.type === "query-builder" ? (
                        <VisualQueryBuilder connection={activeConnection} />
                      ) : activeTab.type === "schema" ? (
                        <SchemaDesigner connection={activeConnection} />
                      ) : (
                        <QueryEditor connection={activeConnection} />
                      )}
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <Database className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                        <h2 className="text-xl font-semibold mb-2">
                          Welcome to {activeConnection.name}
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
          <div className="flex-1 flex flex-col p-6">
            {/* Back button when switching connections */}
            {activeConnectionId && (
              <div className="flex items-center mb-6">
                <Button
                  variant="ghost"
                  onClick={() => setActiveConnection(activeConnectionId)}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to{" "}
                  {connections.find((c) => c.id === activeConnectionId)?.name ||
                    "Connection"}
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
                  {connections.map((conn) => (
                    <div
                      key={conn.id}
                      className="relative group text-left p-5 rounded-lg border border-border bg-card hover:border-primary hover:bg-accent transition-all duration-150"
                    >
                      <button
                        onClick={async () => {
                          try {
                            await invoke("connect_database", {
                              config: conn,
                            });
                            setActiveConnection(conn.id);
                          } catch (error) {
                            console.error("Failed to connect:", error);
                            alert(
                              `Failed to connect to ${conn.name}: ${error}`
                            );
                          }
                        }}
                        className="w-full"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Database className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold mb-1 text-left">
                              {conn.name}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-secondary font-mono text-xs">
                                {conn.db_type.toUpperCase()}
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
                  ))}

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
                <Database className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-3">Welcome to NodaDB</h2>
              <p className="text-muted-foreground mb-8 text-lg">
                A modern, professional database management tool built with Tauri
              </p>
              <Button onClick={() => setConnectionDialogOpen(true)} size="lg">
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Connection
              </Button>
              <div className="mt-8 grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                <div>
                  <div className="font-semibold text-foreground mb-1">
                    SQLite
                  </div>
                  <div className="text-xs">Local databases</div>
                </div>
                <div>
                  <div className="font-semibold text-foreground mb-1">
                    PostgreSQL
                  </div>
                  <div className="text-xs">Remote servers</div>
                </div>
                <div>
                  <div className="font-semibold text-foreground mb-1">
                    MySQL
                  </div>
                  <div className="text-xs">Cloud & on-premise</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <Toaster />
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
        <KeyboardShortcutsDialog
          open={shortcutsDialogOpen}
          onOpenChange={setShortcutsDialogOpen}
        />
        <SettingsDialog
          open={settingsDialogOpen}
          onOpenChange={setSettingsDialogOpen}
        />
        <KeyboardCheatSheet />
      </div>
    </SidebarProvider>
  );
}

export default App;
