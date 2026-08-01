import {
  Settings,
  Palette,
  Code,
  Database,
  FileText,
  Download,
  Sparkles,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
import {
  useSettingsStore,
  Theme,
  FontSize,
  FontFamily,
} from "@/stores/settingsStore";
import { THEMES, ThemeDefinition } from "@/lib/themes";
import { useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appUpdate: ReturnType<typeof useAppUpdate>;
}

interface ThemeCardProps {
  theme: ThemeDefinition;
  selected: boolean;
  onSelect: (id: string) => void;
}

function ThemeCard({ theme, selected, onSelect }: ThemeCardProps) {
  return (
    <button
      onClick={() => onSelect(theme.id)}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 text-left w-full transition-all duration-150",
        selected
          ? "border-primary ring-2 ring-primary/25 bg-accent/60"
          : "border-border hover:border-primary/40 hover:bg-accent/30"
      )}
    >
      {/* Color swatch preview */}
      <div
        className="flex gap-[3px] rounded-md p-1.5 shrink-0 border border-white/10"
        style={{ background: theme.previewColors[0] }}
      >
        {theme.previewColors.map((c, i) => (
          <div
            key={i}
            className="h-5 w-[7px] rounded-full"
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate leading-tight">
          {theme.name}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5 leading-tight">
          {theme.description}
        </p>
      </div>
      {selected && (
        <Check className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />
      )}
    </button>
  );
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
    resetToDefaults,
  } = useSettingsStore();

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
    root.classList.remove("font-outfit", "font-jetbrains");
    root.classList.add(`font-${fontFamily.toLowerCase().replace(" ", "-")}`);
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="appearance" className="!text-sm">
              <Palette className="h-4 w-4 mr-2" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="themes" className="!text-sm">
              <Sparkles className="h-4 w-4 mr-2" />
              Themes
            </TabsTrigger>
            <TabsTrigger value="editor" className="!text-sm">
              <Code className="h-4 w-4 mr-2" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="query" className="!text-sm">
              <FileText className="h-4 w-4 mr-2" />
              Query
            </TabsTrigger>
            <TabsTrigger value="table" className="!text-sm">
              <Database className="h-4 w-4 mr-2" />
              Table
            </TabsTrigger>
            <TabsTrigger value="updates" className="!text-sm">
              <Download className="h-4 w-4 mr-2" />
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
