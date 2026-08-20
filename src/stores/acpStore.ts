import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AcpAgentStatus {
  agent_id: string;
  name: string;
  status: 'connected' | 'idle' | 'error' | 'disconnected';
  version?: string;
  protocol_version: string;
  session_id?: string;
}

export interface AcpMessage {
  id: string;
  role: 'user' | 'agent' | 'thought' | 'tool_call' | 'system';
  content: string;
  timestamp: string;
  toolCall?: {
    callId: string;
    command: string;
    arguments: Record<string, unknown>;
    status: 'pending' | 'approved' | 'rejected' | 'executed';
    result?: unknown;
  };
}

export interface AcpSession {
  id: string;
  agentId: string;
  agentName: string;
  createdAt: string;
  messages: AcpMessage[];
  status: 'idle' | 'running' | 'completed' | 'failed';
  activeThought?: string;
}

export interface AcpRecentCommand {
  id: string;
  timestamp: string;
  agent_id: string;
  command: string;
  arguments: Record<string, unknown>;
  status: string;
  duration_ms: number;
  ui_action_triggered?: string;
}

export interface AcpToolApproval {
  call_id: string;
  session_id: string;
  agent_id: string;
  command: string;
  arguments: Record<string, unknown>;
  reason: string;
  destructive: boolean;
  timestamp: string;
}

interface AcpStore {
  sessions: AcpSession[];
  activeSessionId: string | null;
  connectedAgents: Record<string, AcpAgentStatus>;
  recentCommands: AcpRecentCommand[];
  pendingApprovals: AcpToolApproval[];

  // Session actions
  createSession: (agentId: string, agentName: string) => string;
  setActiveSession: (sessionId: string) => void;
  addMessage: (sessionId: string, message: Omit<AcpMessage, 'id' | 'timestamp'>) => void;
  appendMessageChunk: (sessionId: string, chunkText: string) => void;
  setActiveThought: (sessionId: string, thought: string | undefined) => void;
  setSessionStatus: (sessionId: string, status: AcpSession['status']) => void;

  // Agent status actions
  setAgentStatus: (status: AcpAgentStatus) => void;

  // Command audit & approvals
  addRecentCommand: (cmd: AcpRecentCommand) => void;
  addPendingApproval: (approval: AcpToolApproval) => void;
  resolvePendingApproval: (callId: string) => void;
  clearHistory: () => void;
}

export const useAcpStore = create<AcpStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      connectedAgents: {
        codex: {
          agent_id: 'codex',
          name: 'Codex CLI',
          status: 'idle',
          protocol_version: '2025-08-01 (ACP v1)',
        },
        claude: {
          agent_id: 'claude',
          name: 'Claude Code',
          status: 'idle',
          protocol_version: '2025-08-01 (ACP v1)',
        },
        opencode: {
          agent_id: 'opencode',
          name: 'OpenCode',
          status: 'idle',
          protocol_version: '2025-08-01 (ACP v1)',
        },
        gemini: {
          agent_id: 'gemini',
          name: 'Gemini CLI',
          status: 'idle',
          protocol_version: '2025-08-01 (ACP v1)',
        },
      },
      recentCommands: [
        {
          id: 'seed-1',
          timestamp: '09:21:04',
          agent_id: 'codex',
          command: '/schema',
          arguments: { table_name: 'users' },
          status: 'executed',
          duration_ms: 24,
          ui_action_triggered: 'open_schema_designer',
        },
        {
          id: 'seed-2',
          timestamp: '09:18:32',
          agent_id: 'claude',
          command: '/flow',
          arguments: { value: 'customer:4821' },
          status: 'executed',
          duration_ms: 58,
          ui_action_triggered: 'open_relation_flow',
        },
        {
          id: 'seed-3',
          timestamp: '09:15:10',
          agent_id: 'opencode',
          command: '/explain',
          arguments: { sql: 'SELECT * FROM orders WHERE status = "pending"' },
          status: 'executed',
          duration_ms: 12,
        },
      ],
      pendingApprovals: [],

      createSession: (agentId, agentName) => {
        const id = `acp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newSession: AcpSession = {
          id,
          agentId,
          agentName,
          createdAt: new Date().toLocaleTimeString(),
          messages: [
            {
              id: `sys-${Date.now()}`,
              role: 'system',
              content: `ACP Session initialized with ${agentName}. NodaDB command capabilities (/schema, /flow, /explain, /query) are active.`,
              timestamp: new Date().toLocaleTimeString(),
            },
          ],
          status: 'idle',
        };

        set((state) => ({
          sessions: [newSession, ...state.sessions],
          activeSessionId: id,
        }));
        return id;
      },

      setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

      addMessage: (sessionId, message) => {
        const fullMessage: AcpMessage = {
          ...message,
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toLocaleTimeString(),
        };

        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, fullMessage] }
              : s,
          ),
        }));
      },

      appendMessageChunk: (sessionId, chunkText) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            const msgs = [...s.messages];
            const last = msgs[msgs.length - 1];

            if (last && last.role === 'agent') {
              msgs[msgs.length - 1] = {
                ...last,
                content: last.content + chunkText,
              };
            } else {
              msgs.push({
                id: `chunk-${Date.now()}`,
                role: 'agent',
                content: chunkText,
                timestamp: new Date().toLocaleTimeString(),
              });
            }
            return { ...s, messages: msgs };
          }),
        }));
      },

      setActiveThought: (sessionId, thought) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, activeThought: thought } : s,
          ),
        }));
      },

      setSessionStatus: (sessionId, status) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, status } : s,
          ),
        }));
      },

      setAgentStatus: (status) => {
        set((state) => ({
          connectedAgents: {
            ...state.connectedAgents,
            [status.agent_id]: status,
          },
        }));
      },

      addRecentCommand: (cmd) => {
        set((state) => ({
          recentCommands: [cmd, ...state.recentCommands].slice(0, 100),
        }));
      },

      addPendingApproval: (approval) => {
        set((state) => ({
          pendingApprovals: [approval, ...state.pendingApprovals],
        }));
      },

      resolvePendingApproval: (callId) => {
        set((state) => ({
          pendingApprovals: state.pendingApprovals.filter(
            (p) => p.call_id !== callId,
          ),
        }));
      },

      clearHistory: () => set({ recentCommands: [], sessions: [] }),
    }),
    {
      name: 'nodadb-acp-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        recentCommands: state.recentCommands,
      }),
    },
  ),
);
