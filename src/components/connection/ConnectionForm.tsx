import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Database, Loader2, CheckCircle, XCircle, Info, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DbIcon } from "@/components/DbIcon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CollapsibleAlert } from "@/components/ui/collapsible-alert";
import { parsePostgresConnectionString } from "@/lib/connectionStringParser";
import {
  ConnectionConfig,
  DatabaseType,
  DatabaseProvider,
  MariaDBAuthMethod,
  ConnectionTestResult,
  SSHAuthMethod,
} from "@/types";
import { toast } from "sonner";

export interface ConnectionFormProps {
  initialConfig?: ConnectionConfig | null;
  onSuccess: (config: ConnectionConfig, isEdit: boolean) => Promise<void> | void;
  onCancel: () => void;
}

export function ConnectionForm({
  initialConfig,
  onSuccess,
  onCancel,
}: ConnectionFormProps) {
  const isEditMode = Boolean(initialConfig);

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
  const [connectionType, setConnectionType] = useState<
    "direct" | "ssh" | "connectionString"
  >("direct");
  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState("22");
  const [sshUsername, setSshUsername] = useState("");
  const [sshAuthMethod, setSshAuthMethod] = useState<SSHAuthMethod>("password");
  const [sshPassword, setSshPassword] = useState("");
  const [sshPrivateKeyPath, setSshPrivateKeyPath] = useState("");

  // Cloud provider (supabase | neon | mariadb | cloudflare | prisma | turso | valtown | planetscale | planetscale_postgres)
  const [provider, setProvider] = useState<DatabaseProvider | undefined>(undefined);

  // MariaDB auth method + cloud credential fields
  const [authMethod, setAuthMethod] = useState<MariaDBAuthMethod>("password");
  const [awsRegion, setAwsRegion] = useState("");
  const [awsDbUser, setAwsDbUser] = useState("");
  const [awsAccessKeyId, setAwsAccessKeyId] = useState("");
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState("");
  const [azureTenantId, setAzureTenantId] = useState("");
  const [gcpProject, setGcpProject] = useState("");

  // MongoDB auth state
  const [mongoAuthMethod, setMongoAuthMethod] = useState<"password" | "atlas">("password");
  const [mongoConnectionString, setMongoConnectionString] = useState("");
  const [mongoAuthSource, setMongoAuthSource] = useState("");

  // ClickHouse SSL state
  const [clickhouseUseSsl, setClickhouseUseSsl] = useState(false);

  // LibSQL / Turso / Val Town state
  const [libsqlUrl, setLibsqlUrl] = useState("");
  const [libsqlAuthToken, setLibsqlAuthToken] = useState("");

  // Redis state
  const [redisDb, setRedisDb] = useState(0);

  // Cloudflare D1 state
  const [cloudflareAccountId, setCloudflareAccountId] = useState("");
  const [cloudflareDatabaseId, setCloudflareDatabaseId] = useState("");
  const [cloudflareApiToken, setCloudflareApiToken] = useState("");

  // Populate form when editing an existing connection or reset on create mode
  useEffect(() => {
    if (initialConfig) {
      setName(initialConfig.name);
      setDbType(initialConfig.db_type);
      setProvider(initialConfig.provider);
      setAuthMethod(initialConfig.auth_method ?? "password");
      setAwsRegion(initialConfig.aws_region ?? "");
      setAwsDbUser(initialConfig.aws_db_user ?? "");
      setAwsAccessKeyId(initialConfig.aws_access_key_id ?? "");
      setAwsSecretAccessKey(initialConfig.aws_secret_access_key ?? "");
      setAzureTenantId(initialConfig.azure_tenant_id ?? "");
      setGcpProject(initialConfig.gcp_project ?? "");
      setMongoAuthMethod(initialConfig.mongo_auth_method ?? "password");
      setMongoConnectionString(initialConfig.mongo_connection_string ?? "");
      setMongoAuthSource(initialConfig.mongo_auth_source ?? "");
      setClickhouseUseSsl(initialConfig.clickhouse_use_ssl ?? false);
      setLibsqlUrl(initialConfig.libsql_url ?? "");
      setLibsqlAuthToken(initialConfig.libsql_auth_token ?? "");
      setRedisDb(initialConfig.redis_db ?? 0);
      setCloudflareAccountId(initialConfig.cloudflare_account_id ?? "");
      setCloudflareDatabaseId(initialConfig.cloudflare_database_id ?? "");
      setCloudflareApiToken(initialConfig.cloudflare_api_token ?? "");

      if (initialConfig.db_type === "sqlite") {
        setFilePath(initialConfig.file_path ?? "");
      } else {
        setHost(initialConfig.host ?? "localhost");
        setPort(
          String(
            initialConfig.port ??
              (initialConfig.db_type === "redis"
                ? 6379
                : initialConfig.db_type === "mongodb"
                ? 27017
                : initialConfig.db_type === "clickhouse"
                ? 8123
                : 5432)
          )
        );
        setUsername(initialConfig.username ?? "");
        setPassword(initialConfig.password ?? "");
        setDatabase(initialConfig.database ?? "");
      }

      const ssh = initialConfig.ssh_config;
      if (ssh?.enabled) {
        setConnectionType("ssh");
        setSshHost(ssh.host ?? "");
        setSshPort(String(ssh.port ?? 22));
        setSshUsername(ssh.username ?? "");
        const method = ssh.authMethod ?? ssh.auth_method;
        setSshAuthMethod(
          method === "privateKey" || method === "privatekey"
            ? "privateKey"
            : "password"
        );
        setSshPassword(ssh.password ?? "");
        setSshPrivateKeyPath(ssh.privateKeyPath ?? ssh.private_key_path ?? "");
      } else {
        setConnectionType("direct");
      }
      setTestResult(null);
    } else {
      // Reset form to defaults
      setName("");
      setDbType("sqlite");
      setProvider(undefined);
      setAuthMethod("password");
      setAwsRegion("");
      setAwsDbUser("");
      setAwsAccessKeyId("");
      setAwsSecretAccessKey("");
      setAzureTenantId("");
      setGcpProject("");
      setMongoAuthMethod("password");
      setMongoConnectionString("");
      setMongoAuthSource("");
      setClickhouseUseSsl(false);
      setLibsqlUrl("");
      setLibsqlAuthToken("");
      setRedisDb(0);
      setCloudflareAccountId("");
      setCloudflareDatabaseId("");
      setCloudflareApiToken("");
      setHost("localhost");
      setPort("5432");
      setUsername("");
      setPassword("");
      setDatabase("");
      setFilePath("");
      setConnectionType("direct");
      setSshHost("");
      setSshPort("22");
      setSshUsername("");
      setSshAuthMethod("password");
      setSshPassword("");
      setSshPrivateKeyPath("");
      setTestResult(null);
    }
  }, [initialConfig]);

  const selectValue =
    provider === "cloudflare"
      ? "cloudflare"
      : provider === "prisma"
      ? "prisma"
      : provider === "turso"
      ? "turso"
      : provider === "valtown"
      ? "valtown"
      : provider === "supabase"
      ? "supabase"
      : provider === "neon"
      ? "neon"
      : provider === "mariadb"
      ? "mariadb"
      : provider === "planetscale"
      ? "planetscale"
      : provider === "planetscale_postgres"
      ? "planetscale_postgres"
      : dbType;

  const handleDbTypeOrProviderChange = (value: string) => {
    if (value === "cloudflare") {
      setDbType("sqlite");
      setProvider("cloudflare");
      setConnectionType("direct");
    } else if (value === "redis") {
      setDbType("redis");
      setProvider(undefined);
      setPort("6379");
      setRedisDb(0);
      setConnectionType("direct");
    } else if (value === "prisma") {
      setDbType("postgresql");
      setProvider("prisma");
      setPort("5432");
      setConnectionType("connectionString");
    } else if (value === "turso") {
      setDbType("libsql");
      setProvider("turso");
      setConnectionType("direct");
    } else if (value === "valtown") {
      setDbType("libsql");
      setProvider("valtown");
      setConnectionType("direct");
    } else if (value === "libsql") {
      setDbType("libsql");
      setProvider(undefined);
      setConnectionType("direct");
    } else if (value === "supabase") {
      setDbType("postgresql");
      setProvider("supabase");
      setPort("5432");
      setConnectionType("connectionString");
    } else if (value === "neon") {
      setDbType("postgresql");
      setProvider("neon");
      setPort("5432");
      setConnectionType("connectionString");
    } else if (value === "mariadb") {
      setDbType("mysql");
      setProvider("mariadb");
      setPort("3306");
      setAuthMethod("password");
      setConnectionType("direct");
    } else if (value === "planetscale") {
      setDbType("mysql");
      setProvider("planetscale");
      setPort("3306");
      setConnectionType("direct");
    } else if (value === "planetscale_postgres") {
      setDbType("postgresql");
      setProvider("planetscale_postgres");
      setPort("5432");
      setConnectionType("direct");
    } else if (value === "mongodb") {
      setDbType("mongodb");
      setProvider(undefined);
      setPort("27017");
      setMongoAuthMethod("password");
      setConnectionType("direct");
    } else if (value === "clickhouse") {
      setDbType("clickhouse");
      setProvider(undefined);
      setPort("8123");
      setConnectionType("direct");
    } else {
      setDbType(value as DatabaseType);
      setProvider(undefined);
      setAuthMethod("password");
      if (value === "postgresql") setPort("5432");
      if (value === "mysql") setPort("3306");
      if (value === "redis") setPort("6379");
    }
  };

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
      console.error(error);
    }
  };

  const buildCurrentConfig = (idOverride?: string): ConnectionConfig => {
    const sshConfigPartial =
      connectionType === "ssh" && dbType !== "sqlite" && dbType !== "libsql"
        ? {
            ssh_config: {
              enabled: true,
              host: sshHost,
              port: parseInt(sshPort) || 22,
              username: sshUsername,
              auth_method: sshAuthMethod,
              password: sshAuthMethod === "password" ? sshPassword : undefined,
              private_key_path:
                sshAuthMethod === "privateKey" ? sshPrivateKeyPath : undefined,
            },
          }
        : {};

    const mongoFields = {
      mongo_auth_method: dbType === "mongodb" ? mongoAuthMethod : undefined,
      mongo_connection_string:
        dbType === "mongodb" && mongoAuthMethod === "atlas"
          ? mongoConnectionString
          : undefined,
      mongo_auth_source:
        dbType === "mongodb" && mongoAuthSource ? mongoAuthSource : undefined,
    };

    const libsqlFields = {
      libsql_url: dbType === "libsql" ? libsqlUrl : undefined,
      libsql_auth_token: dbType === "libsql" ? libsqlAuthToken : undefined,
    };

    const redisFields = {
      redis_db: dbType === "redis" ? redisDb : undefined,
    };

    const cloudflareFields = {
      cloudflare_account_id:
        provider === "cloudflare" ? cloudflareAccountId : undefined,
      cloudflare_database_id:
        provider === "cloudflare" ? cloudflareDatabaseId : undefined,
      cloudflare_api_token:
        provider === "cloudflare" ? cloudflareApiToken : undefined,
    };

    return {
      ...(initialConfig && isEditMode ? initialConfig : {}),
      id: idOverride ?? initialConfig?.id ?? crypto.randomUUID(),
      name: name.trim() || (isEditMode ? initialConfig?.name ?? "Database" : "New Connection"),
      db_type: dbType,
      provider,
      auth_method: provider === "mariadb" ? authMethod : undefined,
      aws_region: awsRegion || undefined,
      aws_db_user: awsDbUser || undefined,
      aws_access_key_id: awsAccessKeyId || undefined,
      aws_secret_access_key: awsSecretAccessKey || undefined,
      azure_tenant_id: azureTenantId || undefined,
      gcp_project: gcpProject || undefined,
      ...mongoFields,
      ...libsqlFields,
      ...redisFields,
      ...cloudflareFields,
      clickhouse_use_ssl: dbType === "clickhouse" ? clickhouseUseSsl : undefined,
      ...(dbType === "sqlite" || dbType === "libsql"
        ? {
            file_path: filePath,
            host: undefined,
            port: undefined,
            username: undefined,
            password: undefined,
            database: undefined,
          }
        : {
            host: host.trim(),
            port: parseInt(port) || 5432,
            username: username.trim(),
            password,
            database: database.trim() || (dbType === "mongodb" ? "admin" : "postgres"),
            file_path: undefined,
          }),
      ...sshConfigPartial,
    };
  };

  const handleTestConnection = async () => {
    if (dbType === "sqlite" && !filePath) {
      toast.error("Please select a database file");
      return;
    }

    if (dbType === "libsql") {
      if (!libsqlUrl.trim()) {
        toast.error("Please enter a LibSQL Connection URI");
        return;
      }
    } else if (dbType === "mongodb") {
      if (mongoAuthMethod === "atlas" && !mongoConnectionString.trim()) {
        toast.error("Please enter an Atlas connection string");
        return;
      }
      if (mongoAuthMethod === "password" && (!host || !username)) {
        toast.error("Please fill in host and username");
        return;
      }
    } else if (dbType !== "sqlite" && (!host || !username || !database)) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate SSH config if using SSH tunnel
    if (connectionType === "ssh" && dbType !== "sqlite" && dbType !== "libsql") {
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
      const config = buildCurrentConfig("test");
      const result = await invoke<ConnectionTestResult>("test_connection", {
        config,
      });
      setTestResult(result);

      if (result.success) {
        toast.success(
          `Connection successful! ${result.db_version} (${result.latency_ms}ms)`
        );
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

  const handleConnect = async () => {
    if (!name.trim()) {
      toast.error("Please enter a connection name");
      return;
    }

    if (dbType === "libsql") {
      if (!libsqlUrl.trim()) {
        toast.error("Please enter a LibSQL Connection URI");
        return;
      }
    } else if (dbType === "mongodb") {
      if (mongoAuthMethod === "atlas" && !mongoConnectionString.trim()) {
        toast.error("Please enter an Atlas connection string");
        return;
      }
      if (mongoAuthMethod === "password" && (!host || !username)) {
        toast.error("Please fill in host and username");
        return;
      }
    } else if (dbType !== "sqlite" && (!host || !username || !database)) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate SSH config if using SSH tunnel
    if (connectionType === "ssh" && dbType !== "sqlite" && dbType !== "libsql") {
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
      const finalConfig = buildCurrentConfig();

      if (!isEditMode) {
        // Test & connect database before registering
        await invoke<string>("connect_database", { config: finalConfig });
      }

      await onSuccess(finalConfig, isEditMode);
    } catch (error) {
      toast.error(String(error));
      console.error("Connection error:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scrollable form body */}
      <ScrollArea className="flex-1 overflow-y-auto px-6 py-4">
        <div className="grid gap-4 max-w-2xl mx-auto pb-4">
          <div className="grid gap-2">
            <label
              htmlFor="name"
              className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
            >
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
            <label
              htmlFor="dbType"
              className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
            >
              Database Type <span className="text-destructive">*</span>
            </label>
            <Select
              value={selectValue}
              onValueChange={handleDbTypeOrProviderChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 pb-1">
                    Core Databases
                  </SelectLabel>
                  <SelectItem value="sqlite">
                    <div className="flex items-center gap-2">
                      <DbIcon dbType="sqlite" className="h-4 w-4 shrink-0" />
                      <div>
                        <span>SQLite</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          Local file
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="postgresql">
                    <div className="flex items-center gap-2">
                      <DbIcon dbType="postgresql" className="h-4 w-4 shrink-0" />
                      <div>
                        <span>PostgreSQL</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          Server
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="mysql">
                    <div className="flex items-center gap-2">
                      <DbIcon dbType="mysql" className="h-4 w-4 shrink-0" />
                      <div>
                        <span>MySQL</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          Server
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="mariadb">
                    <div className="flex items-center gap-2">
                      <DbIcon dbType="mariadb" className="h-4 w-4 shrink-0" />
                      <div>
                        <span>MariaDB</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          Server
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="mongodb">
                    <div className="flex items-center gap-2">
                      <DbIcon dbType="mongodb" className="h-4 w-4 shrink-0" />
                      <div>
                        <span>MongoDB</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          Document DB
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="clickhouse">
                    <div className="flex items-center gap-2">
                      <DbIcon dbType="clickhouse" className="h-4 w-4 shrink-0" />
                      <div>
                        <span>ClickHouse</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          Columnar OLAP
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="libsql">
                    <div className="flex items-center gap-2">
                      <DbIcon provider="turso" className="h-4 w-4 shrink-0" />
                      <div>
                        <span>LibSQL</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          Embedded / HTTP SQLite
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="redis">
                    <div className="flex items-center gap-2">
                      <DbIcon dbType="redis" className="h-4 w-4 shrink-0" />
                      <div>
                        <span>Redis</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          In-Memory KV Store
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 pb-1">
                    Cloud Providers
                  </SelectLabel>
                  <SelectItem value="cloudflare">
                    <div className="flex items-center gap-2">
                      <DbIcon provider="cloudflare" className="h-4 w-4 shrink-0" />
                      <div>
                        <span>Cloudflare D1</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          Serverless SQLite
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="prisma">
                    <div className="flex items-center gap-2">
                      <DbIcon provider="prisma" className="h-4 w-4 shrink-0" />
                      <div>
                        <span>Prisma</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          Prisma Postgres / Accelerate
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="turso">
                    <div className="flex items-center gap-2">
                      <DbIcon provider="turso" className="h-4 w-4 shrink-0" />
                      <div>
                        <span>Turso</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          Hosted LibSQL Database
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="valtown">
                    <div className="flex items-center gap-2">
                      <DbIcon provider="valtown" className="h-4 w-4 shrink-0" />
                      <div>
                        <span>Val Town</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          Hosted LibSQL / SQLite
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="supabase">
                    <div className="flex items-center gap-2">
                      <DbIcon dbType="supabase" className="h-4 w-4 shrink-0" />
                      <div>
                        <span>Supabase</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          PostgreSQL
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="neon">
                    <div className="flex items-center gap-2">
                      <DbIcon dbType="neon" className="h-4 w-4 shrink-0" />
                      <div>
                        <span>Neon</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          Serverless PostgreSQL
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="planetscale">
                    <div className="flex items-center gap-2">
                      <DbIcon provider="planetscale" className="h-4 w-4 shrink-0" />
                      <div>
                        <span>PlanetScale (MySQL)</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          Vitess / MySQL Wire
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="planetscale_postgres">
                    <div className="flex items-center gap-2">
                      <DbIcon provider="planetscale" className="h-4 w-4 shrink-0" />
                      <div>
                        <span>PlanetScale (Postgres)</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          PostgreSQL Wire
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {provider === "cloudflare" ? (
            <div className="space-y-3">
              <CollapsibleAlert
                variant="info"
                icon={<Info className="h-3.5 w-3.5" />}
                title="Cloudflare D1 Database Setup"
              >
                <p className="mb-1">
                  Find your <strong>Account ID</strong> at{" "}
                  <code className="bg-muted px-1 rounded">
                    dash.cloudflare.com/[account-id]
                  </code>
                  , your <strong>Database ID</strong> (UUID) via dashboard or{" "}
                  <code className="bg-muted px-1 rounded">
                    wrangler d1 list
                  </code>
                  , and create an <strong>API Token</strong> with D1 permissions
                  at{" "}
                  <code className="bg-muted px-1 rounded">
                    dash.cloudflare.com/profile/api-tokens
                  </code>
                  .
                </p>
              </CollapsibleAlert>

              <div className="grid gap-2">
                <label
                  htmlFor="cfAccountId"
                  className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Account ID <span className="text-destructive">*</span>
                </label>
                <Input
                  id="cfAccountId"
                  value={cloudflareAccountId}
                  onChange={(e) => setCloudflareAccountId(e.target.value)}
                  placeholder="e.g. 8f9b4c2e1a3b5c7d9e0f1a2b3c4d5e6f"
                  className="h-9 text-sm font-mono"
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="cfDbId"
                  className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Database ID (UUID) <span className="text-destructive">*</span>
                </label>
                <Input
                  id="cfDbId"
                  value={cloudflareDatabaseId}
                  onChange={(e) => setCloudflareDatabaseId(e.target.value)}
                  placeholder="e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="h-9 text-sm font-mono"
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="cfApiToken"
                  className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                >
                  API Token <span className="text-destructive">*</span>
                </label>
                <Input
                  id="cfApiToken"
                  type="password"
                  value={cloudflareApiToken}
                  onChange={(e) => setCloudflareApiToken(e.target.value)}
                  placeholder="Cloudflare API Token with D1 permissions"
                  className="h-9 text-sm font-mono"
                />
              </div>
            </div>
          ) : dbType === "redis" ? (
            <div className="space-y-3">
              <CollapsibleAlert
                variant="info"
                icon={<Info className="h-3.5 w-3.5" />}
                title="Redis Connection Setup"
              >
                <p className="mb-1">
                  Connect to your Redis instance. Select database index{" "}
                  <strong>0-15</strong> (default 0). Username and password are
                  optional.
                </p>
              </CollapsibleAlert>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 grid gap-1.5">
                  <label
                    htmlFor="redisHost"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Host <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="redisHost"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="localhost"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label
                    htmlFor="redisPort"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Port <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="redisPort"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="6379"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1.5">
                  <label
                    htmlFor="redisUser"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Username{" "}
                    <span className="text-muted-foreground text-[10px] lowercase">
                      (optional)
                    </span>
                  </label>
                  <Input
                    id="redisUser"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="default"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label
                    htmlFor="redisPass"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Password{" "}
                    <span className="text-muted-foreground text-[10px] lowercase">
                      (optional)
                    </span>
                  </label>
                  <Input
                    id="redisPass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label
                  htmlFor="redisDb"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Database Index (0-15)
                </label>
                <Select
                  value={String(redisDb)}
                  onValueChange={(v) => setRedisDb(parseInt(v))}
                >
                  <SelectTrigger id="redisDb" className="h-8 text-xs font-mono">
                    <SelectValue placeholder="0" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 16 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        db{i} {i === 0 ? "(Default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : dbType === "sqlite" ? (
            <div className="grid gap-2">
              <label
                htmlFor="filePath"
                className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
              >
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
          ) : dbType === "libsql" ? (
            <div className="space-y-3">
              {provider === "turso" && (
                <CollapsibleAlert
                  variant="info"
                  icon={<Info className="h-3.5 w-3.5" />}
                  title="Turso Connection Setup"
                >
                  <p className="mb-1">
                    Provide your Turso database URL (e.g.{" "}
                    <code className="bg-muted px-1 rounded">
                      libsql://my-db-org.turso.io
                    </code>
                    ) and your auth token generated via{" "}
                    <code className="bg-muted px-1 rounded">
                      turso db tokens create &lt;db&gt;
                    </code>
                    .
                  </p>
                </CollapsibleAlert>
              )}
              {provider === "valtown" && (
                <CollapsibleAlert
                  variant="info"
                  icon={<Info className="h-3.5 w-3.5" />}
                  title="Val Town SQLite Setup"
                >
                  <p className="mb-1">
                    Val Town SQLite is powered by LibSQL. Get your database
                    Connection URI and API / Auth Token from Val Town settings or{" "}
                    <code className="bg-muted px-1 rounded">@std/sqlite</code>{" "}
                    environment variables.
                  </p>
                </CollapsibleAlert>
              )}
              {!provider && (
                <CollapsibleAlert
                  variant="info"
                  icon={<Info className="h-3.5 w-3.5" />}
                  title="LibSQL Connection URI & Token"
                >
                  <p className="mb-1">
                    Connect to any LibSQL / hrana HTTP endpoint using your
                    database URL (
                    <code className="bg-muted px-1 rounded">https://...</code>{" "}
                    or{" "}
                    <code className="bg-muted px-1 rounded">libsql://...</code>)
                    and Bearer auth token.
                  </p>
                </CollapsibleAlert>
              )}

              <div className="grid gap-2">
                <label
                  htmlFor="libsqlUrl"
                  className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Connection URI <span className="text-destructive">*</span>
                </label>
                <Input
                  id="libsqlUrl"
                  value={libsqlUrl}
                  onChange={(e) => setLibsqlUrl(e.target.value)}
                  placeholder={
                    provider === "turso"
                      ? "libsql://my-db-org.turso.io"
                      : provider === "valtown"
                      ? "https://my-valtown-db.turso.io"
                      : "libsql://my-database.turso.io"
                  }
                  className="h-9 text-sm font-mono"
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="libsqlAuthToken"
                  className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Auth Token{" "}
                  <span className="text-muted-foreground text-[10px] lowercase">
                    (optional if local)
                  </span>
                </label>
                <Input
                  id="libsqlAuthToken"
                  type="password"
                  value={libsqlAuthToken}
                  onChange={(e) => setLibsqlAuthToken(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="h-9 text-sm font-mono"
                />
              </div>
            </div>
          ) : (
            <>
              {provider === "prisma" && (
                <CollapsibleAlert
                  variant="info"
                  icon={<Info className="h-3.5 w-3.5" />}
                  title="Prisma Postgres & Accelerate"
                >
                  <p className="mb-1">
                    Use your Prisma Postgres or Prisma Accelerate connection
                    string (
                    <code className="bg-muted px-1 rounded">prisma://...</code>{" "}
                    or direct{" "}
                    <code className="bg-muted px-1 rounded">
                      postgres://...
                    </code>
                    ) in the Connection String tab.
                  </p>
                </CollapsibleAlert>
              )}
              {(provider === "planetscale" ||
                provider === "planetscale_postgres") && (
                <CollapsibleAlert
                  variant="info"
                  icon={<Info className="h-3.5 w-3.5" />}
                  title="PlanetScale Secure TLS Connection"
                >
                  <p className="mb-1">
                    PlanetScale requires secure TLS (
                    <code className="bg-muted px-1 rounded">
                      ssl-mode=required
                    </code>
                    ). Standard authentication works with branch connection
                    credentials.
                  </p>
                </CollapsibleAlert>
              )}
              {provider === "supabase" && (
                <CollapsibleAlert
                  variant="success"
                  icon={<Info className="h-3.5 w-3.5" />}
                  title="IPv4 Compatibility Notice"
                >
                  <p className="mb-1">
                    Supabase direct connections require <strong>IPv6</strong>.
                    If you&apos;re on IPv4:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>
                      Use the <strong>Session Pooler</strong> connection string
                      (recommended)
                    </li>
                    <li>
                      Or purchase the IPv4 add-on from Supabase Dashboard
                    </li>
                  </ul>
                </CollapsibleAlert>
              )}
              {provider === "neon" && (
                <div className="space-y-1.5">
                  <CollapsibleAlert
                    variant="info"
                    icon={<Zap className="h-3.5 w-3.5" />}
                    title="Connection Pooling"
                  >
                    <p className="mb-1">
                      Add{" "}
                      <code className="bg-muted px-1 rounded">-pooler</code> to
                      your endpoint:
                    </p>
                    <p className="font-mono text-[10px] bg-muted px-2 py-1 rounded break-all">
                      ep-cool-darkness-123456
                      <strong>-pooler</strong>.us-east-2.aws.neon.tech
                    </p>
                  </CollapsibleAlert>
                  <CollapsibleAlert
                    variant="warning"
                    icon={<AlertTriangle className="h-3.5 w-3.5" />}
                    title="Scale to Zero — 5-min idle timeout"
                  >
                    Neon databases sleep after <strong>5 minutes</strong> of
                    inactivity. Long-running transactions may be interrupted.
                  </CollapsibleAlert>
                </div>
              )}
              {provider === "mariadb" && (
                <div className="space-y-3">
                  <div className="grid gap-2">
                    <label className="!text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Authentication Method
                    </label>
                    <Select
                      value={authMethod}
                      onValueChange={(v) =>
                        setAuthMethod(v as MariaDBAuthMethod)
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="password">
                          User &amp; Password
                        </SelectItem>
                        <SelectItem value="aws_iam">AWS IAM</SelectItem>
                        <SelectItem value="azure_ad">Azure AD</SelectItem>
                        <SelectItem value="gcp_iam">GCP IAM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {authMethod === "aws_iam" && (
                    <CollapsibleAlert
                      variant="info"
                      icon={<Info className="h-3.5 w-3.5" />}
                      title="AWS IAM — RDS Auth Token"
                    >
                      <p className="mb-1">
                        Requires the <strong>AWS CLI</strong> (
                        <code className="bg-muted px-1 rounded">
                          aws configure
                        </code>
                        ) to be installed and authenticated. SSL is enabled
                        automatically.
                      </p>
                      <p>
                        The DB user must have IAM authentication enabled in
                        RDS/Aurora MariaDB.
                      </p>
                    </CollapsibleAlert>
                  )}
                  {authMethod === "azure_ad" && (
                    <CollapsibleAlert
                      variant="info"
                      icon={<Info className="h-3.5 w-3.5" />}
                      title="Azure AD — Access Token"
                    >
                      <p className="mb-1">
                        Requires the <strong>Azure CLI</strong> (
                        <code className="bg-muted px-1 rounded">az login</code>)
                        to be installed and authenticated.
                      </p>
                      <p>
                        The user must be added as an Azure AD admin in the Azure
                        Database for MariaDB resource.
                      </p>
                    </CollapsibleAlert>
                  )}
                  {authMethod === "gcp_iam" && (
                    <CollapsibleAlert
                      variant="info"
                      icon={<Info className="h-3.5 w-3.5" />}
                      title="GCP IAM — Cloud SQL Auth"
                    >
                      <p className="mb-1">
                        Requires the <strong>gcloud CLI</strong> (
                        <code className="bg-muted px-1 rounded">
                          gcloud auth login
                        </code>
                        ) to be installed and authenticated.
                      </p>
                      <p>
                        IAM database authentication must be enabled on the
                        Cloud SQL instance.
                      </p>
                    </CollapsibleAlert>
                  )}

                  {authMethod === "aws_iam" && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            AWS Region <span className="text-destructive">*</span>
                          </label>
                          <Input
                            value={awsRegion}
                            onChange={(e) => setAwsRegion(e.target.value)}
                            placeholder="us-east-1"
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            DB IAM User <span className="text-destructive">*</span>
                          </label>
                          <Input
                            value={awsDbUser}
                            onChange={(e) => setAwsDbUser(e.target.value)}
                            placeholder="iam_db_user"
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Access Key ID{" "}
                            <span className="text-[10px] text-muted-foreground">
                              (optional)
                            </span>
                          </label>
                          <Input
                            value={awsAccessKeyId}
                            onChange={(e) => setAwsAccessKeyId(e.target.value)}
                            placeholder="AKIA… (uses env/profile if blank)"
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Secret Access Key{" "}
                            <span className="text-[10px] text-muted-foreground">
                              (optional)
                            </span>
                          </label>
                          <Input
                            type="password"
                            value={awsSecretAccessKey}
                            onChange={(e) =>
                              setAwsSecretAccessKey(e.target.value)
                            }
                            placeholder="••••••••"
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {authMethod === "azure_ad" && (
                    <div className="grid gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Tenant ID{" "}
                        <span className="text-[10px] text-muted-foreground">
                          (optional — uses default tenant if blank)
                        </span>
                      </label>
                      <Input
                        value={azureTenantId}
                        onChange={(e) => setAzureTenantId(e.target.value)}
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  )}

                  {authMethod === "gcp_iam" && (
                    <div className="grid gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        GCP Project ID{" "}
                        <span className="text-[10px] text-muted-foreground">
                          (optional)
                        </span>
                      </label>
                      <Input
                        value={gcpProject}
                        onChange={(e) => setGcpProject(e.target.value)}
                        placeholder="my-gcp-project"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              {dbType === "mongodb" && (
                <div className="space-y-3">
                  <div className="grid gap-2">
                    <label className="!text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Authentication Method
                    </label>
                    <Select
                      value={mongoAuthMethod}
                      onValueChange={(v) =>
                        setMongoAuthMethod(v as "password" | "atlas")
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="password">
                          User &amp; Password
                        </SelectItem>
                        <SelectItem value="atlas">
                          Atlas Connection String
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {mongoAuthMethod === "atlas" && (
                    <div className="space-y-2">
                      <CollapsibleAlert
                        variant="info"
                        icon={<Info className="h-3.5 w-3.5" />}
                        title="MongoDB Atlas Connection String"
                      >
                        <p className="mb-1">
                          Copy the SRV connection string from MongoDB Atlas:
                        </p>
                        <p className="font-mono text-[10px] bg-muted px-2 py-1 rounded break-all">
                          mongodb+srv://&lt;username&gt;:&lt;password&gt;@cluster0.abc.mongodb.net/dbname
                        </p>
                      </CollapsibleAlert>
                      <div className="grid gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Atlas Connection String{" "}
                          <span className="text-destructive">*</span>
                        </label>
                        <Input
                          value={mongoConnectionString}
                          onChange={(e) =>
                            setMongoConnectionString(e.target.value)
                          }
                          placeholder="mongodb+srv://user:pass@cluster0.abc.mongodb.net/mydb"
                          className="h-9 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {mongoAuthMethod === "password" && (
                    <div className="grid gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Auth Source Database{" "}
                        <span className="text-[10px] text-muted-foreground">
                          (defaults to &apos;admin&apos;)
                        </span>
                      </label>
                      <Input
                        value={mongoAuthSource}
                        onChange={(e) => setMongoAuthSource(e.target.value)}
                        placeholder="admin"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              <Tabs
                value={connectionType}
                onValueChange={(v) =>
                  setConnectionType(
                    v as "direct" | "ssh" | "connectionString"
                  )
                }
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="connectionString" className="!text-xs">
                    String
                  </TabsTrigger>
                  <TabsTrigger
                    value="direct"
                    className="!text-xs"
                    disabled={provider === "neon"}
                    title={
                      provider === "neon"
                        ? "Neon only supports connection strings"
                        : undefined
                    }
                  >
                    Direct
                  </TabsTrigger>
                  <TabsTrigger value="ssh" className="!text-xs">
                    SSH Tunnel
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value="connectionString"
                  className="mt-4 space-y-3"
                >
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <p className="text-xs text-muted-foreground mb-3">
                      {provider === "supabase"
                        ? "Supabase Connection String"
                        : provider === "neon"
                        ? "Neon Connection String"
                        : "PostgreSQL Connection String"}
                    </p>
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <label
                          htmlFor="connectionString"
                          className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                        >
                          Connection String{" "}
                          <span className="text-destructive">*</span>
                        </label>
                        <Input
                          id="connectionString"
                          value={connectionString}
                          onChange={(e) => setConnectionString(e.target.value)}
                          placeholder={
                            provider === "supabase"
                              ? "postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
                              : provider === "neon"
                              ? "postgresql://[user]:[password]@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
                              : "postgres://username:password@host:port/database?sslmode=require"
                          }
                          className="h-9 text-sm font-mono"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {provider === "supabase" ? (
                            <span>
                              Session Pooler (IPv4 friendly):{" "}
                              <span className="font-mono">
                                postgresql://postgres.[ref]:[pw]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
                              </span>
                              <br />
                              Direct:{" "}
                              <span className="font-mono">
                                postgresql://postgres:[pw]@db.[ref].supabase.co:5432/postgres
                              </span>
                            </span>
                          ) : provider === "neon" ? (
                            <span>
                              With pooler:{" "}
                              <span className="font-mono">
                                ...ep-name<strong>-pooler</strong>
                                .region.aws.neon.tech/dbname?sslmode=require
                              </span>
                            </span>
                          ) : (
                            "Example: postgres://user:password@db.example.com:5432/mydb?sslmode=require"
                          )}
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

                  {host && username && database && connectionString && (
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="!text-sm font-medium mb-2">
                        Parsed Connection Details:
                      </p>
                      <div className="grid gap-1 text-xs text-muted-foreground font-mono">
                        <div>
                          <span className="text-foreground">Host:</span> {host}:{port}
                        </div>
                        <div>
                          <span className="text-foreground">Database:</span> {database}
                        </div>
                        <div>
                          <span className="text-foreground">Username:</span> {username}
                        </div>
                        <div>
                          <span className="text-foreground">Password:</span>{" "}
                          {password ? "••••••••" : "Not set"}
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="direct" className="mt-4 space-y-3">
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <p className="text-xs text-muted-foreground mb-3">
                      Server Connection Details
                    </p>
                    <div className="grid gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <label
                            htmlFor="host"
                            className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                          >
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
                          <label
                            htmlFor="port"
                            className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                          >
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
                        <label
                          htmlFor="database"
                          className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                        >
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
                    <p className="text-xs text-muted-foreground mb-3">
                      Authentication
                    </p>
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <label
                          htmlFor="username"
                          className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                        >
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
                        <label
                          htmlFor="password"
                          className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                        >
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

                      {dbType === "clickhouse" && (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            id="clickhouseUseSsl"
                            checked={clickhouseUseSsl}
                            onChange={(e) =>
                              setClickhouseUseSsl(e.target.checked)
                            }
                            className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer"
                          />
                          <label
                            htmlFor="clickhouseUseSsl"
                            className="text-xs font-medium cursor-pointer"
                          >
                            Use HTTPS / SSL (Recommended for ClickHouse Cloud,
                            port 8443)
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="ssh" className="mt-4 space-y-3">
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <p className="text-xs text-muted-foreground mb-3">
                      SSH Tunnel Configuration
                    </p>
                    <div className="grid gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <label
                            htmlFor="sshHost"
                            className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                          >
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
                          <label
                            htmlFor="sshPort"
                            className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                          >
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
                        <label
                          htmlFor="sshUsername"
                          className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                        >
                          SSH Username{" "}
                          <span className="text-destructive">*</span>
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
                        <label
                          htmlFor="sshAuthMethod"
                          className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                        >
                          Authentication Method{" "}
                          <span className="text-destructive">*</span>
                        </label>
                        <Select
                          value={sshAuthMethod}
                          onValueChange={(v) =>
                            setSshAuthMethod(v as SSHAuthMethod)
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="password">Password</SelectItem>
                            <SelectItem value="privateKey">
                              Private Key
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {sshAuthMethod === "password" ? (
                        <div className="grid gap-2">
                          <label
                            htmlFor="sshPassword"
                            className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                          >
                            SSH Password{" "}
                            <span className="text-destructive">*</span>
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
                          <label
                            htmlFor="sshPrivateKeyPath"
                            className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                          >
                            Private Key Path{" "}
                            <span className="text-destructive">*</span>
                          </label>
                          <div className="flex gap-2">
                            <Input
                              id="sshPrivateKeyPath"
                              value={sshPrivateKeyPath}
                              onChange={(e) =>
                                setSshPrivateKeyPath(e.target.value)
                              }
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
                    <p className="text-xs text-muted-foreground mb-3">
                      Database Connection (via SSH Tunnel)
                    </p>
                    <div className="grid gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <label
                            htmlFor="dbHost"
                            className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                          >
                            DB Host <span className="text-destructive">*</span>
                          </label>
                          <Input
                            id="dbHost"
                            value={host}
                            onChange={(e) => setHost(e.target.value)}
                            placeholder="localhost"
                            className="h-9 text-sm"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Usually 'localhost' when using SSH tunnel
                          </p>
                        </div>
                        <div className="grid gap-2">
                          <label
                            htmlFor="dbPort"
                            className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                          >
                            DB Port <span className="text-destructive">*</span>
                          </label>
                          <Input
                            id="dbPort"
                            value={port}
                            onChange={(e) => setPort(e.target.value)}
                            placeholder={
                              dbType === "postgresql" ? "5432" : "3306"
                            }
                            className="h-9 text-sm font-mono"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            {dbType === "postgresql"
                              ? "Usually 5432"
                              : "Usually 3306"}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <label
                          htmlFor="sshDatabase"
                          className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                        >
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
                    <p className="text-xs text-muted-foreground mb-3">
                      Database Authentication
                    </p>
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <label
                          htmlFor="sshDbUsername"
                          className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                        >
                          DB Username{" "}
                          <span className="text-destructive">*</span>
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
                        <label
                          htmlFor="sshDbPassword"
                          className="!text-sm font-medium text-muted-foreground uppercase tracking-wide"
                        >
                          DB Password{" "}
                          <span className="text-destructive">*</span>
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

          {/* Test connection result banner */}
          {testResult && (
            <Alert
              variant={testResult.success ? "default" : "destructive"}
              className="mt-2"
            >
              {testResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {testResult.success ? "Connection Successful" : "Connection Failed"}
              </AlertTitle>
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
        </div>
      </ScrollArea>

      {/* Action footer */}
      <div className="flex items-center justify-between border-t border-border bg-card/60 px-6 py-3 backdrop-blur-sm">
        <div className="text-xs text-muted-foreground">
          {isEditMode ? "Editing existing connection" : "New database connection"}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isConnecting || isTesting}
            className="h-9"
          >
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
          <Button
            onClick={handleConnect}
            disabled={isConnecting || isTesting}
            className="h-9"
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                {isEditMode ? "Saving..." : "Connecting..."}
              </>
            ) : (
              <>
                <Database className="h-3.5 w-3.5 mr-2" />
                {isEditMode ? "Save Changes" : "Connect"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
