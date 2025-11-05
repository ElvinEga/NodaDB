import { create } from "zustand";

// Create a stable, empty array constant to prevent infinite loops
export const EMPTY_HISTORY: TableAction[] = [];

export type ActionType =
  | "insert"
  | "update"
  | "delete"
  | "batch_update"
  | "batch_delete"
  | "batch_duplicate";

export interface TableAction {
  id: string;
  type: ActionType;
  timestamp: Date;
  tableName: string;
  connectionId: string;
  dbType: string;

  // Action-specific data
  data: {
    // For insert/delete: the full row(s)
    rows?: Record<string, any>[];

    // For update: old and new values
    oldValues?: Record<string, any>[];
    newValues?: Record<string, any>[];

    // Primary key values for identifying rows
    primaryKeyColumn?: string;
    primaryKeyValues?: any[];

    // For batch update: column and value
    columnName?: string;
    value?: string;

    // Where clause for operations
    whereClause?: string;
  };

  // SQL for undo/redo
  undoSql: string;
  redoSql: string;
}

interface UndoRedoState {
  // History stacks per table (key: connectionId-tableName)
  history: Map<string, TableAction[]>;
  currentIndex: Map<string, number>;
  maxHistorySize: number;

  // Actions
  addAction: (tableKey: string, action: TableAction) => void;
  undo: (tableKey: string) => TableAction | null;
  redo: (tableKey: string) => TableAction | null;
  canUndo: (tableKey: string) => boolean;
  canRedo: (tableKey: string) => boolean;
  clearHistory: (tableKey: string) => void;
  getHistory: (tableKey: string) => TableAction[];
  getHistoryForKey: (tableKey: string) => TableAction[];
  getCurrentAction: (tableKey: string) => TableAction | null;
}

export const useUndoRedoStore = create<UndoRedoState>((set, get) => {
  // A cache for our selectors to ensure stable references
  const historyCache = new Map<string, TableAction[]>();

  return {
    history: new Map(),
    currentIndex: new Map(),
    maxHistorySize: 50,

    addAction: (tableKey: string, action: TableAction) => {
      set((state) => {
        const newHistory = new Map(state.history);
        const newCurrentIndex = new Map(state.currentIndex);

        const tableHistory = newHistory.get(tableKey) || [];
        const currentIdx = newCurrentIndex.get(tableKey) ?? -1;

        // Remove any actions after current index (when adding new action after undo)
        const updatedHistory = tableHistory.slice(0, currentIdx + 1);

        // Add new action
        updatedHistory.push(action);

        // Limit history size
        if (updatedHistory.length > state.maxHistorySize) {
          updatedHistory.shift();
        }

        newHistory.set(tableKey, updatedHistory);
        newCurrentIndex.set(tableKey, updatedHistory.length - 1);

        return {
          history: newHistory,
          currentIndex: newCurrentIndex,
        };
      });
    },

    undo: (tableKey: string) => {
      const state = get();
      const tableHistory = state.history.get(tableKey);
      const currentIdx = state.currentIndex.get(tableKey);

      if (!tableHistory || currentIdx === undefined || currentIdx < 0) {
        return null;
      }

      const action = tableHistory[currentIdx];

      set((state) => {
        const newCurrentIndex = new Map(state.currentIndex);
        newCurrentIndex.set(tableKey, currentIdx - 1);
        return { currentIndex: newCurrentIndex };
      });

      return action;
    },

    redo: (tableKey: string) => {
      const state = get();
      const tableHistory = state.history.get(tableKey);
      const currentIdx = state.currentIndex.get(tableKey) ?? -1;

      if (!tableHistory || currentIdx >= tableHistory.length - 1) {
        return null;
      }

      const action = tableHistory[currentIdx + 1];

      set((state) => {
        const newCurrentIndex = new Map(state.currentIndex);
        newCurrentIndex.set(tableKey, currentIdx + 1);
        return { currentIndex: newCurrentIndex };
      });

      return action;
    },

    canUndo: (tableKey: string) => {
      const state = get();
      const currentIdx = state.currentIndex.get(tableKey);
      return currentIdx !== undefined && currentIdx >= 0;
    },

    canRedo: (tableKey: string) => {
      const state = get();
      const tableHistory = state.history.get(tableKey);
      const currentIdx = state.currentIndex.get(tableKey) ?? -1;
      return tableHistory ? currentIdx < tableHistory.length - 1 : false;
    },

    clearHistory: (tableKey: string) => {
      set((state) => {
        const newHistory = new Map(state.history);
        const newCurrentIndex = new Map(state.currentIndex);

        newHistory.delete(tableKey);
        newCurrentIndex.delete(tableKey);

        return {
          history: newHistory,
          currentIndex: newCurrentIndex,
        };
      });
    },

    getHistory: (tableKey: string) => {
      const state = get();
      return state.history.get(tableKey) || EMPTY_HISTORY;
    },

    // This is our new, safe selector function
    getHistoryForKey: (tableKey: string) => {
      const currentHistory = get().history.get(tableKey);

      if (!currentHistory) {
        return EMPTY_HISTORY; // Return the stable empty array if nothing exists
      }

      // Check if we have a cached version for this history array
      if (historyCache.get(tableKey) === currentHistory) {
        // If the array in the store is the same as our cache, do nothing.
        // (This part is a bit redundant but illustrates the caching idea)
      } else {
        // If the history array has been updated in the store, update our cache.
        historyCache.set(tableKey, currentHistory);
      }

      // Always return the array from the store, which Zustand manages.
      // Zustand's `Map` operations will ensure this reference is stable if the content hasn't changed.
      return currentHistory;
    },

    getCurrentAction: (tableKey: string) => {
      const state = get();
      const tableHistory = state.history.get(tableKey);
      const currentIdx = state.currentIndex.get(tableKey);

      if (!tableHistory || currentIdx === undefined || currentIdx < 0) {
        return null;
      }

      return tableHistory[currentIdx];
    },
  };
});
