import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getName, getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "sonner";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "up-to-date"
  | "downloading"
  | "installing"
  | "installed"
  | "error"
  | "unsupported";

export interface CheckForUpdatesOptions {
  silent?: boolean;
  onViewDetails?: () => void;
}

function isTauriRuntime() {
  return (
    typeof window !== "undefined" &&
    ("__TAURI__" in window || "__TAURI_INTERNALS__" in window)
  );
}

function formatUpdateError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to complete the update request.";
}

function isMissingPlatformUpdateError(message: string) {
  return (
    message.includes("None of the fallback platforms") &&
    message.includes("were found in the response `platforms` object")
  );
}

export function useAppUpdate() {
  const [appName, setAppName] = useState("NodaDB");
  const [currentVersion, setCurrentVersion] = useState("Unknown");
  const [status, setStatus] = useState<UpdateStatus>(
    isTauriRuntime() ? "idle" : "unsupported",
  );
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const lastToastedVersionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!isTauriRuntime()) {
      return;
    }

    Promise.all([getName(), getVersion()])
      .then(([nextAppName, nextVersion]) => {
        if (cancelled) return;
        setAppName(nextAppName);
        setCurrentVersion(nextVersion);
      })
      .catch((error) => {
        console.error("Failed to load app metadata:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (availableUpdate) {
        void availableUpdate.close().catch(() => undefined);
      }
    };
  }, [availableUpdate]);

  const setNextUpdate = useCallback((nextUpdate: Update | null) => {
    setAvailableUpdate((currentUpdate) => {
      if (currentUpdate && currentUpdate !== nextUpdate) {
        void currentUpdate.close().catch(() => undefined);
      }

      return nextUpdate;
    });
  }, []);

  const checkForUpdates = useCallback(
    async ({ silent = false, onViewDetails }: CheckForUpdatesOptions = {}) => {
      if (!isTauriRuntime()) {
        setStatus("unsupported");
        if (!silent) {
          toast.info("App updates are available only in the installed desktop app.");
        }
        return null;
      }

      try {
        setErrorMessage(null);
        setStatus("checking");

        const update = await check();

        if (!update) {
          setNextUpdate(null);
          setStatus("up-to-date");

          if (!silent) {
            toast.success(`${appName} is already up to date.`);
          }

          return null;
        }

        setNextUpdate(update);
        setStatus("available");

        if (silent && lastToastedVersionRef.current !== update.version) {
          lastToastedVersionRef.current = update.version;
          toast.info(`${appName} ${update.version} is available.`, {
            description: "Open About or Settings to read the changelog and install it.",
            action: onViewDetails
              ? {
                  label: "View details",
                  onClick: onViewDetails,
                }
              : undefined,
          });
        } else if (!silent) {
          toast.success(`Update ${update.version} is ready to install.`);
        }

        return update;
      } catch (error) {
        console.error("Failed to check for updates:", error);
        const message = formatUpdateError(error);

        if (isMissingPlatformUpdateError(message)) {
          setNextUpdate(null);
          setErrorMessage(null);
          setStatus("up-to-date");

          if (!silent) {
            toast.info(
              "No macOS update artifact is published for this release yet.",
            );
          }

          return null;
        }

        setErrorMessage(message);
        setStatus("error");

        if (!silent) {
          toast.error(message);
        }

        return null;
      }
    },
    [appName, setNextUpdate],
  );

  const downloadAndInstallUpdate = useCallback(async () => {
    if (!availableUpdate) {
      return;
    }

    try {
      setErrorMessage(null);
      setDownloadedBytes(0);
      setTotalBytes(0);
      setStatus("downloading");

      await availableUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            setStatus("downloading");
            setTotalBytes(event.data.contentLength ?? 0);
            break;
          case "Progress":
            setDownloadedBytes((current) => current + event.data.chunkLength);
            break;
          case "Finished":
            setStatus("installing");
            break;
        }
      });

      setStatus("installed");
      toast.success("Update installed. Restarting NodaDB...");
      await relaunch();
    } catch (error) {
      console.error("Failed to install update:", error);
      const message = formatUpdateError(error);
      setErrorMessage(message);
      setStatus("error");
      toast.error(message);
    }
  }, [availableUpdate]);

  const progressPercent = useMemo(() => {
    if (!totalBytes) {
      return 0;
    }

    return Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
  }, [downloadedBytes, totalBytes]);

  return {
    appName,
    currentVersion,
    status,
    availableUpdate,
    errorMessage,
    downloadedBytes,
    totalBytes,
    progressPercent,
    isSupported: isTauriRuntime(),
    checkForUpdates,
    downloadAndInstallUpdate,
  };
}
