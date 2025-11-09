import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ConnectionConfig } from '@/types';

interface ConnectionStore {
  connections: ConnectionConfig[];
  activeConnectionId: string | null;
  addConnection: (connection: ConnectionConfig) => void;
  removeConnection: (id: string) => void;
  updateConnection: (id: string, updates: Partial<ConnectionConfig>) => void;
  setActiveConnection: (id: string | null) => void;
  getActiveConnection: () => ConnectionConfig | null;
}

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set, get) => ({
      connections: [],
      activeConnectionId: null,
      
      addConnection: (connection) =>
        set((state) => ({
          connections: [...state.connections, connection],
        })),
      
      removeConnection: (id) =>
        set((state) => ({
          connections: state.connections.filter((c) => c.id !== id),
          activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
        })),
      
      updateConnection: (id, updates) =>
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),
      
      setActiveConnection: (id) =>
        set({ activeConnectionId: id }),
      
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
