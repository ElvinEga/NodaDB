import { AppUpdatePanel } from "@/components/AppUpdatePanel";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { useSettingsStore } from "@/stores/settingsStore";

export function UpdatesSection() {
  const appUpdate = useAppUpdate();
  const { autoCheckForUpdates, setAutoCheckForUpdates } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight">Software Updates</h3>
        <p className="text-xs text-muted-foreground">
          Keep NodaDB up to date with the latest features, database drivers, and bug fixes.
        </p>
      </div>

      <div className="rounded-lg border border-border/60 bg-card/40 p-4">
        <AppUpdatePanel
          appUpdate={appUpdate}
          autoCheckForUpdates={autoCheckForUpdates}
          onAutoCheckChange={setAutoCheckForUpdates}
        />
      </div>
    </div>
  );
}
