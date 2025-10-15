import { useState, useEffect } from "react";
import { Database, Plus, Settings, FileCode2, HelpCircle, History, Network, Shapes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectionDialog } from "@/components/ConnectionDialog";
import { KeyboardShortcutsDialog } from "@/components/KeyboardShortcutsDialog";
import { KeyboardCheatSheet } from "@/components/KeyboardCheatSheet";
import { SettingsDialog } from "@/components/SettingsDialog";
import { QueryHistoryPanel } from "@/components/QueryHistoryPanel";
import { AppSidebar } from "@/components/AppSidebar";
import { TanStackTableViewer } from "@/components/TanStackTableViewer";
import { TableSkeleton } from "@/components/TableSkeleton";
import { QueryEditor } from "@/components/QueryEditor";
import { VisualQueryBuilder } from "@/components/VisualQueryBuilder";
import { SchemaDesigner } from "@/components/SchemaDesigner";
import { useConnectionStore } from "@/stores/connectionStore";
import { Toaster } from "@/components/ui/sonner";
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



function App() {
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
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

  const activeConnection = getActiveConnection();
  const activeTab = tabs.find((t) => t.id === activeTabId);

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
      queryContent: '',
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
    const existingSchemaTab = tabs.find(t => t.type === "schema");
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
    let queryTab = tabs.find(t => t.type === "query");
    
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
      setTabs(tabs.map(t => 
        t.id === queryTab!.id 
          ? { ...t, queryContent: query, isDirty: true }
          : t
      ));
      setActiveTabId(queryTab.id);
    }
  };

  const closeTab = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
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
    setTabs(tabs.map(t => 
      t.id === tabId ? { ...t, isPinned: !t.isPinned } : t
    ));
  };

  const duplicateTab = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || tab.type !== 'query') return;
    
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
    const newTabs = tabs.filter(t => t.id === tabId || t.isPinned);
    setTabs(newTabs);
    setActiveTabId(tabId);
  };

  const closeAllTabs = () => {
    const newTabs = tabs.filter(t => t.isPinned);
    setTabs(newTabs);
    setActiveTabId(newTabs.length > 0 ? newTabs[0].id : null);
  };

  const closeTabsToRight = (tabId: string) => {
    const index = tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;
    
    const newTabs = tabs.slice(0, index + 1).concat(
      tabs.slice(index + 1).filter(t => t.isPinned)
    );
    setTabs(newTabs);
  };

  const goToNextTab = () => {
    if (tabs.length === 0) return;
    const currentIndex = tabs.findIndex(t => t.id === activeTabId);
    const nextIndex = (currentIndex + 1) % tabs.length;
    setActiveTabId(tabs[nextIndex].id);
  };

  const goToPrevTab = () => {
    if (tabs.length === 0) return;
    const currentIndex = tabs.findIndex(t => t.id === activeTabId);
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
      if (!activeTab || activeTab.type !== 'table' || !activeTab.table) {
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
        setTabs(tabs.map(t =>
          t.id === activeTab.id
            ? { ...t, columns }
            : t
        ));
      } catch (error) {
        console.error("Failed to load table columns:", error);
        // Set empty array to prevent infinite retry
        setTabs(tabs.map(t =>
          t.id === activeTab.id
            ? { ...t, columns: [] }
            : t
        ));
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
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '?') {
        e.preventDefault();
        setShortcutsDialogOpen((prev) => !prev);
      }
      // Also support just ? when no input is focused
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          e.preventDefault();
          setShortcutsDialogOpen(true);
        }
      }
      // Ctrl+Shift+E for Schema Designer/ERD Viewer
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        openSchemaDesignerTab();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openSchemaDesignerTab]);

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

                <div className="flex-1" />

                {/* Right Actions */}

                <KeyboardTooltip description="Open Visual Query Builder" keys={['Ctrl', 'B']}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={openQueryBuilderTab}
                  >
                    <Network className="h-4 w-4" />
                  </Button>
                </KeyboardTooltip>
                <KeyboardTooltip description="Open Schema Designer" keys={['Ctrl', 'Shift', 'E']}>
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
                    className={showHistoryPanel ? 'bg-muted' : ''}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                </KeyboardTooltip>
                <KeyboardTooltip description="Keyboard Shortcuts" keys={['Ctrl', '?']}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShortcutsDialogOpen(true)}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </KeyboardTooltip>
                <KeyboardTooltip description="Settings" keys={['Ctrl', ',']}>
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
                                  t.id === activeTab.id ? { ...t, columns } : t
                                )
                              );
                            } catch (error) {
                              console.error("Failed to reload columns:", error);
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
                      <KeyboardTooltip description="Create New Query Tab" keys={['Ctrl', 'N']}>
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
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-2xl w-full">
              <h2 className="text-2xl font-bold mb-2">Your Connections</h2>
              <p className="text-muted-foreground mb-6">
                Select a connection to start exploring your database
              </p>
              <div className="grid gap-3">
                {connections.map((conn) => (
                  <button
                    key={conn.id}
                    onClick={() => {
                      setActiveConnection(conn.id);
                      setTabs([]);
                      setActiveTabId(null);
                    }}
                    className="text-left p-5 rounded-lg border border-border bg-card hover:border-primary hover:bg-accent transition-all duration-150"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Database className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold mb-1">{conn.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-secondary font-mono text-xs">
                            {conn.db_type.toUpperCase()}
                          </span>
                          {conn.file_path && (
                            <span className="truncate">{conn.file_path}</span>
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
                ))}
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
