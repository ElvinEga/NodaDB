import { ExternalLink, Info } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AppUpdatePanel } from "@/components/AppUpdatePanel";
import type { useAppUpdate } from "@/hooks/useAppUpdate";

type AppUpdateModel = ReturnType<typeof useAppUpdate>;

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appUpdate: AppUpdateModel;
  autoCheckForUpdates: boolean;
  onAutoCheckChange: (enabled: boolean) => void;
}

export function AboutDialog({
  open,
  onOpenChange,
  appUpdate,
  autoCheckForUpdates,
  onAutoCheckChange,
}: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0">
        <div className="flex max-h-[85vh] flex-col">
          <DialogHeader className="border-b px-6 py-5 text-left">
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              About {appUpdate.appName}
            </DialogTitle>
            <DialogDescription>
              Version {appUpdate.currentVersion} • desktop database management with built-in update delivery.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 overflow-y-auto px-6 py-5">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{appUpdate.appName}</h3>
                  <p className="text-sm text-muted-foreground">
                    Current version {appUpdate.currentVersion}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => void openUrl("https://github.com/ElvinEga/NodaDB")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  GitHub Repository
                </Button>
              </div>
            </div>

            <AppUpdatePanel
              appUpdate={appUpdate}
              autoCheckForUpdates={autoCheckForUpdates}
              onAutoCheckChange={onAutoCheckChange}
              title="Release Updates"
              description="Read the latest release notes, download the signed installer, and restart into the new version."
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
