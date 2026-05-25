import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ConnectionConfig } from '@/types';

interface ConnectionStore {
  connections: ConnectionConfig[];
  activeConnectionId: string | null;
  previousConnectionId: string | null;
  addConnection: (connection: ConnectionConfig) => void;
  removeConnection: (id: string) => void;
  updateConnection: (id: string, updates: Partial<ConnectionConfig>) => void;
  setActiveConnection: (id: string | null) => void;
  openConnectionSwitcher: () => void;
  restorePreviousConnection: () => void;
  clearPreviousConnection: () => void;
  getActiveConnection: () => ConnectionConfig | null;
}

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set, get) => ({
      connections: [],
      activeConnectionId: null,
      previousConnectionId: null,
      
      addConnection: (connection) =>
        set((state) => ({
          connections: [...state.connections, connection],
        })),
      
      removeConnection: (id) =>
        set((state) => ({
          connections: state.connections.filter((c) => c.id !== id),
          activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
          previousConnectionId: state.previousConnectionId === id ? null : state.previousConnectionId,
        })),
      
      updateConnection: (id, updates) =>
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),
      
      setActiveConnection: (id) =>
        set({ activeConnectionId: id, previousConnectionId: null }),

      openConnectionSwitcher: () =>
        set((state) => ({
          previousConnectionId: state.activeConnectionId,
          activeConnectionId: null,
        })),

      restorePreviousConnection: () =>
        set((state) => ({
          activeConnectionId: state.previousConnectionId,
          previousConnectionId: null,
        })),

      clearPreviousConnection: () =>
        set({ previousConnectionId: null }),
      
      getActiveConnection: () => {
        const state = get();
        return state.connections.find((c) => c.id === state.activeConnectionId) || null;
      },
    }),
    {
      name: 'nodadb-connections-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ connections: state.connections }),
    }
  )
);
