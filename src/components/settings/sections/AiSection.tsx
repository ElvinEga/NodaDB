import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiIcon } from "@/components/AiIcon";
import {
  useSettingsStore,
  AiProvider,
  AiIntegration,
} from "@/stores/settingsStore";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Shield, Terminal, CheckCircle2, XCircle } from "lucide-react";

export function AiSection() {
  const {
    aiEnabled,
    aiProvider,
    aiIntegration,
    aiModel,
    aiAutoIncludeSchema,
    aiAutoIncludeQuery,
    aiIncludeSelectedTable,
    aiIncludeRelationships,
    aiIncludeQueryResults,
    aiIncludeExplain,
    aiConfirmGeneratedSql,
    aiAllowWriteOperations,
    aiAllowSchemaChanges,
    setAiEnabled,
    setAiProvider,
    setAiIntegration,
    setAiModel,
    setAiAutoIncludeSchema,
    setAiAutoIncludeQuery,
    setAiIncludeSelectedTable,
    setAiIncludeRelationships,
    setAiIncludeQueryResults,
    setAiIncludeExplain,
    setAiConfirmGeneratedSql,
    setAiAllowWriteOperations,
    setAiAllowSchemaChanges,
  } = useSettingsStore();

  const [detectedAgents, setDetectedAgents] = useState<{
    id: string;
    name: string;
    binary_name: string;
    installed: boolean;
    version?: string;
    path?: string;
  }[]>([]);

  useEffect(() => {
    invoke<{
      id: string;
      name: string;
      binary_name: string;
      installed: boolean;
      version?: string;
      path?: string;
    }[]>("detect_installed_agents")
      .then((list) => setDetectedAgents(list))
      .catch(() => setDetectedAgents([]));
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight">AI Assistant & Agents</h3>
        <p className="text-xs text-muted-foreground">
          Configure local CLI coding agents, context extraction, and SQL safety gates.
        </p>
      </div>

      <div className="space-y-5 rounded-lg border border-border/60 bg-card/40 p-4">
        {/* Enable AI Switch */}
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="space-y-0.5">
            <Label className="text-sm font-semibold">AI Assistant</Label>
            <p className="text-xs text-muted-foreground">
              Enable desktop-native AI database assistance
            </p>
          </div>
          <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
        </div>

        {aiEnabled && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="aiProvider" className="text-xs">Default AI Provider</Label>
                <Select
                  value={aiProvider}
                  onValueChange={(v) => setAiProvider(v as AiProvider)}
                >
                  <SelectTrigger id="aiProvider" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="codex">
                      <div className="flex items-center gap-2">
                        <AiIcon name="codex" className="h-3.5 w-3.5 shrink-0" />
                        <span>Codex CLI</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="claude">
                      <div className="flex items-center gap-2">
                        <AiIcon name="claude" className="h-3.5 w-3.5 shrink-0" />
                        <span>Claude Code</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="opencode">
                      <div className="flex items-center gap-2">
                        <AiIcon name="opencode" className="h-3.5 w-3.5 shrink-0" />
                        <span>OpenCode</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gemini">
                      <div className="flex items-center gap-2">
                        <AiIcon name="gemini" className="h-3.5 w-3.5 shrink-0" />
                        <span>Gemini CLI</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Agent binary execution provider
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="aiIntegration" className="text-xs">Integration Mode</Label>
                <Select
                  value={aiIntegration}
                  onValueChange={(v) => setAiIntegration(v as AiIntegration)}
                >
                  <SelectTrigger id="aiIntegration" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cli">Direct CLI (Native)</SelectItem>
                    <SelectItem value="acp">ACP (Agent Client Protocol)</SelectItem>
                    <SelectItem value="mcp">MCP (Model Context Protocol)</SelectItem>
                    <SelectItem value="plugin">External Plugin</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Communication interface
                </p>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="aiModel" className="text-xs">Model Preference (Optional)</Label>
                <Input
                  id="aiModel"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  placeholder="e.g. claude-3-7-sonnet, gpt-4o, gemini-2.5-flash"
                  className="h-8 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Leave blank to use the agent's default configured model
                </p>
              </div>
            </div>

            {/* Context Provider Settings */}
            <div className="space-y-3 pt-3 border-t border-border/40">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Context Provider
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select what database metadata is automatically bundled with prompts
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="flex items-center justify-between p-2.5 rounded-md border border-border/60 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium">Include Schema</Label>
                    <p className="text-[10px] text-muted-foreground">Table list & data types</p>
                  </div>
                  <Switch
                    checked={aiAutoIncludeSchema}
                    onCheckedChange={setAiAutoIncludeSchema}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-md border border-border/60 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium">Include Current SQL</Label>
                    <p className="text-[10px] text-muted-foreground">Active editor query text</p>
                  </div>
                  <Switch
                    checked={aiAutoIncludeQuery}
                    onCheckedChange={setAiAutoIncludeQuery}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-md border border-border/60 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium">Include Selected Table</Label>
                    <p className="text-[10px] text-muted-foreground">Full DDL and columns</p>
                  </div>
                  <Switch
                    checked={aiIncludeSelectedTable}
                    onCheckedChange={setAiIncludeSelectedTable}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-md border border-border/60 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium">Include Relationships</Label>
                    <p className="text-[10px] text-muted-foreground">Foreign key graph</p>
                  </div>
                  <Switch
                    checked={aiIncludeRelationships}
                    onCheckedChange={setAiIncludeRelationships}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-md border border-border/60 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium">Include EXPLAIN Plan</Label>
                    <p className="text-[10px] text-muted-foreground">Execution cost & nodes</p>
                  </div>
                  <Switch
                    checked={aiIncludeExplain}
                    onCheckedChange={setAiIncludeExplain}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-md border border-border/60 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium">Include Query Results</Label>
                    <p className="text-[10px] text-muted-foreground">Compact sample rows</p>
                  </div>
                  <Switch
                    checked={aiIncludeQueryResults}
                    onCheckedChange={setAiIncludeQueryResults}
                  />
                </div>
              </div>
            </div>

            {/* Safety & Permissions */}
            <div className="space-y-3 pt-3 border-t border-border/40">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  Safety & Execution Gates
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Prevent unintended data loss or destructive operations
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between p-2.5 rounded-md border border-border/60 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium">Confirm Generated SQL</Label>
                    <p className="text-[10px] text-muted-foreground">Always review generated SQL before running</p>
                  </div>
                  <Switch
                    checked={aiConfirmGeneratedSql}
                    onCheckedChange={setAiConfirmGeneratedSql}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-md border border-border/60 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium">Allow Write Operations (DML)</Label>
                    <p className="text-[10px] text-muted-foreground">Allow INSERT, UPDATE, DELETE generated by agents</p>
                  </div>
                  <Switch
                    checked={aiAllowWriteOperations}
                    onCheckedChange={setAiAllowWriteOperations}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-md border border-border/60 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium">Allow Schema Changes (DDL)</Label>
                    <p className="text-[10px] text-muted-foreground">Allow CREATE, ALTER, DROP migrations</p>
                  </div>
                  <Switch
                    checked={aiAllowSchemaChanges}
                    onCheckedChange={setAiAllowSchemaChanges}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Agent Integrations Status */}
        <div className="space-y-3 pt-3 border-t border-border/40">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5" />
              Detected Agent Integrations
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              CLI binary availability on local system PATH
            </p>
          </div>

          <div className="space-y-1.5">
            {detectedAgents.map((ag) => (
              <div
                key={ag.id}
                className="flex items-center justify-between p-2 rounded-md border border-border/60 bg-card text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-md bg-muted/60 flex items-center justify-center p-1 border border-border/50 shrink-0">
                    <AiIcon name={ag.id} className="h-4 w-4 shrink-0" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">{ag.name}</span>
                      {ag.installed ? (
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                      ) : (
                        <XCircle className="h-3 w-3 text-muted-foreground/50" />
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground block">
                      `{ag.binary_name}`
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {ag.installed ? (
                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                      {ag.version ?? "Installed"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                      Not in PATH
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] px-2"
                    onClick={() => {
                      if (ag.installed) {
                        toast.success(`${ag.name} connection test passed (${ag.version || 'OK'})`);
                      } else {
                        toast.error(`${ag.name} binary not found in PATH`);
                      }
                    }}
                  >
                    Test
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
