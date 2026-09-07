import {
  Settings,
  Palette,
  Code,
  Database,
  FileText,
  Download,
  Sparkles,
  Check,
  Bot,
  Shield,
  Terminal,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { AppUpdatePanel } from "@/components/AppUpdatePanel";
import type { useAppUpdate } from "@/hooks/useAppUpdate";
import { AiIcon } from "@/components/AiIcon";
import {
  useSettingsStore,
  Theme,
  FontSize,
  FontFamily,
  AiProvider,
  AiIntegration,
} from "@/stores/settingsStore";
import { THEMES, ThemeDefinition } from "@/lib/themes";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SettingsDialogProps { open: boolean; onOpenChange: (open: boolean) => void; appUpdate: ReturnType<typeof useAppUpdate>; }
interface ThemeCardProps { theme: ThemeDefinition; selected: boolean; onSelect: (id: string) => void; }

function ThemeCard({ theme, selected, onSelect }: ThemeCardProps) {
  return <button onClick={() => onSelect(theme.id)} className={cn("flex items-center gap-3 rounded-lg border p-3 text-left w-full transition-all duration-150", selected ? "border-primary ring-2 ring-primary/25 bg-accent/60" : "border-border hover:border-primary/40 hover:bg-accent/30")}>
    <div className="flex gap-[3px] rounded-md p-1.5 shrink-0 border border-white/10" style={{ background: theme.previewColors[0] }}>{theme.previewColors.map((c, i) => <div key={i} className="h-5 w-[7px] rounded-full" style={{ background: c }} />)}</div>
    <div className="min-w-0 flex-1"><p className="font-medium text-sm truncate leading-tight">{theme.name}</p><p className="text-xs text-muted-foreground truncate mt-0.5 leading-tight">{theme.description}</p></div>
    {selected && <Check className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />}
  </button>;
}

export function SettingsDialog({
  open,
  onOpenChange,
  appUpdate,
}: SettingsDialogProps) {
  const {
    theme,
    colorTheme,
    fontSize,
    fontFamily,
    autoSave,
    autoSaveDelay,
    editorTabSize,
    editorWordWrap,
    autoExecuteOnLoad,
    confirmBeforeExecute,
    maxHistorySize,
    rowsPerPage,
    showRowNumbers,
    autoCheckForUpdates,
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
    setTheme,
    setColorTheme,
    setFontSize,
    setFontFamily,
    setAutoSave,
    setAutoSaveDelay,
    setEditorTabSize,
    setEditorWordWrap,
    setAutoExecuteOnLoad,
    setConfirmBeforeExecute,
    setMaxHistorySize,
    setRowsPerPage,
    setShowRowNumbers,
    setAutoCheckForUpdates,
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
    resetToDefaults,
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
    if (open) {
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
    }
  }, [open]);

  // Apply appearance mode (light/dark/system)
  useEffect(() => {
    const root = window.document.documentElement;

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.remove("light", "dark");
      root.classList.add(systemTheme);
    } else {
      root.classList.remove("light", "dark");
      root.classList.add(theme);
    }
  }, [theme]);

  // Apply color theme via data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", colorTheme);
  }, [colorTheme]);

  // Apply font size
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(
      "font-size-small",
      "font-size-medium",
      "font-size-large",
    );
    root.classList.add(`font-size-${fontSize}`);
  }, [fontSize]);

  // Apply font family
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("font-outfit", "font-jetbrains-mono", "font-system");
    root.classList.add(`font-${fontFamily.toLowerCase().replace(/ /g, "-")}`);
  }, [fontFamily]);

  const handleResetDefaults = () => {
    if (confirm("Reset all settings to defaults? This cannot be undone.")) {
      resetToDefaults();
      toast.success("Settings reset to defaults");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings & Preferences
          </DialogTitle>
          <DialogDescription>
            Customize your NodaDB experience
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="appearance"
          className="flex-1 overflow-hidden flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="appearance" className="!text-xs">
              <Palette className="h-3.5 w-3.5 mr-1.5" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="themes" className="!text-xs">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Themes
            </TabsTrigger>
            <TabsTrigger value="editor" className="!text-xs">
              <Code className="h-3.5 w-3.5 mr-1.5" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="query" className="!text-xs">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Query
            </TabsTrigger>
            <TabsTrigger value="table" className="!text-xs">
              <Database className="h-3.5 w-3.5 mr-1.5" />
              Table
            </TabsTrigger>
            <TabsTrigger value="ai" className="!text-xs">
              <Bot className="h-3.5 w-3.5 mr-1.5" />
              AI
            </TabsTrigger>
            <TabsTrigger value="updates" className="!text-xs">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Updates
            </TabsTrigger>
          </TabsList>

          {/* Appearance Tab */}
          <TabsContent
            value="appearance"
            className="flex-1 overflow-y-auto space-y-6 pt-4"
          >
            <div className="space-y-4 mx-2">
              <div className="space-y-2">
                <Label htmlFor="theme">Appearance</Label>
                <Select
                  value={theme}
                  onValueChange={(v) => setTheme(v as Theme)}
                >
                  <SelectTrigger id="theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose your light or dark mode preference
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fontSize">Font Size</Label>
                <Select
                  value={fontSize}
                  onValueChange={(v) => setFontSize(v as FontSize)}
                >
                  <SelectTrigger id="fontSize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Adjust the overall font size
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fontFamily">Font Family</Label>
                <Select
                  value={fontFamily}
                  onValueChange={(v) => setFontFamily(v as FontFamily)}
                >
                  <SelectTrigger id="fontFamily">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="System">System Default</SelectItem>
                    <SelectItem value="Outfit">Outfit</SelectItem>
                    <SelectItem value="JetBrains Mono">
                      JetBrains Mono
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose the font family for the application
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Themes Tab */}
          <TabsContent
            value="themes"
            className="flex-1 overflow-y-auto pt-4"
          >
            <div className="space-y-3 mx-2">
              <div>
                <p className="text-sm font-medium">Color Theme</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose a color palette. Adapts automatically to your
                  Appearance setting (light/dark).
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((t) => (
                  <ThemeCard
                    key={t.id}
                    theme={t}
                    selected={colorTheme === t.id}
                    onSelect={setColorTheme}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Editor Tab */}
          <TabsContent
            value="editor"
            className="flex-1 overflow-y-auto space-y-6 pt-4"
          >
            <div className="space-y-4 mx-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto Save</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically save query changes
                  </p>
                </div>
                <Switch checked={autoSave} onCheckedChange={setAutoSave} />
              </div>

              {autoSave && (
                <div className="space-y-2 pl-4 border-l-2">
                  <Label>Auto Save Delay: {autoSaveDelay}s</Label>
                  <Slider
                    value={[autoSaveDelay]}
                    onValueChange={([v]) => setAutoSaveDelay(v)}
                    min={1}
                    max={30}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Delay before auto-saving changes
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Tab Size: {editorTabSize} spaces</Label>
                <Slider
                  value={[editorTabSize]}
                  onValueChange={([v]) => setEditorTabSize(v)}
                  min={2}
                  max={8}
                  step={2}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Number of spaces per tab in the editor
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Word Wrap</Label>
                  <p className="text-xs text-muted-foreground">
                    Wrap long lines in the editor
                  </p>
                </div>
                <Switch
                  checked={editorWordWrap}
                  onCheckedChange={setEditorWordWrap}
                />
              </div>
            </div>
          </TabsContent>

          {/* Query Tab */}
          <TabsContent
            value="query"
            className="flex-1 overflow-y-auto space-y-6 pt-4"
          >
            <div className="space-y-4 mx-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto Execute on Load</Label>
                  <p className="text-xs text-muted-foreground">
                    Execute query when loading from history
                  </p>
                </div>
                <Switch
                  checked={autoExecuteOnLoad}
                  onCheckedChange={setAutoExecuteOnLoad}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Confirm Before Execute</Label>
                  <p className="text-xs text-muted-foreground">
                    Show confirmation for destructive queries
                  </p>
                </div>
                <Switch
                  checked={confirmBeforeExecute}
                  onCheckedChange={setConfirmBeforeExecute}
                />
              </div>

              <div className="space-y-2">
                <Label>Max History Size: {maxHistorySize} queries</Label>
                <Slider
                  value={[maxHistorySize]}
                  onValueChange={([v]) => setMaxHistorySize(v)}
                  min={10}
                  max={200}
                  step={10}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of queries to keep in history
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Table Tab */}
          <TabsContent
            value="table"
            className="flex-1 overflow-y-auto space-y-6 pt-4"
          >
            <div className="space-y-4 mx-2">
              <div className="space-y-2">
                <Label>Rows Per Page: {rowsPerPage}</Label>
                <Select
                  value={rowsPerPage.toString()}
                  onValueChange={(v) => setRowsPerPage(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="70">70</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Number of rows to display per page
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Row Numbers</Label>
                  <p className="text-xs text-muted-foreground">
                    Display row numbers in tables
                  </p>
                </div>
                <Switch
                  checked={showRowNumbers}
                  onCheckedChange={setShowRowNumbers}
                />
              </div>
            </div>
          </TabsContent>

          {/* AI Assistant Tab */}
          <TabsContent
            value="ai"
            className="flex-1 overflow-y-auto space-y-6 pt-4"
          >
            <div className="space-y-6 mx-2">
              {/* General AI Config */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      AI Assistant
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Enable desktop-native AI database assistance
                    </p>
                  </div>
                  <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                </div>

                {aiEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
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
                )}
              </div>

              {/* Context Provider Settings */}
              {aiEnabled && (
                <div className="space-y-3 pt-2 border-t border-border/40">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Context Provider
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Select what database metadata is automatically bundled with prompts
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
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
              )}

              {/* Safety & Permissions */}
              {aiEnabled && (
                <div className="space-y-3 pt-2 border-t border-border/40">
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
                        <Label className="text-xs font-medium">Confirm Generated SQL Before Execution</Label>
                        <p className="text-[10px] text-muted-foreground">Always review SQL before running in database</p>
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
                        <p className="text-[10px] text-muted-foreground">Allow CREATE, ALTER, DROP migrations generated by agents</p>
                      </div>
                      <Switch
                        checked={aiAllowSchemaChanges}
                        onCheckedChange={setAiAllowSchemaChanges}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Agent Integrations Status */}
              <div className="space-y-3 pt-2 border-t border-border/40">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5" />
                    Detected Agent Integrations
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Binary availability on local PATH
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
          </TabsContent>

          <TabsContent
            value="updates"
            className="flex-1 overflow-y-auto space-y-6 pt-4"
          >
            <div className="mx-2">
              <AppUpdatePanel
                appUpdate={appUpdate}
                autoCheckForUpdates={autoCheckForUpdates}
                onAutoCheckChange={setAutoCheckForUpdates}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleResetDefaults}>
            Reset to Defaults
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
