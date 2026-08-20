import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";
export type ColorTheme = string;
export type FontSize = "small" | "medium" | "large";
export type FontFamily = "Outfit" | "JetBrains Mono" | "System";
export type AiProvider = "codex" | "claude" | "opencode" | "gemini";
export type AiIntegration = "cli" | "acp" | "mcp" | "plugin";

interface SettingsStore {
  // Appearance
  theme: Theme;
  colorTheme: ColorTheme;
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

  // Updates
  autoCheckForUpdates: boolean;

  // AI Assistant
  aiEnabled: boolean;
  aiProvider: AiProvider;
  aiIntegration: AiIntegration;
  aiModel: string;
  aiAutoIncludeSchema: boolean;
  aiAutoIncludeQuery: boolean;
  aiIncludeSelectedTable: boolean;
  aiIncludeRelationships: boolean;
  aiIncludeQueryResults: boolean;
  aiIncludeExplain: boolean;
  aiConfirmGeneratedSql: boolean;
  aiAllowWriteOperations: boolean;
  aiAllowSchemaChanges: boolean;
  aiOpenAssistantOnLaunch: boolean;

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

  // AI Actions
  setAiEnabled: (enabled: boolean) => void;
  setAiProvider: (provider: AiProvider) => void;
  setAiIntegration: (integration: AiIntegration) => void;
  setAiModel: (model: string) => void;
  setAiAutoIncludeSchema: (enabled: boolean) => void;
  setAiAutoIncludeQuery: (enabled: boolean) => void;
  setAiIncludeSelectedTable: (enabled: boolean) => void;
  setAiIncludeRelationships: (enabled: boolean) => void;
  setAiIncludeQueryResults: (enabled: boolean) => void;
  setAiIncludeExplain: (enabled: boolean) => void;
  setAiConfirmGeneratedSql: (enabled: boolean) => void;
  setAiAllowWriteOperations: (enabled: boolean) => void;
  setAiAllowSchemaChanges: (enabled: boolean) => void;
  setAiOpenAssistantOnLaunch: (enabled: boolean) => void;

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

  // AI Defaults
  aiEnabled: true,
  aiProvider: "claude" as AiProvider,
  aiIntegration: "cli" as AiIntegration,
  aiModel: "",
  aiAutoIncludeSchema: true,
  aiAutoIncludeQuery: true,
  aiIncludeSelectedTable: true,
  aiIncludeRelationships: true,
  aiIncludeQueryResults: false,
  aiIncludeExplain: true,
  aiConfirmGeneratedSql: true,
  aiAllowWriteOperations: false,
  aiAllowSchemaChanges: false,
  aiOpenAssistantOnLaunch: false,
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
      setConfirmBeforeExecute: (confirmBeforeExecute) =>
        set({ confirmBeforeExecute }),
      setMaxHistorySize: (maxHistorySize) => set({ maxHistorySize }),
      setRowsPerPage: (rowsPerPage) => set({ rowsPerPage }),
      setShowRowNumbers: (showRowNumbers) => set({ showRowNumbers }),
      setAutoCheckForUpdates: (autoCheckForUpdates) =>
        set({ autoCheckForUpdates }),

      // AI Setters
      setAiEnabled: (aiEnabled) => set({ aiEnabled }),
      setAiProvider: (aiProvider) => set({ aiProvider }),
      setAiIntegration: (aiIntegration) => set({ aiIntegration }),
      setAiModel: (aiModel) => set({ aiModel }),
      setAiAutoIncludeSchema: (aiAutoIncludeSchema) => set({ aiAutoIncludeSchema }),
      setAiAutoIncludeQuery: (aiAutoIncludeQuery) => set({ aiAutoIncludeQuery }),
      setAiIncludeSelectedTable: (aiIncludeSelectedTable) => set({ aiIncludeSelectedTable }),
      setAiIncludeRelationships: (aiIncludeRelationships) => set({ aiIncludeRelationships }),
      setAiIncludeQueryResults: (aiIncludeQueryResults) => set({ aiIncludeQueryResults }),
      setAiIncludeExplain: (aiIncludeExplain) => set({ aiIncludeExplain }),
      setAiConfirmGeneratedSql: (aiConfirmGeneratedSql) => set({ aiConfirmGeneratedSql }),
      setAiAllowWriteOperations: (aiAllowWriteOperations) => set({ aiAllowWriteOperations }),
      setAiAllowSchemaChanges: (aiAllowSchemaChanges) => set({ aiAllowSchemaChanges }),
      setAiOpenAssistantOnLaunch: (aiOpenAssistantOnLaunch) => set({ aiOpenAssistantOnLaunch }),

      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: "app-settings-storage",
    },
  ),
);
