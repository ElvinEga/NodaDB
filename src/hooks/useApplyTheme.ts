import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { listen } from "@tauri-apps/api/event";

export function useApplyTheme() {
  const { theme, colorTheme, fontSize, fontFamily } = useSettingsStore();

  // Apply appearance mode (light/dark/system)
  useEffect(() => {
    const root = window.document.documentElement;

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const applySystem = () => {
        root.classList.remove("light", "dark");
        root.classList.add(mediaQuery.matches ? "dark" : "light");
      };
      applySystem();
      mediaQuery.addEventListener("change", applySystem);
      return () => mediaQuery.removeEventListener("change", applySystem);
    } else {
      root.classList.remove("light", "dark");
      root.classList.add(theme);
    }
  }, [theme]);

  // Apply color theme via data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", colorTheme);
  }, [colorTheme]);

  // Apply font size
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(
      "font-size-small",
      "font-size-medium",
      "font-size-large"
    );
    root.classList.add(`font-size-${fontSize}`);
  }, [fontSize]);

  // Apply font family
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("font-outfit", "font-jetbrains-mono", "font-system");
    root.classList.add(`font-${fontFamily.toLowerCase().replace(/ /g, "-")}`);
  }, [fontFamily]);

  // Broadcast settings change to other windows
  useEffect(() => {
    if (typeof window !== "undefined" && "__TAURI__" in window) {
      import("@tauri-apps/api/event").then(({ emit }) => {
        emit("nodadb:settings-changed", {}).catch(() => {});
      }).catch(() => {});
    }
  }, [theme, colorTheme, fontSize, fontFamily]);

  // Cross-window storage synchronization
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "app-settings-storage") {
        void useSettingsStore.persist.rehydrate();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // Also listen to custom Tauri event for real-time sync across windows
    let unlistenFn: (() => void) | undefined;
    listen("nodadb:settings-changed", () => {
      void useSettingsStore.persist.rehydrate();
    }).then((un) => {
      unlistenFn = un;
    }).catch(() => {});

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      if (unlistenFn) unlistenFn();
    };
  }, []);
}
