import { useState } from "react";
import { Database, Plus, Settings, FileCode2, Table2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectionDialog } from "@/components/ConnectionDialog";
import { DatabaseExplorer } from "@/components/DatabaseExplorer";
import { TanStackTableViewer } from "@/components/TanStackTableViewer";
import { QueryEditor } from "@/components/QueryEditor";
import { useConnectionStore } from "@/stores/connectionStore";
import { Toaster } from "@/components/ui/sonner";
import { DatabaseTable, TableColumn } from "@/types";
import { invoke } from "@tauri-apps/api/core";

type TabType = {
  id: string;
  type: 'table' | 'query';
  title: string;
  table?: DatabaseTable;
  columns?: TableColumn[];
};

function App() {
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [tabs, setTabs] = useState<TabType[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const connections = useConnectionStore((state) => state.connections);
  const activeConnectionId = useConnectionStore((state) => state.activeConnectionId);
  const setActiveConnection = useConnectionStore((state) => state.setActiveConnection);
  const getActiveConnection = useConnectionStore((state) => state.getActiveConnection);
  
  const activeConnection = getActiveConnection();
  const activeTab = tabs.find(t => t.id === activeTabId);

  const handleTableSelect = async (table: DatabaseTable) => {
    const existingTab = tabs.find(t => t.type === 'table' && t.table?.name === table.name);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      // Load table columns
      try {
        const columns = await invoke<TableColumn[]>('get_table_columns', {
          connectionId: activeConnection?.id,
          tableName: table.name,
        });
        
        const newTab: TabType = {
          id: `table-${table.name}-${Date.now()}`,
          type: 'table',
          title: table.name,
          table,
          columns,
        };
        setTabs([...tabs, newTab]);
        setActiveTabId(newTab.id);
      } catch (error) {
        console.error('Failed to load table columns:', error);
        // Still open tab even if columns fail to load
        const newTab: TabType = {
          id: `table-${table.name}-${Date.now()}`,
          type: 'table',
          title: table.name,
          table,
          columns: [],
        };
        setTabs([...tabs, newTab]);
        setActiveTabId(newTab.id);
      }
    }
  };

  const openQueryTab = () => {
    const newTab: TabType = {
      id: `query-${Date.now()}`,
      type: 'query',
      title: 'New Query',
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (tabId: string) => {
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
        {/* Logo & App Name */}
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">NodaDB</h1>
        </div>

        {/* Connection Selector */}
        {activeConnection && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary text-sm">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="font-medium">{activeConnection.name}</span>
            <span className="text-muted-foreground">({activeConnection.db_type})</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Right Actions */}
        <Button variant="ghost" size="icon" onClick={() => setConnectionDialogOpen(true)}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </header>

      {/* Tab Bar */}
      {tabs.length > 0 && (
        <div className="h-10 border-b border-border bg-card flex items-center px-2 gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-md text-sm whitespace-nowrap
                transition-colors duration-150
                ${activeTabId === tab.id 
                  ? 'bg-secondary text-foreground' 
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }
              `}
            >
              {tab.type === 'table' ? (
                <Table2 className="h-3.5 w-3.5" />
              ) : (
                <FileCode2 className="h-3.5 w-3.5" />
              )}
              <span className="max-w-[150px] truncate">{tab.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="ml-1 hover:bg-border rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </button>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeConnectionId && activeConnection ? (
          <>
            {/* Database Explorer Sidebar */}
            <aside className="w-64 border-r border-border bg-card">
              <DatabaseExplorer
                connection={activeConnection}
                onTableSelect={handleTableSelect}
                selectedTable={activeTab?.table || null}
                onNewQuery={openQueryTab}
              />
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden bg-secondary/20">
              {activeTab ? (
                <>
                  {activeTab.type === 'table' && activeTab.table ? (
                    <TanStackTableViewer
                      connection={activeConnection}
                      table={activeTab.table}
                      columns={activeTab.columns || []}
                      onAddRow={() => {
                        // TODO: Open add row dialog
                      }}
                      onRefresh={async () => {
                        // Reload columns
                        try {
                          const columns = await invoke<TableColumn[]>('get_table_columns', {
                            connectionId: activeConnection.id,
                            tableName: activeTab.table!.name,
                          });
                          setTabs(tabs.map(t => 
                            t.id === activeTab.id ? { ...t, columns } : t
                          ));
                        } catch (error) {
                          console.error('Failed to reload columns:', error);
                        }
                      }}
                    />
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
                    <Button onClick={openQueryTab} variant="outline">
                      <FileCode2 className="h-4 w-4 mr-2" />
                      New Query
                    </Button>
                  </div>
                </div>
              )}
            </main>
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
                          {conn.file_path && <span className="truncate">{conn.file_path}</span>}
                          {conn.host && <span>{conn.host}:{conn.port}</span>}
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
                  <div className="font-semibold text-foreground mb-1">SQLite</div>
                  <div className="text-xs">Local databases</div>
                </div>
                <div>
                  <div className="font-semibold text-foreground mb-1">PostgreSQL</div>
                  <div className="text-xs">Remote servers</div>
                </div>
                <div>
                  <div className="font-semibold text-foreground mb-1">MySQL</div>
                  <div className="text-xs">Cloud & on-premise</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConnectionDialog
        open={connectionDialogOpen}
        onOpenChange={setConnectionDialogOpen}
      />
      <Toaster />
    </div>
  );
}

export default App;
