import { create } from 'zustand';

// ─── Audit Entry ──────────────────────────────────────────────────────────────

export type AuditSource = 'ui' | 'mcp';
export type AuditStatus = 'success' | 'error' | 'blocked' | 'pending_confirmation';

export interface AuditEntry {
  id: string;
  timestamp: string;
  source: AuditSource;
  /** Agent ID (for MCP source) or 'user' (for UI source) */
  agentId: string;
  /** The slash-command or Tauri command name */
  command: string;
  args?: Record<string, unknown>;
  result: AuditStatus;
  error?: string;
  connectionId?: string;
  durationMs?: number;
}

// ─── Store Interface ──────────────────────────────────────────────────────────

const MAX_ENTRIES = 500;

interface AuditStore {
  entries: AuditEntry[];
  /** Append a new audit entry (auto-trims to MAX_ENTRIES) */
  log: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void;
  clear: () => void;
  /** Filter entries by source */
  getBySource: (source: AuditSource) => AuditEntry[];
  /** Filter entries by agent */
  getByAgent: (agentId: string) => AuditEntry[];
  /** Recent N entries */
  getRecent: (n?: number) => AuditEntry[];
}

// ─── Store ────────────────────────────────────────────────────────────────────

let entryCounter = 0;

export const useAuditStore = create<AuditStore>()((set, get) => ({
  entries: [],

  log: (entry) =>
    set((state) => {
      const id = `audit-${Date.now()}-${++entryCounter}`;
      const newEntry: AuditEntry = { ...entry, id, timestamp: new Date().toISOString() };
      const updated = [newEntry, ...state.entries];
      return { entries: updated.slice(0, MAX_ENTRIES) };
    }),

  clear: () => set({ entries: [] }),

  getBySource: (source) => get().entries.filter((e) => e.source === source),

  getByAgent: (agentId) => get().entries.filter((e) => e.agentId === agentId),

  getRecent: (n = 50) => get().entries.slice(0, n),
}));
