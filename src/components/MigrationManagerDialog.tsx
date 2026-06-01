import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileCode2, Play, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppliedMigration, ConnectionConfig, MigrationRecord, MigrationStatus } from "@/types";
import { useMigrationStore } from "@/stores/migrationStore";
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
import { Badge } from "@/components/ui/badge";

interface MigrationManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionConfig;
}

const editorClassName = "min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function slugifyMigrationName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "migration";
}

function createMigrationTimestamp(value: number) {
  return new Date(value)
    .toISOString()
    .split("-").join("")
    .split(":").join("")
    .split("T").join("")
    .split("Z").join("")
    .split(".").join("")
    .slice(0, 14);
}

function hashMigration(record: Pick<MigrationRecord, "name" | "upSql" | "downSql">) {
  const input = `${record.name}\n${record.upSql}\n${record.downSql}`;
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

export function MigrationManagerDialog({ open, onOpenChange, connection }: MigrationManagerDialogProps) {
  const migrations = useMigrationStore((state) => state.getMigrationsForConnection(connection.id));
  const saveMigration = useMigrationStore((state) => state.saveMigration);
  const removeMigration = useMigrationStore((state) => state.removeMigration);

  const [appliedMigrations, setAppliedMigrations] = useState<AppliedMigration[]>([]);
  const [selectedMigrationId, setSelectedMigrationId] = useState<string | null>(null);
  const [migrationName, setMigrationName] = useState("");
  const [upSql, setUpSql] = useState("");
  const [downSql, setDownSql] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const statusList = useMemo<MigrationStatus[]>(() => {
    const appliedById = new Map(appliedMigrations.map((migration) => [migration.id, migration]));
    const latestAppliedId = appliedMigrations[appliedMigrations.length - 1]?.id ?? null;
    return migrations.map((migration) => {
      const applied = appliedById.get(migration.id);
      return {
        migration,
        appliedAt: applied?.applied_at ?? null,
        isApplied: Boolean(applied),
        isLatestApplied: applied?.id === latestAppliedId,
      };
    });
  }, [appliedMigrations, migrations]);

  const selectedStatus = statusList.find((item) => item.migration.id === selectedMigrationId) ?? null;

  const loadAppliedMigrations = async () => {
    setIsSyncing(true);
    try {
      const result = await invoke<AppliedMigration[]>("list_applied_migrations", {
        connectionId: connection.id,
        dbType: connection.db_type,
      });
      setAppliedMigrations(result);
    } catch (error) {
      console.error("Failed to load applied migrations:", error);
      toast.error(`Failed to load migration status: ${error}`);
      setAppliedMigrations([]);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadAppliedMigrations();
  }, [open, connection.id]);

  useEffect(() => {
    if (!open) return;
    if (selectedMigrationId) {
      const selected = migrations.find((migration) => migration.id === selectedMigrationId);
      if (selected) {
        setMigrationName(selected.name);
        setUpSql(selected.upSql);
        setDownSql(selected.downSql);
        return;
      }
    }

    setMigrationName("");
    setUpSql("");
    setDownSql("");
  }, [selectedMigrationId, migrations, open]);

  const handleSave = () => {
    if (!migrationName.trim() || !upSql.trim() || !downSql.trim()) {
      toast.error("Migration name, up SQL, and down SQL are required");
      return;
    }

    const current = migrations.find((migration) => migration.id === selectedMigrationId);
    const createdAt = current?.createdAt ?? Date.now();
    const migrationId =
      current?.id ??
      `${createMigrationTimestamp(createdAt)}_${slugifyMigrationName(migrationName)}`;

    const record: MigrationRecord = {
      id: migrationId,
      connectionId: connection.id,
      name: migrationName.trim(),
      upSql: upSql.trim(),
      downSql: downSql.trim(),
      createdAt,
    };

    saveMigration(record);
    setSelectedMigrationId(record.id);
    toast.success(`Saved migration ${record.id}`);
  };

  const handleNew = () => {
    setSelectedMigrationId(null);
    setMigrationName("");
    setUpSql("");
    setDownSql("");
  };

  const handleDelete = () => {
    if (!selectedStatus) {
      return;
    }
    if (selectedStatus.isApplied) {
      toast.error("Applied migrations cannot be deleted from the local catalog");
      return;
    }
    removeMigration(selectedStatus.migration.id);
    setSelectedMigrationId(null);
    toast.success(`Removed migration ${selectedStatus.migration.id}`);
  };

  const handleApply = async (status: MigrationStatus) => {
    setIsApplying(true);
    try {
      const checksum = hashMigration(status.migration);
      const result = await invoke<string>("apply_migration", {
        connectionId: connection.id,
        migrationId: status.migration.id,
        migrationName: status.migration.name,
        upSql: status.migration.upSql,
        checksum,
        dbType: connection.db_type,
      });
      toast.success(result);
      await loadAppliedMigrations();
    } catch (error) {
      console.error("Apply migration error:", error);
      toast.error(`Failed to apply migration: ${error}`);
    } finally {
      setIsApplying(false);
    }
  };

  const handleRollback = async (status: MigrationStatus) => {
    if (!status.isLatestApplied) {
      toast.error("Only the latest applied migration can be rolled back");
      return;
    }

    if (!confirm(`Rollback migration ${status.migration.id}?`)) {
      return;
    }

    setIsApplying(true);
    try {
      const result = await invoke<string>("rollback_migration", {
        connectionId: connection.id,
        migrationId: status.migration.id,
        downSql: status.migration.downSql,
        dbType: connection.db_type,
      });
      toast.success(result);
      await loadAppliedMigrations();
    } catch (error) {
      console.error("Rollback migration error:", error);
      toast.error(`Failed to rollback migration: ${error}`);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Database Migrations</DialogTitle>
          <DialogDescription>
            Author manual up/down SQL migrations for {connection.name}, then apply or rollback them against the connected database.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[0.9fr,1.1fr] flex-1 overflow-hidden">
          <div className="rounded-lg border overflow-hidden flex flex-col min-h-0">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/30">
              <div>
                <h3 className="text-sm font-semibold">Migration catalog</h3>
                <p className="text-xs text-muted-foreground">Local definitions for this connection</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleNew}>New</Button>
                <Button variant="outline" size="sm" onClick={() => void loadAppliedMigrations()} disabled={isSyncing}>
                  {isSyncing ? "Syncing..." : "Sync status"}
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {statusList.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2">No migrations saved for this connection yet.</p>
                ) : (
                  statusList.map((status) => (
                    <button
                      key={status.migration.id}
                      type="button"
                      onClick={() => setSelectedMigrationId(status.migration.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedMigrationId === status.migration.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{status.migration.name}</div>
                          <div className="text-xs text-muted-foreground font-mono break-all">{status.migration.id}</div>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          {status.isApplied ? <Badge>Applied</Badge> : <Badge variant="secondary">Pending</Badge>}
                          {status.isLatestApplied ? <Badge variant="outline">Latest</Badge> : null}
                        </div>
                      </div>
                      {status.appliedAt ? (
                        <div className="mt-2 text-xs text-muted-foreground">Applied at {status.appliedAt}</div>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="rounded-lg border overflow-hidden flex flex-col min-h-0">
            <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Migration editor</h3>
                <p className="text-xs text-muted-foreground">Write explicit up/down SQL and keep rollback safe.</p>
              </div>
              {selectedStatus ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDelete} disabled={selectedStatus.isApplied}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                  {selectedStatus.isApplied ? (
                    <Button variant="outline" size="sm" onClick={() => void handleRollback(selectedStatus)} disabled={isApplying || !selectedStatus.isLatestApplied}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Rollback
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => void handleApply(selectedStatus)} disabled={isApplying}>
                      <Play className="h-4 w-4 mr-2" />
                      Apply
                    </Button>
                  )}
                </div>
              ) : null}
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Migration name</label>
                  <Input value={migrationName} onChange={(event) => setMigrationName(event.target.value)} placeholder="Create orders foreign key" />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">Up SQL</label>
                  <textarea value={upSql} onChange={(event) => setUpSql(event.target.value)} placeholder="ALTER TABLE ..." className={editorClassName} />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">Down SQL</label>
                  <textarea value={downSql} onChange={(event) => setDownSql(event.target.value)} placeholder="ALTER TABLE ..." className={editorClassName} />
                </div>

                <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 font-medium text-foreground mb-1">
                    <FileCode2 className="h-4 w-4" />
                    Rules for v1 migrations
                  </div>
                  <ul className="space-y-1 list-disc pl-4">
                    <li>Write explicit SQL for both apply and rollback.</li>
                    <li>Only the latest applied migration can be rolled back.</li>
                    <li>Migration execution history is stored in the target database table <code>schema_migrations</code>.</li>
                  </ul>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Migration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
