import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConnectionConfig, DatabaseType } from "@/types";
import { useConnectionStore } from "@/stores/connectionStore";
import { toast } from "sonner";

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

  const addConnection = useConnectionStore((state) => state.addConnection);
  const setActiveConnection = useConnectionStore(
    (state) => state.setActiveConnection
  );

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Database Connection</DialogTitle>
          <DialogDescription>
            Configure your database connection settings
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium">
              Connection Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Database"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="dbType" className="text-sm font-medium">
              Database Type
            </label>
            <Select
              value={dbType}
              onValueChange={(v) => setDbType(v as DatabaseType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sqlite">SQLite</SelectItem>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                <SelectItem value="mysql">MySQL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dbType === "sqlite" ? (
            <div className="grid gap-2">
              <label htmlFor="filePath" className="text-sm font-medium">
                Database File
              </label>
              <div className="flex gap-2">
                <Input
                  id="filePath"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  placeholder="/path/to/database.db"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBrowseFile}
                >
                  Browse
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label htmlFor="host" className="text-sm font-medium">
                    Host
                  </label>
                  <Input
                    id="host"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="localhost"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="port" className="text-sm font-medium">
                    Port
                  </label>
                  <Input
                    id="port"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder={dbType === "postgresql" ? "5432" : "3306"}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Username
                </label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="database" className="text-sm font-medium">
                  Database
                </label>
                <Input
                  id="database"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="database_name"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? "Connecting..." : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
