import { Settings, Palette, Code, Database, FileText } from "lucide-react";
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
import {
  useSettingsStore,
  Theme,
  FontSize,
  FontFamily,
} from "@/stores/settingsStore";
import { useEffect } from "react";
import { toast } from "sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const {
    theme,
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
    setTheme,
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
    resetToDefaults,
  } = useSettingsStore();

  // Apply theme to document
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

  // Apply font size
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("font-small", "font-medium", "font-large");
    root.classList.add(`font-${fontSize}`);
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="appearance">
              <Palette className="h-4 w-4 mr-2" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="editor">
              <Code className="h-4 w-4 mr-2" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="query">
              <FileText className="h-4 w-4 mr-2" />
              Query
            </TabsTrigger>
            <TabsTrigger value="table">
              <Database className="h-4 w-4 mr-2" />
              Table
            </TabsTrigger>
          </TabsList>

          {/* Appearance Tab */}
          <TabsContent
            value="appearance"
            className="flex-1 overflow-y-auto space-y-6 pt-4"
          >
            <div className="space-y-4 mx-2">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
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
                  Choose your color theme preference
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
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                    <SelectItem value="1000">1000</SelectItem>
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
