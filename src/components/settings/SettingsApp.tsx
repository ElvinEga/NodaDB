import { useState, useEffect, useCallback, type ComponentType } from "react";
import { SubWindowFrame } from "@/components/ui/SubWindowFrame";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useApplyTheme } from "@/hooks/useApplyTheme";
import { useSettingsStore } from "@/stores/settingsStore";
import { listen } from "@tauri-apps/api/event";
import { toast, Toaster } from "sonner";
import {
  Palette,
  Sparkles,
  Code,
  FileText,
  Database,
  Bot,
  Download,
  RotateCcw,
} from "lucide-react";

import { AppearanceSection } from "./sections/AppearanceSection";
import { ThemesSection } from "./sections/ThemesSection";
import { EditorSection } from "./sections/EditorSection";
import { QuerySection } from "./sections/QuerySection";
import { TableSection } from "./sections/TableSection";
import { AiSection } from "./sections/AiSection";
import { UpdatesSection } from "./sections/UpdatesSection";

export type SettingsTab =
  | "appearance"
  | "themes"
  | "editor"
  | "query"
  | "table"
  | "ai"
  | "updates";

interface TabItem {
  id: SettingsTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType;
}

const TABS: TabItem[] = [
  { id: "appearance", label: "Appearance", icon: Palette, component: AppearanceSection },
  { id: "themes", label: "Themes", icon: Sparkles, component: ThemesSection },
  { id: "editor", label: "Editor", icon: Code, component: EditorSection },
  { id: "query", label: "Query", icon: FileText, component: QuerySection },
  { id: "table", label: "Table", icon: Database, component: TableSection },
  { id: "ai", label: "AI", icon: Bot, component: AiSection },
  { id: "updates", label: "Updates", icon: Download, component: UpdatesSection },
];

const VALID_TABS: SettingsTab[] = [
  "appearance",
  "themes",
  "editor",
  "query",
  "table",
  "ai",
  "updates",
];

function readInitialTab(): SettingsTab {
  if (typeof window === "undefined") return "appearance";
  try {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("tab");
    if (t && (VALID_TABS as string[]).includes(t)) {
      return t as SettingsTab;
    }
  } catch {
    // ignore
  }
  return "appearance";
}

export function SettingsApp() {
  useApplyTheme();

  const [activeTab, setActiveTab] = useState<SettingsTab>(readInitialTab);
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);

  // Listen for navigation events if focused with a new tab request
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;
    listen<string>("navigate-sub-window", (event) => {
      try {
        const payload = event.payload;
        // Parse route, e.g. "settings&tab=ai" or "settings?tab=ai"
        const queryIndex = payload.search(/[?&]/);
        if (queryIndex !== -1) {
          const queryString = payload.slice(queryIndex + 1);
          const params = new URLSearchParams(queryString);
          const tab = params.get("tab");
          if (tab && (VALID_TABS as string[]).includes(tab)) {
            setActiveTab(tab as SettingsTab);
          }
        }
      } catch (e) {
        console.error("Failed to parse navigation event:", e);
      }
    }).then((un) => {
      unlistenFn = un;
    }).catch(() => {});

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  const handleResetDefaults = useCallback(() => {
    if (confirm("Reset all settings to defaults? This cannot be undone.")) {
      resetToDefaults();
      toast.success("Settings reset to defaults");
    }
  }, [resetToDefaults]);

  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.component || AppearanceSection;

  return (
    <SubWindowFrame
      headerContent={
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as SettingsTab)}
          className="w-full flex items-center justify-center"
        >
          <TabsList className="h-8 bg-muted/50 p-1 border border-border/40">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="h-6 gap-1.5 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      }
    >
      <div className="mx-auto w-full max-w-2xl px-6 py-6 pb-12">
        <ActiveComponent />

        {/* Footer */}
        <div className="mt-10 pt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
          <span>NodaDB Settings</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetDefaults}
            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to Defaults
          </Button>
        </div>
      </div>
      <Toaster richColors closeButton position="top-right" />
    </SubWindowFrame>
  );
}
