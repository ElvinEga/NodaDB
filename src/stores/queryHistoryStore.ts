import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { QueryHistoryItem } from '@/types';

interface QueryHistoryStore {
  history: QueryHistoryItem[];
  maxHistory: number;
  addQuery: (query: Omit<QueryHistoryItem, 'id'>) => void;
  removeQuery: (id: string) => void;
  clearHistory: () => void;
  clearConnectionHistory: (connectionId: string) => void;
}

export const useQueryHistoryStore = create<QueryHistoryStore>()(
  persist(
    (set) => ({
      history: [],
      maxHistory: 50, // Keep last 50 queries

      addQuery: (query) =>
        set((state) => {
          const newItem: QueryHistoryItem = {
            ...query,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          };

          // Add to beginning and limit size
          const updatedHistory = [newItem, ...state.history].slice(0, state.maxHistory);

          return { history: updatedHistory };
        }),

      removeQuery: (id) =>
        set((state) => ({
          history: state.history.filter((item) => item.id !== id),
        })),

      clearHistory: () => set({ history: [] }),

      clearConnectionHistory: (connectionId) =>
        set((state) => ({
          history: state.history.filter((item) => item.connectionId !== connectionId),
        })),
    }),
    {
      name: 'query-history-storage',
    }
  )
);
