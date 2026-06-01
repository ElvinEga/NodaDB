import { RefreshCw, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { useAppUpdate } from "@/hooks/useAppUpdate";

type AppUpdateModel = ReturnType<typeof useAppUpdate>;

interface AppUpdatePanelProps {
  appUpdate: AppUpdateModel;
  autoCheckForUpdates: boolean;
  onAutoCheckChange: (enabled: boolean) => void;
  title?: string;
  description?: string;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function getStatusCopy(appUpdate: AppUpdateModel) {
  const { status, availableUpdate, appName } = appUpdate;

  switch (status) {
    case "checking":
      return "Checking for updates...";
    case "available":
      return `${appName} ${availableUpdate?.version ?? ""} is ready to install.`.trim();
    case "up-to-date":
      return `${appName} is already up to date.`;
    case "downloading":
      return "Downloading the update package...";
    case "installing":
      return "Installing the update...";
    case "installed":
      return "Update installed. Restarting...";
    case "error":
      return "The last update attempt failed.";
    case "unsupported":
      return "Updates are available only in the desktop app.";
    default:
      return "Check for new releases and install them without leaving the app.";
  }
}

export function AppUpdatePanel({
  appUpdate,
  autoCheckForUpdates,
  onAutoCheckChange,
  title = "Software Update",
  description = "Download new releases and review the latest changelog.",
}: AppUpdatePanelProps) {
  const isBusy =
    appUpdate.status === "checking" ||
    appUpdate.status === "downloading" ||
    appUpdate.status === "installing";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">{title}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
            <p className="text-sm text-muted-foreground">
              Current version:{" "}
              <span className="font-medium text-foreground">
                {appUpdate.currentVersion}
              </span>
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void appUpdate.checkForUpdates()}
              disabled={isBusy}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Check for Updates
            </Button>
            <Button
              onClick={() => void appUpdate.downloadAndInstallUpdate()}
              disabled={!appUpdate.availableUpdate || isBusy}
            >
              <Download className="mr-2 h-4 w-4" />
              {appUpdate.status === "downloading"
                ? "Downloading..."
                : appUpdate.status === "installing"
                  ? "Installing..."
                  : "Download & Install"}
            </Button>
          </div>
        </div>

        <div className="mt-4 rounded-lg border bg-background/60 p-3">
          <p className="text-sm font-medium">Status</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {getStatusCopy(appUpdate)}
          </p>

          {appUpdate.availableUpdate ? (
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Available version:</span>{" "}
                <span className="font-medium text-foreground">
                  {appUpdate.availableUpdate.version}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Release date:</span>{" "}
                <span className="font-medium text-foreground">
                  {appUpdate.availableUpdate.date
                    ? new Date(appUpdate.availableUpdate.date).toLocaleDateString()
                    : "Unknown"}
                </span>
              </div>
            </div>
          ) : null}

          {appUpdate.status === "downloading" || appUpdate.status === "installing" ? (
            <div className="mt-4 space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${appUpdate.progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {appUpdate.status === "installing"
                    ? "Installing update..."
                    : `Downloading ${appUpdate.progressPercent}%`}
                </span>
                <span>
                  {formatBytes(appUpdate.downloadedBytes)}
                  {appUpdate.totalBytes
                    ? ` / ${formatBytes(appUpdate.totalBytes)}`
                    : ""}
                </span>
              </div>
            </div>
          ) : null}

          {appUpdate.errorMessage ? (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {appUpdate.errorMessage}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label>Check for updates on startup</Label>
            <p className="text-xs text-muted-foreground">
              When a release is found, NodaDB will show a toast so you can open the changelog manually.
            </p>
          </div>
          <Switch
            checked={autoCheckForUpdates}
            onCheckedChange={onAutoCheckChange}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h4 className="font-semibold">Changelog</h4>
        <div className="mt-3 max-h-56 overflow-auto rounded-lg border bg-background/60 p-4 text-sm leading-6 whitespace-pre-wrap">
          {appUpdate.availableUpdate?.body?.trim() ||
            "No changelog is available yet. Publish release notes in GitHub to show them here."}
        </div>
      </div>
    </div>
  );
}
