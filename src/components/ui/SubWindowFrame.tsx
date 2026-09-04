import { ReactNode, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { IS_MAC, USE_CUSTOM_WINDOW_CONTROLS } from "@/lib/platform";
import { WindowControls } from "@/components/ui/WindowControls";
import { cn } from "@/lib/utils";

interface SubWindowFrameProps {
  title?: string;
  headerContent?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  closeOnly?: boolean;
  className?: string;
}

export function SubWindowFrame({
  title,
  headerContent,
  headerRight,
  children,
  closeOnly = true,
  className,
}: SubWindowFrameProps) {
  const handleHeaderDoubleClick = useCallback(async (e: React.MouseEvent) => {
    // Only toggle maximize if double-clicking the drag region itself, not interactive elements
    if ((e.target as HTMLElement).closest("button, input, select, [role='tab']")) {
      return;
    }
    try {
      await getCurrentWindow().toggleMaximize();
    } catch (err) {
      console.error("Failed to toggle maximize on double-click:", err);
    }
  }, []);

  return (
    <div className={cn("flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground select-none", className)}>
      <header
        data-tauri-drag-region
        onDoubleClick={handleHeaderDoubleClick}
        className={cn(
          "flex h-11 shrink-0 items-center border-b border-border/60 bg-card/60 backdrop-blur-md",
          IS_MAC ? "pl-20 pr-3" : "pl-4 pr-0"
        )}
      >
        {title && !headerContent && (
          <div data-tauri-drag-region className="flex-1 font-medium text-xs text-muted-foreground truncate">
            {title}
          </div>
        )}

        {headerContent && (
          <div data-tauri-drag-region className="flex-1 flex items-center justify-center min-w-0">
            {headerContent}
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {headerRight}
          {USE_CUSTOM_WINDOW_CONTROLS && <WindowControls closeOnly={closeOnly} />}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
