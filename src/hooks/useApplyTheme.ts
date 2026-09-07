import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { listen } from "@tauri-apps/api/event";

export function useApplyTheme() {
  const {
    theme,
    colorTheme,
    fontSize,
    fontFamily,
    glassOpacity,
    glassBlur,
  } = useSettingsStore();

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

  // Apply color theme via data-theme attribute and native glass mode
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", colorTheme);

    const isGlass = colorTheme === "glass";
    if (isGlass) {
      root.classList.add("has-native-glass");
      root.style.setProperty("--glass-opacity", `${glassOpacity}`);
      root.style.setProperty("--glass-blur", `${glassBlur}px`);
    } else {
      root.classList.remove("has-native-glass");
      root.style.removeProperty("--glass-opacity");
      root.style.removeProperty("--glass-blur");
    }

    if (
      typeof window !== "undefined" &&
      ("__TAURI__" in window || "__TAURI_INTERNALS__" in window)
    ) {
      import("@tauri-apps/api/core")
        .then(({ invoke }) => {
          invoke("set_window_glass_mode", {
            enabled: isGlass,
            blurRadius: glassBlur,
          }).catch((err) => {
            console.error("Failed to set window glass mode:", err);
          });
        })
        .catch(() => {});
    }
  }, [colorTheme, glassOpacity, glassBlur]);

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
  }, [theme, colorTheme, fontSize, fontFamily, glassOpacity, glassBlur]);

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
