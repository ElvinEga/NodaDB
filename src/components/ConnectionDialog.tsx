import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Database, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ConnectionConfig, DatabaseType, ConnectionTestResult, SSHAuthMethod } from "@/types";
import { useConnectionStore } from "@/stores/connectionStore";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { parsePostgresConnectionString } from "@/lib/connectionStringParser";

interface ConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectionDialog({
  open,
  onOpenChange,
}: ConnectionDialogProps) {
  const [name, setName] = useState("");
  const [dbType, setDbType] = useState<DatabaseType>("sqlite");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState("");
  const [filePath, setFilePath] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  // Connection string state
  const [connectionString, setConnectionString] = useState("");

  // SSH Tunnel state
  const [connectionType, setConnectionType] = useState<"direct" | "ssh" | "connectionString">("direct");
  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState("22");
  const [sshUsername, setSshUsername] = useState("");
  const [sshAuthMethod, setSshAuthMethod] = useState<SSHAuthMethod>("password");
  const [sshPassword, setSshPassword] = useState("");
  const [sshPrivateKeyPath, setSshPrivateKeyPath] = useState("");

  const addConnection = useConnectionStore((state) => state.addConnection);
  const setActiveConnection = useConnectionStore(
    (state) => state.setActiveConnection
  );

  const handleParseConnectionString = () => {
    if (!connectionString.trim()) {
      toast.error("Please enter a connection string");
      return;
    }

    try {
      const parsed = parsePostgresConnectionString(connectionString);
      setHost(parsed.host);
      setPort(parsed.port);
      setUsername(parsed.username);
      setPassword(parsed.password);
      setDatabase(parsed.database);
      toast.success("Connection string parsed successfully");
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleBrowseSshKey = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        defaultPath: sshPrivateKeyPath || undefined,
        filters: [
          {
            name: "SSH Private Key",
            extensions: ["pem", "key", "pub", "*"],
          },
        ],
      });

      if (!selected) {
        return;
      }

      if (Array.isArray(selected)) {
        setSshPrivateKeyPath(selected[0] ?? "");
        return;
      }

      setSshPrivateKeyPath(selected);
    } catch (error) {
      toast.error("Failed to open file dialog");
      console.error(error);
    }
  };

  const handleTestConnection = async () => {
    if (dbType === "sqlite" && !filePath) {
      toast.error("Please select a database file");
      return;
    }

    if (dbType !== "sqlite" && (!host || !username || !database)) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate SSH config if using SSH tunnel
    if (connectionType === "ssh" && dbType !== "sqlite") {
      if (!sshHost || !sshUsername) {
        toast.error("Please fill in SSH host and username");
        return;
      }
      if (sshAuthMethod === "password" && !sshPassword) {
        toast.error("Please enter SSH password");
        return;
      }
      if (sshAuthMethod === "privateKey" && !sshPrivateKeyPath) {
        toast.error("Please select SSH private key");
        return;
      }
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const config: ConnectionConfig = {
        id: "test",
        name: "test",
        db_type: dbType,
        ...(dbType === "sqlite"
          ? { file_path: filePath }
          : {
              host,
              port: parseInt(port),
              username,
              password,
              database,
            }),
        ...(connectionType === "ssh" && dbType !== "sqlite"
          ? {
              ssh_config: {
                enabled: true,
                host: sshHost,
                port: parseInt(sshPort),
                username: sshUsername,
                authMethod: sshAuthMethod,
                password: sshAuthMethod === "password" ? sshPassword : undefined,
                privateKeyPath: sshAuthMethod === "privateKey" ? sshPrivateKeyPath : undefined,
              },
            }
          : {}),
      };

      const result = await invoke<ConnectionTestResult>("test_connection", { config });
      setTestResult(result);

      if (result.success) {
        toast.success(`Connection successful! ${result.db_version} (${result.latency_ms}ms)`);
      } else {
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch (error) {
      setTestResult({
        success: false,
        latency_ms: 0,
        db_version: "",
        error: String(error),
      });
      toast.error(String(error));
    } finally {
      setIsTesting(false);
    }
  };

  const handleBrowseFile = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        defaultPath: filePath || undefined,
        filters: [
          {
            name: "Database",
            extensions: ["db", "sqlite", "sqlite3"],
          },
        ],
      });

      if (!selected) {
        return;
      }

      if (Array.isArray(selected)) {
        setFilePath(selected[0] ?? "");
        return;
      }

      setFilePath(selected);
    } catch (error) {
      toast.error("Failed to open file dialog");
      console.log(error);
      console.error(error);
    }
  };

  const handleConnect = async () => {
    if (!name.trim()) {
      toast.error("Please enter a connection name");
      return;
    }

    if (dbType === "sqlite" && !filePath) {
      toast.error("Please select a database file");
      return;
    }

    if (dbType !== "sqlite" && (!host || !username || !database)) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate SSH config if using SSH tunnel
    if (connectionType === "ssh" && dbType !== "sqlite") {
      if (!sshHost || !sshUsername) {
        toast.error("Please fill in SSH host and username");
        return;
      }
      if (sshAuthMethod === "password" && !sshPassword) {
        toast.error("Please enter SSH password");
        return;
      }
      if (sshAuthMethod === "privateKey" && !sshPrivateKeyPath) {
        toast.error("Please select SSH private key");
        return;
      }
    }

    setIsConnecting(true);

    try {
      const config: ConnectionConfig = {
        id: crypto.randomUUID(),
        name,
        db_type: dbType,
        ...(dbType === "sqlite"
          ? { file_path: filePath }
          : {
              host,
              port: parseInt(port),
              username,
              password,
              database,
            }),
        ...(connectionType === "ssh" && dbType !== "sqlite"
          ? {
              ssh_config: {
                enabled: true,
                host: sshHost,
                port: parseInt(sshPort),
                username: sshUsername,
                authMethod: sshAuthMethod,
                password: sshAuthMethod === "password" ? sshPassword : undefined,
                privateKeyPath: sshAuthMethod === "privateKey" ? sshPrivateKeyPath : undefined,
              },
            }
          : {}),
      };

      const result = await invoke<string>("connect_database", { config });

      addConnection(config);
      setActiveConnection(config.id);
      toast.success(result);

      // Reset form
      setName("");
      setFilePath("");
      setHost("localhost");
      setPort("5432");
      setUsername("");
      setPassword("");
      setDatabase("");
      setConnectionType("direct");
      setSshHost("");
      setSshPort("22");
      setSshUsername("");
      setSshAuthMethod("password");
      setSshPassword("");
      setSshPrivateKeyPath("");
      onOpenChange(false);
    } catch (error) {
      toast.error(String(error));
      console.error("Connection error:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg">New Database Connection</DialogTitle>
          <DialogDescription className="text-xs">
            Configure your database connection settings
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto pr-4">
          <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Connection Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production DB, Local SQLite"
              className="h-9 text-sm"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="dbType" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Database Type <span className="text-destructive">*</span>
            </label>
            <Select
              value={dbType}
              onValueChange={(v) => setDbType(v as DatabaseType)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sqlite">
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5" />
                    <span>SQLite</span>
                    <span className="text-[10px] text-muted-foreground ml-2">Local file</span>
                  </div>
                </SelectItem>
                <SelectItem value="postgresql">
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5" />
                    <span>PostgreSQL</span>
                    <span className="text-[10px] text-muted-foreground ml-2">Server</span>
                  </div>
                </SelectItem>
                <SelectItem value="mysql">
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5" />
                    <span>MySQL</span>
                    <span className="text-[10px] text-muted-foreground ml-2">Server</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dbType === "sqlite" ? (
            <div className="grid gap-2">
              <label htmlFor="filePath" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Database File <span className="text-destructive">*</span>
              </label>
              <div className="flex gap-2">
                <Input
                  id="filePath"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  placeholder="/path/to/database.db"
                  className="h-9 text-sm font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBrowseFile}
                  className="h-9 shrink-0"
                >
                  Browse
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Select an existing .db file or enter a new path to create one
              </p>
            </div>
          ) : (
            <>
              <Tabs value={connectionType} onValueChange={(v) => setConnectionType(v as "direct" | "ssh" | "connectionString")}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="connectionString">Connection String</TabsTrigger>
                  <TabsTrigger value="direct">Direct Connection</TabsTrigger>
                  <TabsTrigger value="ssh">SSH Tunnel</TabsTrigger>
                </TabsList>

                <TabsContent value="connectionString" className="mt-4 space-y-3">
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <p className="text-xs text-muted-foreground mb-3">PostgreSQL Connection String</p>
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <label htmlFor="connectionString" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Connection String <span className="text-destructive">*</span>
                        </label>
                        <Input
                          id="connectionString"
                          value={connectionString}
                          onChange={(e) => setConnectionString(e.target.value)}
                          placeholder="postgres://username:password@host:port/database?sslmode=require"
                          className="h-9 text-sm font-mono"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Example: postgres://user:password@db.example.com:5432/mydb?sslmode=require
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleParseConnectionString}
                        className="h-9 w-full"
                      >
                        Parse Connection String
                      </Button>
                    </div>
                  </div>

                  {/* Show parsed values if available */}
                  {(host && username && database && connectionString) && (
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs font-medium mb-2">Parsed Connection Details:</p>
                      <div className="grid gap-1 text-xs text-muted-foreground font-mono">
                        <div><span className="text-foreground">Host:</span> {host}:{port}</div>
                        <div><span className="text-foreground">Database:</span> {database}</div>
                        <div><span className="text-foreground">Username:</span> {username}</div>
                        <div><span className="text-foreground">Password:</span> {password ? '••••••••' : 'Not set'}</div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="direct" className="mt-4 space-y-3">
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <p className="text-xs text-muted-foreground mb-3">Server Connection Details</p>
                    <div className="grid gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <label htmlFor="host" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Host <span className="text-destructive">*</span>
                          </label>
                          <Input
                            id="host"
                            value={host}
                            onChange={(e) => setHost(e.target.value)}
                            placeholder="localhost"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="grid gap-2">
                          <label htmlFor="port" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Port <span className="text-destructive">*</span>
                          </label>
                          <Input
                            id="port"
                            value={port}
                            onChange={(e) => setPort(e.target.value)}
                            placeholder={dbType === "postgresql" ? "5432" : "3306"}
                            className="h-9 text-sm font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <label htmlFor="database" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Database <span className="text-destructive">*</span>
                        </label>
                        <Input
                          id="database"
                          value={database}
                          onChange={(e) => setDatabase(e.target.value)}
                          placeholder="database_name"
                          className="h-9 text-sm font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <p className="text-xs text-muted-foreground mb-3">Authentication</p>
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <label htmlFor="username" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Username <span className="text-destructive">*</span>
                        </label>
                        <Input
                          id="username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="postgres"
                          className="h-9 text-sm"
                        />
                      </div>

                      <div className="grid gap-2">
                        <label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Password <span className="text-destructive">*</span>
                        </label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="ssh" className="mt-4 space-y-3">
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <p className="text-xs text-muted-foreground mb-3">SSH Tunnel Configuration</p>
                    <div className="grid gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <label htmlFor="sshHost" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            SSH Host <span className="text-destructive">*</span>
                          </label>
                          <Input
                            id="sshHost"
                            value={sshHost}
                            onChange={(e) => setSshHost(e.target.value)}
                            placeholder="ssh.example.com"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="grid gap-2">
                          <label htmlFor="sshPort" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            SSH Port <span className="text-destructive">*</span>
                          </label>
                          <Input
                            id="sshPort"
                            value={sshPort}
                            onChange={(e) => setSshPort(e.target.value)}
                            placeholder="22"
                            className="h-9 text-sm font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <label htmlFor="sshUsername" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          SSH Username <span className="text-destructive">*</span>
                        </label>
                        <Input
                          id="sshUsername"
                          value={sshUsername}
                          onChange={(e) => setSshUsername(e.target.value)}
                          placeholder="ubuntu"
                          className="h-9 text-sm"
                        />
                      </div>

                      <div className="grid gap-2">
                        <label htmlFor="sshAuthMethod" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Authentication Method <span className="text-destructive">*</span>
                        </label>
                        <Select
                          value={sshAuthMethod}
                          onValueChange={(v) => setSshAuthMethod(v as SSHAuthMethod)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="password">Password</SelectItem>
                            <SelectItem value="privateKey">Private Key</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {sshAuthMethod === "password" ? (
                        <div className="grid gap-2">
                          <label htmlFor="sshPassword" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            SSH Password <span className="text-destructive">*</span>
                          </label>
                          <Input
                            id="sshPassword"
                            type="password"
                            value={sshPassword}
                            onChange={(e) => setSshPassword(e.target.value)}
                            placeholder="••••••••"
                            className="h-9 text-sm"
                          />
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          <label htmlFor="sshPrivateKeyPath" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Private Key Path <span className="text-destructive">*</span>
                          </label>
                          <div className="flex gap-2">
                            <Input
                              id="sshPrivateKeyPath"
                              value={sshPrivateKeyPath}
                              onChange={(e) => setSshPrivateKeyPath(e.target.value)}
                              placeholder="~/.ssh/id_rsa"
                              className="h-9 text-sm font-mono"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleBrowseSshKey}
                              className="h-9 shrink-0"
                            >
                              Browse
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <p className="text-xs text-muted-foreground mb-3">Database Connection (via SSH Tunnel)</p>
                    <div className="grid gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <label htmlFor="dbHost" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            DB Host <span className="text-destructive">*</span>
                          </label>
                          <Input
                            id="dbHost"
                            value={host}
                            onChange={(e) => setHost(e.target.value)}
                            placeholder="localhost"
                            className="h-9 text-sm"
                          />
                          <p className="text-[10px] text-muted-foreground">Usually 'localhost' when using SSH tunnel</p>
                        </div>
                        <div className="grid gap-2">
                          <label htmlFor="dbPort" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            DB Port <span className="text-destructive">*</span>
                          </label>
                          <Input
                            id="dbPort"
                            value={port}
                            onChange={(e) => setPort(e.target.value)}
                            placeholder={dbType === "postgresql" ? "5432" : "3306"}
                            className="h-9 text-sm font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <label htmlFor="sshDatabase" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Database <span className="text-destructive">*</span>
                        </label>
                        <Input
                          id="sshDatabase"
                          value={database}
                          onChange={(e) => setDatabase(e.target.value)}
                          placeholder="database_name"
                          className="h-9 text-sm font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <p className="text-xs text-muted-foreground mb-3">Database Authentication</p>
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <label htmlFor="sshDbUsername" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          DB Username <span className="text-destructive">*</span>
                        </label>
                        <Input
                          id="sshDbUsername"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="postgres"
                          className="h-9 text-sm"
                        />
                      </div>

                      <div className="grid gap-2">
                        <label htmlFor="sshDbPassword" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          DB Password <span className="text-destructive">*</span>
                        </label>
                        <Input
                          id="sshDbPassword"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
          </div>
        </ScrollArea>

        {testResult && (
          <Alert variant={testResult.success ? "default" : "destructive"} className="mx-6">
            {testResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertTitle>{testResult.success ? "Connection Successful" : "Connection Failed"}</AlertTitle>
            <AlertDescription>
              {testResult.success ? (
                <>
                  Latency: {testResult.latency_ms}ms • {testResult.db_version}
                </>
              ) : (
                <>{testResult.error}</>
              )}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9">
            Cancel
          </Button>
          <Button 
            variant="secondary" 
            onClick={handleTestConnection} 
            disabled={isTesting || isConnecting} 
            className="h-9"
          >
            {isTesting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Connection"
            )}
          </Button>
          <Button onClick={handleConnect} disabled={isConnecting || isTesting} className="h-9">
            {isConnecting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Database className="h-3.5 w-3.5 mr-2" />
                Connect
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
