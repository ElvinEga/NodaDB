import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";
export type ColorTheme = string;
export type FontSize = "small" | "medium" | "large";
export type FontFamily = "Outfit" | "JetBrains Mono" | "System";
export type AIProvider = "codex" | "claude" | "opencode" | "gemini";
export type AIIntegration = "cli" | "acp" | "mcp" | "plugin";

interface SettingsStore {
  // Appearance
  theme: Theme;
  colorTheme: ColorTheme;
  fontSize: FontSize;
  fontFamily: FontFamily;

  // Editor
  autoSave: boolean;
  autoSaveDelay: number;
  editorTabSize: number;
  editorWordWrap: boolean;

  // Query
  autoExecuteOnLoad: boolean;
  confirmBeforeExecute: boolean;
  maxHistorySize: number;

  // Table
  rowsPerPage: number;
  showRowNumbers: boolean;

  // Updates
  autoCheckForUpdates: boolean;

  // AI Assistant
  aiEnabled: boolean;
  aiProvider: AIProvider;
  aiIntegration: AIIntegration;
  aiAutoIncludeSchema: boolean;
  aiAutoIncludeQuery: boolean;
  aiConfirmGeneratedSql: boolean;
  aiOpenAssistantOnLaunch: boolean;
  aiAllowWriteOperations: boolean;
  aiAllowSchemaChanges: boolean;
  aiModel: string;

  // Actions
  setTheme: (theme: Theme) => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
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
  setAutoCheckForUpdates: (enabled: boolean) => void;
  setAiEnabled: (enabled: boolean) => void;
  setAiProvider: (provider: AIProvider) => void;
  setAiIntegration: (integration: AIIntegration) => void;
  setAiAutoIncludeSchema: (enabled: boolean) => void;
  setAiAutoIncludeQuery: (enabled: boolean) => void;
  setAiConfirmGeneratedSql: (enabled: boolean) => void;
  setAiOpenAssistantOnLaunch: (enabled: boolean) => void;
  setAiAllowWriteOperations: (enabled: boolean) => void;
  setAiAllowSchemaChanges: (enabled: boolean) => void;
  setAiModel: (model: string) => void;
  resetToDefaults: () => void;
}

const defaultSettings = {
  theme: "system" as Theme,
  colorTheme: "default" as ColorTheme,
  fontSize: "small" as FontSize,
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
  autoCheckForUpdates: true,
  aiEnabled: true,
  aiProvider: "codex" as AIProvider,
  aiIntegration: "cli" as AIIntegration,
  aiAutoIncludeSchema: true,
  aiAutoIncludeQuery: true,
  aiConfirmGeneratedSql: true,
  aiOpenAssistantOnLaunch: false,
  aiAllowWriteOperations: false,
  aiAllowSchemaChanges: false,
  aiModel: "auto",
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setTheme: (theme) => set({ theme }),
      setColorTheme: (colorTheme) => set({ colorTheme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setAutoSave: (autoSave) => set({ autoSave }),
      setAutoSaveDelay: (autoSaveDelay) => set({ autoSaveDelay }),
      setEditorTabSize: (editorTabSize) => set({ editorTabSize }),
      setEditorWordWrap: (editorWordWrap) => set({ editorWordWrap }),
      setAutoExecuteOnLoad: (autoExecuteOnLoad) => set({ autoExecuteOnLoad }),
      setConfirmBeforeExecute: (confirmBeforeExecute) => set({ confirmBeforeExecute }),
      setMaxHistorySize: (maxHistorySize) => set({ maxHistorySize }),
      setRowsPerPage: (rowsPerPage) => set({ rowsPerPage }),
      setShowRowNumbers: (showRowNumbers) => set({ showRowNumbers }),
      setAutoCheckForUpdates: (autoCheckForUpdates) => set({ autoCheckForUpdates }),
      setAiEnabled: (aiEnabled) => set({ aiEnabled }),
      setAiProvider: (aiProvider) => set({ aiProvider }),
      setAiIntegration: (aiIntegration) => set({ aiIntegration }),
      setAiAutoIncludeSchema: (aiAutoIncludeSchema) => set({ aiAutoIncludeSchema }),
      setAiAutoIncludeQuery: (aiAutoIncludeQuery) => set({ aiAutoIncludeQuery }),
      setAiConfirmGeneratedSql: (aiConfirmGeneratedSql) => set({ aiConfirmGeneratedSql }),
      setAiOpenAssistantOnLaunch: (aiOpenAssistantOnLaunch) => set({ aiOpenAssistantOnLaunch }),
      setAiAllowWriteOperations: (aiAllowWriteOperations) => set({ aiAllowWriteOperations }),
      setAiAllowSchemaChanges: (aiAllowSchemaChanges) => set({ aiAllowSchemaChanges }),
      setAiModel: (aiModel) => set({ aiModel }),
      resetToDefaults: () => set(defaultSettings),
    }),
    { name: "app-settings-storage" },
  ),
);
