import { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface WindowControlsProps {
  closeOnly?: boolean;
  className?: string;
}

export function WindowControls({ closeOnly = false, className }: WindowControlsProps) {
  const handleMinimize = useCallback(async () => {
    try {
      await getCurrentWindow().minimize();
    } catch (e) {
      console.error("Window minimize failed:", e);
    }
  }, []);

  const handleToggleMaximize = useCallback(async () => {
    try {
      await getCurrentWindow().toggleMaximize();
    } catch (e) {
      console.error("Window toggle maximize failed:", e);
    }
  }, []);

  const handleClose = useCallback(async () => {
    try {
      await getCurrentWindow().close();
    } catch (e) {
      console.error("Window close failed:", e);
    }
  }, []);

  return (
    <div className={cn("flex items-center h-full no-drag select-none", className)}>
      {!closeOnly && (
        <>
          <button
            type="button"
            onClick={handleMinimize}
            className="flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Minimize"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleToggleMaximize}
            className="flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Maximize"
          >
            <Square className="h-3 w-3" />
          </button>
        </>
      )}
      <button
        type="button"
        onClick={handleClose}
        className="flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
        title="Close"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
