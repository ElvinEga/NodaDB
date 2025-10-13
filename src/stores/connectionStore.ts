import { create } from 'zustand';
import { ConnectionConfig } from '@/types';

interface ConnectionStore {
  connections: ConnectionConfig[];
  activeConnectionId: string | null;
  addConnection: (connection: ConnectionConfig) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (id: string | null) => void;
  getActiveConnection: () => ConnectionConfig | null;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
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
  
  setActiveConnection: (id) =>
    set({ activeConnectionId: id }),
  
  getActiveConnection: () => {
    const state = get();
    return state.connections.find((c) => c.id === state.activeConnectionId) || null;
  },
}));
