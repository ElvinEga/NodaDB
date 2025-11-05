import { useState, useEffect } from "react";
import { Command, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CheatSheetShortcut {
  keys: string[];
  description: string;
}

const essentialShortcuts: CheatSheetShortcut[] = [
  { keys: ["Ctrl", "N"], description: "New Query" },
  { keys: ["Ctrl", "W"], description: "Close Tab" },
  { keys: ["Ctrl", "Enter"], description: "Execute Query" },
  { keys: ["Ctrl", "E"], description: "Export Data" },
  { keys: ["Ctrl", "B"], description: "Query Builder" },
  { keys: ["Ctrl", "Shift", "G"], description: "Generate Data" },
  { keys: ["Ctrl", "Tab"], description: "Next Tab" },
  { keys: ["Ctrl", "?"], description: "All Shortcuts" },
];

export function KeyboardCheatSheet() {
  const [isVisible, setIsVisible] = useState(false);
  const [showToggleButton, setShowToggleButton] = useState(true);

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

  const modifierMap: Record<string, string> = isMac
    ? { Ctrl: "⌘", Alt: "⌥", Shift: "⇧", Enter: "⏎" }
    : { Ctrl: "Ctrl", Alt: "Alt", Shift: "Shift", Enter: "Enter" };

  // Show cheat sheet on first load (after a delay)
  useEffect(() => {
    const hasSeenCheatSheet = localStorage.getItem("hasSeenKeyboardCheatSheet");
    if (!hasSeenCheatSheet) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Hide toggle button after a period of time
  useEffect(() => {
    const hideTimer = setTimeout(() => {
      setShowToggleButton(false);
    }, 10000); // Hide after 10 seconds

    return () => clearTimeout(hideTimer);
  }, []);

  // Show toggle button when cheat sheet is closed
  useEffect(() => {
    if (!isVisible) {
      setShowToggleButton(true);

      // Hide it again after 10 seconds
      const hideTimer = setTimeout(() => {
        setShowToggleButton(false);
      }, 10000);

      return () => clearTimeout(hideTimer);
    }
  }, [isVisible]);

  // Listen for Ctrl+? to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
      if (ctrlOrCmd && e.key === "?") {
        e.preventDefault();
        setIsVisible((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMac]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("hasSeenKeyboardCheatSheet", "true");
  };

  const handleToggle = () => {
    setIsVisible((prev) => !prev);
  };

  const renderKey = (key: string) => {
    const displayKey = modifierMap[key] || key;
    return (
      <Badge
        variant="secondary"
        className="px-1.5 py-0 text-[10px] font-mono font-semibold bg-primary/10 border-primary/20"
      >
        {displayKey}
      </Badge>
    );
  };

  return (
    <>
      {/* Toggle Button */}
      {!isVisible && showToggleButton && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggle}
          className="fixed bottom-20 right-4 z-40 shadow-lg gap-2 group animate-in fade-in duration-300"
          title="Show keyboard shortcuts (Ctrl+?)"
        >
          <Command className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Shortcuts</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
            {isMac ? "⌘" : "Ctrl"}?
          </Badge>
        </Button>
      )}

      {/* Cheat Sheet Overlay */}
      {isVisible && (
        <div
          className={cn(
            "fixed bottom-4 right-4 z-50 w-80 bg-background/95 backdrop-blur-md border border-border rounded-lg shadow-2xl",
            "animate-in slide-in-from-bottom-4 fade-in duration-300"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Command className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Essential Shortcuts</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Shortcuts List */}
          <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
            {essentialShortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                <span className="text-xs text-muted-foreground">
                  {shortcut.description}
                </span>
                <div className="flex items-center gap-0.5">
                  {shortcut.keys.map((key, i) => (
                    <div key={i} className="flex items-center gap-0.5">
                      {renderKey(key)}
                      {i < shortcut.keys.length - 1 && (
                        <span className="text-[10px] text-muted-foreground mx-0.5">
                          +
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-border bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="w-full text-xs h-7"
            >
              View All Shortcuts
              <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                {isMac ? "⌘" : "Ctrl"}?
              </Badge>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
