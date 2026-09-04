import { useState, useEffect, useMemo, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Toaster, toast } from "sonner";
import { SubWindowFrame } from "@/components/ui/SubWindowFrame";
import { useApplyTheme } from "@/hooks/useApplyTheme";
import { useConnectionStore } from "@/stores/connectionStore";
import { ConnectionConfig } from "@/types";
import { ConnectionForm } from "./ConnectionForm";

function getConnectionIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const directId = params.get("id");
    if (directId) return directId;

    const windowParam = params.get("window");
    if (windowParam) {
      const queryIdx = windowParam.search(/[?&]/);
      if (queryIdx !== -1) {
        const subParams = new URLSearchParams(windowParam.slice(queryIdx + 1));
        return subParams.get("id");
      }
    }
  } catch (e) {
    console.error("Failed to parse connection ID from URL:", e);
  }
  return null;
}

export function ConnectionApp() {
  useApplyTheme();

  const [editId, setEditId] = useState<string | null>(getConnectionIdFromUrl);
  const connections = useConnectionStore((state) => state.connections);
  const addConnection = useConnectionStore((state) => state.addConnection);
  const updateConnection = useConnectionStore((state) => state.updateConnection);
  const setActiveConnection = useConnectionStore((state) => state.setActiveConnection);

  // Synchronize store from storage on mount in case it was modified in another window
  useEffect(() => {
    try {
      useConnectionStore.persist.rehydrate();
    } catch (e) {
      console.warn("Could not rehydrate connection store:", e);
    }
  }, []);

  // Listen for navigation events if focused with a new connection or edit request
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;
    listen<string>("navigate-sub-window", (event) => {
      try {
        const payload = event.payload;
        const queryIndex = payload.search(/[?&]/);
        if (queryIndex !== -1) {
          const queryString = payload.slice(queryIndex + 1);
          const params = new URLSearchParams(queryString);
          const id = params.get("id");
          setEditId(id || null);
        } else {
          setEditId(null);
        }
      } catch (e) {
        console.error("Failed to handle sub-window navigation:", e);
      }
    }).then((fn) => {
      unlistenFn = fn;
    });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  const editConnection = useMemo(() => {
    if (!editId) return null;
    return connections.find((c) => c.id === editId) || null;
  }, [connections, editId]);

  const handleSuccess = useCallback(
    async (config: ConnectionConfig, isEdit: boolean) => {
      try {
        if (isEdit) {
          updateConnection(config.id, config);
          toast.success("Connection updated successfully");
        } else {
          addConnection(config);
          setActiveConnection(config.id);
          toast.success(`Successfully connected to ${config.name}`);
        }

        // Broadcast to main window and other windows
        await emit("nodadb:connections-changed");
        await emit("nodadb:connection-activated", { connectionId: config.id });

        // Switch focus back to main window
        try {
          await invoke("focus_main_window");
        } catch (focusErr) {
          console.warn("Failed to focus main window:", focusErr);
        }

        // Close this sub-window
        await getCurrentWindow().close();
      } catch (error) {
        toast.error(`Failed to finalize connection: ${error}`);
        console.error("Error finalizing connection:", error);
      }
    },
    [addConnection, updateConnection, setActiveConnection]
  );

  const handleCancel = useCallback(async () => {
    try {
      await getCurrentWindow().close();
    } catch (error) {
      console.error("Failed to close window:", error);
    }
  }, []);

  const title = editConnection
    ? `Edit Connection — ${editConnection.name}`
    : "New Database Connection";

  return (
    <SubWindowFrame title={title} closeOnly={false}>
      <Toaster position="bottom-right" richColors />
      <ConnectionForm
        initialConfig={editConnection}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </SubWindowFrame>
  );
}
export default ConnectionApp;
