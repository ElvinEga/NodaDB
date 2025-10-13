import { useState } from "react";
import { Database, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectionDialog } from "@/components/ConnectionDialog";
import { DatabaseExplorer } from "@/components/DatabaseExplorer";
import { TableDataViewer } from "@/components/TableDataViewer";
import { QueryEditor } from "@/components/QueryEditor";
import { useConnectionStore } from "@/stores/connectionStore";
import { Toaster } from "@/components/ui/sonner";
import { DatabaseTable } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function App() {
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<DatabaseTable | null>(null);
  const connections = useConnectionStore((state) => state.connections);
  const activeConnectionId = useConnectionStore((state) => state.activeConnectionId);
  const setActiveConnection = useConnectionStore((state) => state.setActiveConnection);
  const getActiveConnection = useConnectionStore((state) => state.getActiveConnection);
  
  const activeConnection = getActiveConnection();

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">NodaDB</h1>
        </div>
        <Button onClick={() => setConnectionDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Connection
        </Button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeConnectionId && activeConnection ? (
          <>
            {/* Database Explorer Sidebar */}
            <aside className="w-64 border-r bg-muted/30">
              <DatabaseExplorer
                connection={activeConnection}
                onTableSelect={setSelectedTable}
                selectedTable={selectedTable}
              />
            </aside>

            {/* Main Area - Tabbed Interface */}
            <main className="flex-1 overflow-hidden">
              <Tabs defaultValue="tables" className="h-full flex flex-col">
                <TabsList className="mx-4 mt-2">
                  <TabsTrigger value="tables">Tables</TabsTrigger>
                  <TabsTrigger value="query">Query</TabsTrigger>
                </TabsList>
                
                <TabsContent value="tables" className="flex-1 overflow-hidden mt-0">
                  {selectedTable ? (
                    <TableDataViewer
                      connection={activeConnection}
                      table={selectedTable}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <Database className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                        <h2 className="text-xl font-semibold mb-2">
                          Select a table to view
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Choose a table from the explorer to see its data
                        </p>
                      </div>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="query" className="flex-1 overflow-hidden mt-0">
                  <QueryEditor connection={activeConnection} />
                </TabsContent>
              </Tabs>
            </main>
          </>
        ) : connections.length > 0 ? (
          /* Connection List when no active connection */
          <div className="flex-1 flex flex-col">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">Your Connections</h2>
              <p className="text-muted-foreground mb-4">
                Select a connection to start exploring
              </p>
              <div className="grid gap-3 max-w-2xl">
                {connections.map((conn) => (
                  <button
                    key={conn.id}
                    onClick={() => {
                      setActiveConnection(conn.id);
                      setSelectedTable(null);
                    }}
                    className="text-left p-4 rounded-lg border hover:border-primary hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Database className="h-8 w-8 text-primary" />
                      <div>
                        <div className="font-semibold">{conn.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {conn.db_type.toUpperCase()}
                          {conn.file_path && ` • ${conn.file_path}`}
                          {conn.host && ` • ${conn.host}:${conn.port}`}
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
            <div className="text-center">
              <Database className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-2xl font-bold mb-2">Welcome to NodaDB</h2>
              <p className="text-muted-foreground mb-4">
                A modern database management tool built with Tauri
              </p>
              <Button onClick={() => setConnectionDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Connection
              </Button>
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
