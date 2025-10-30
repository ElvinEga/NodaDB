import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";
export type FontSize = "small" | "medium" | "large";
export type FontFamily = "Outfit" | "JetBrains Mono";

interface SettingsStore {
  // Appearance
  theme: Theme;
  fontSize: FontSize;
  fontFamily: FontFamily;

  // Editor
  autoSave: boolean;
  autoSaveDelay: number; // seconds
  editorTabSize: number;
  editorWordWrap: boolean;

  // Query
  autoExecuteOnLoad: boolean;
  confirmBeforeExecute: boolean;
  maxHistorySize: number;

  // Table
  rowsPerPage: number;
  showRowNumbers: boolean;

  // Actions
  setTheme: (theme: Theme) => void;
  setFontSize: (fontSize: FontSize) => void;
  setFontFamily: (fontFamily: FontFamily) => void;
  setAutoSave: (enabled: boolean) => void;
  setAutoSaveDelay: (seconds: number) => void;
  setEditorTabSize: (size: number) => void;
  setEditorWordWrap: (enabled: boolean) => void;
  setAutoExecuteOnLoad: (enabled: boolean) => void;
  setConfirmBeforeExecute: (enabled: boolean) => void;
  setMaxHistorySize: (size: number) => void;
  setRowsPerPage: (rows: number) => void;
  setShowRowNumbers: (show: boolean) => void;
  resetToDefaults: () => void;
}

const defaultSettings = {
  theme: "system" as Theme,
  fontSize: "medium" as FontSize,
  fontFamily: "Outfit" as FontFamily,
  autoSave: true,
  autoSaveDelay: 5,
  editorTabSize: 2,
  editorWordWrap: true,
  autoExecuteOnLoad: false,
  confirmBeforeExecute: false,
  maxHistorySize: 50,
  rowsPerPage: 100,
  showRowNumbers: true,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setAutoSave: (autoSave) => set({ autoSave }),
      setAutoSaveDelay: (autoSaveDelay) => set({ autoSaveDelay }),
      setEditorTabSize: (editorTabSize) => set({ editorTabSize }),
      setEditorWordWrap: (editorWordWrap) => set({ editorWordWrap }),
      setAutoExecuteOnLoad: (autoExecuteOnLoad) => set({ autoExecuteOnLoad }),
      setConfirmBeforeExecute: (confirmBeforeExecute) =>
        set({ confirmBeforeExecute }),
      setMaxHistorySize: (maxHistorySize) => set({ maxHistorySize }),
      setRowsPerPage: (rowsPerPage) => set({ rowsPerPage }),
      setShowRowNumbers: (showRowNumbers) => set({ showRowNumbers }),
      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: "app-settings-storage",
    }
  )
);
