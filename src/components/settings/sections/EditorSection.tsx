import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useSettingsStore } from "@/stores/settingsStore";

export function EditorSection() {
  const {
    autoSave,
    autoSaveDelay,
    editorTabSize,
    editorWordWrap,
    setAutoSave,
    setAutoSaveDelay,
    setEditorTabSize,
    setEditorWordWrap,
  } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight">SQL Editor</h3>
        <p className="text-xs text-muted-foreground">
          Configure editor behavior, automatic saving, and code formatting.
        </p>
      </div>

      <div className="space-y-5 rounded-lg border border-border/60 bg-card/40 p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Auto Save</Label>
            <p className="text-xs text-muted-foreground">
              Automatically save query changes in open tabs
            </p>
          </div>
          <Switch checked={autoSave} onCheckedChange={setAutoSave} />
        </div>

        {autoSave && (
          <div className="space-y-2 pl-4 border-l-2 border-primary/40">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Auto Save Delay</Label>
              <span className="text-xs font-mono text-muted-foreground">{autoSaveDelay}s</span>
            </div>
            <Slider
              value={[autoSaveDelay]}
              onValueChange={([v]) => setAutoSaveDelay(v)}
              min={1}
              max={30}
              step={1}
              className="w-full"
            />
            <p className="text-[11px] text-muted-foreground">
              Delay before automatically persisting unsaved query text
            </p>
          </div>
        )}

        <div className="pt-2 border-t border-border/40 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Tab Size</Label>
            <span className="text-xs font-mono text-muted-foreground">{editorTabSize} spaces</span>
          </div>
          <Slider
            value={[editorTabSize]}
            onValueChange={([v]) => setEditorTabSize(v)}
            min={2}
            max={8}
            step={2}
            className="w-full"
          />
          <p className="text-[11px] text-muted-foreground">
            Number of spaces used for indentation in the editor
          </p>
        </div>

        <div className="pt-2 border-t border-border/40 flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Word Wrap</Label>
            <p className="text-xs text-muted-foreground">
              Wrap long query lines instead of horizontal scrolling
            </p>
          </div>
          <Switch
            checked={editorWordWrap}
            onCheckedChange={setEditorWordWrap}
          />
        </div>
      </div>
    </div>
  );
}
