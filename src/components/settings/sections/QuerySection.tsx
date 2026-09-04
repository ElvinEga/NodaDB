import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useSettingsStore } from "@/stores/settingsStore";

export function QuerySection() {
  const {
    autoExecuteOnLoad,
    confirmBeforeExecute,
    maxHistorySize,
    setAutoExecuteOnLoad,
    setConfirmBeforeExecute,
    setMaxHistorySize,
  } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight">Query Execution</h3>
        <p className="text-xs text-muted-foreground">
          Configure safety checks, execution triggers, and history retention.
        </p>
      </div>

      <div className="space-y-5 rounded-lg border border-border/60 bg-card/40 p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Auto Execute on Load</Label>
            <p className="text-xs text-muted-foreground">
              Immediately execute queries when loaded from query history
            </p>
          </div>
          <Switch
            checked={autoExecuteOnLoad}
            onCheckedChange={setAutoExecuteOnLoad}
          />
        </div>

        <div className="pt-2 border-t border-border/40 flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Confirm Destructive Queries</Label>
            <p className="text-xs text-muted-foreground">
              Show a confirmation modal before running DROP, TRUNCATE, or bulk DELETE statements
            </p>
          </div>
          <Switch
            checked={confirmBeforeExecute}
            onCheckedChange={setConfirmBeforeExecute}
          />
        </div>

        <div className="pt-2 border-t border-border/40 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Max History Size</Label>
            <span className="text-xs font-mono text-muted-foreground">{maxHistorySize} queries</span>
          </div>
          <Slider
            value={[maxHistorySize]}
            onValueChange={([v]) => setMaxHistorySize(v)}
            min={10}
            max={200}
            step={10}
            className="w-full"
          />
          <p className="text-[11px] text-muted-foreground">
            Maximum number of queries to retain in the local history log
          </p>
        </div>
      </div>
    </div>
  );
}
