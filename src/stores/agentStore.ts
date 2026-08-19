import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Permission } from '@/lib/commandRegistry';

// ─── Agent Config ─────────────────────────────────────────────────────────────

export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  /** Which permissions this agent has been granted */
  permissions: Permission[];
  /**
   * Trusted agents bypass confirmation dialogs for WRITE operations.
   * Only enable for local, session-scoped agents you fully control.
   */
  trusted: boolean;
  createdAt: string;
  lastSeenAt?: string;
  /** Whether this is a built-in preset (not deletable from UI) */
  builtin?: boolean;
}

// ─── Default Agent Presets ────────────────────────────────────────────────────

const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Anthropic Claude Code — safe read/schema/explain access by default',
    permissions: ['READ', 'EXPLAIN', 'SCHEMA', 'EXPORT'],
    trusted: false,
    createdAt: new Date().toISOString(),
    builtin: true,
  },
  {
    id: 'codex',
    name: 'Codex',
    description: 'OpenAI Codex — read + write access for generating and running queries',
    permissions: ['READ', 'WRITE', 'EXPLAIN', 'SCHEMA', 'EXPORT'],
    trusted: false,
    createdAt: new Date().toISOString(),
    builtin: true,
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'OpenCode — read-only access with schema exploration',
    permissions: ['READ', 'EXPLAIN', 'SCHEMA'],
    trusted: false,
    createdAt: new Date().toISOString(),
    builtin: true,
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    description: 'Google Gemini CLI — read and explain access',
    permissions: ['READ', 'EXPLAIN', 'SCHEMA'],
    trusted: false,
    createdAt: new Date().toISOString(),
    builtin: true,
  },
  {
    id: 'aider',
    name: 'Aider',
    description: 'Aider AI pair programmer — read/write/migration access',
    permissions: ['READ', 'WRITE', 'EXPLAIN', 'SCHEMA', 'MIGRATION', 'EXPORT'],
    trusted: false,
    createdAt: new Date().toISOString(),
    builtin: true,
  },
];

// All possible permissions with labels
export const ALL_PERMISSIONS: { value: Permission; label: string; description: string; destructive?: boolean }[] = [
  { value: 'READ', label: 'Read', description: 'SELECT queries and metadata inspection' },
  { value: 'WRITE', label: 'Write', description: 'INSERT, UPDATE, DELETE operations', destructive: true },
  { value: 'SCHEMA', label: 'Schema', description: 'DDL: CREATE, ALTER, DROP tables and columns', destructive: true },
  { value: 'EXPLAIN', label: 'Explain', description: 'Query execution plan analysis (EXPLAIN/ANALYZE)' },
  { value: 'EXPORT', label: 'Export', description: 'Export data and table structures to files' },
  { value: 'MIGRATION', label: 'Migration', description: 'Apply and rollback schema migrations', destructive: true },
  { value: 'ADMIN', label: 'Admin', description: 'Full NodaDB configuration access (local only)', destructive: true },
  { value: 'NETWORK', label: 'Network', description: 'Establish SSH tunnels and new connections', destructive: true },
];

// ─── Store Interface ──────────────────────────────────────────────────────────

interface AgentStore {
  agents: AgentConfig[];
  addAgent: (agent: Omit<AgentConfig, 'createdAt' | 'builtin'>) => void;
  updateAgent: (id: string, patch: Partial<Omit<AgentConfig, 'id' | 'createdAt' | 'builtin'>>) => void;
  removeAgent: (id: string) => void;
  getAgent: (id: string) => AgentConfig | undefined;
  hasPermission: (agentId: string, permission: Permission) => boolean;
  grantPermission: (agentId: string, permission: Permission) => void;
  revokePermission: (agentId: string, permission: Permission) => void;
  setTrusted: (agentId: string, trusted: boolean) => void;
  touchAgent: (agentId: string) => void;
  resetToDefaults: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAgentStore = create<AgentStore>()(
  persist(
    (set, get) => ({
      agents: DEFAULT_AGENTS,

      addAgent: (agent) =>
        set((state) => ({
          agents: [
            ...state.agents,
            { ...agent, createdAt: new Date().toISOString(), builtin: false },
          ],
        })),

      updateAgent: (id, patch) =>
        set((state) => ({
          agents: state.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),

      removeAgent: (id) =>
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== id || a.builtin),
        })),

      getAgent: (id) => get().agents.find((a) => a.id === id),

      hasPermission: (agentId, permission) => {
        const agent = get().agents.find((a) => a.id === agentId);
        return agent?.permissions.includes(permission) ?? false;
      },

      grantPermission: (agentId, permission) =>
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === agentId && !a.permissions.includes(permission)
              ? { ...a, permissions: [...a.permissions, permission] }
              : a,
          ),
        })),

      revokePermission: (agentId, permission) =>
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === agentId
              ? { ...a, permissions: a.permissions.filter((p) => p !== permission) }
              : a,
          ),
        })),

      setTrusted: (agentId, trusted) =>
        set((state) => ({
          agents: state.agents.map((a) => (a.id === agentId ? { ...a, trusted } : a)),
        })),

      touchAgent: (agentId) =>
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === agentId ? { ...a, lastSeenAt: new Date().toISOString() } : a,
          ),
        })),

      resetToDefaults: () => set({ agents: DEFAULT_AGENTS }),
    }),
    {
      name: 'nodadb-agents-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
