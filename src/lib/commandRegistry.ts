import type { DatabaseType } from '@/types';
import { invoke } from '@tauri-apps/api/core';

// ─── Permission System ────────────────────────────────────────────────────────

export type Permission =
  | 'READ'
  | 'WRITE'
  | 'SCHEMA'
  | 'MIGRATION'
  | 'ADMIN'
  | 'EXPLAIN'
  | 'EXPORT'
  | 'NETWORK';

// ─── Command Argument Descriptor ─────────────────────────────────────────────

export interface CommandArg {
  name: string;
  placeholder: string;
  description: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'sql';
}

// ─── Command Result ───────────────────────────────────────────────────────────

export interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

// ─── UI Actions ───────────────────────────────────────────────────────────────

export type UIAction =
  | { type: 'open-tab'; tab: 'query' | 'schema' | 'flow' | 'query-builder' }
  | { type: 'open-table'; tableName: string }
  | { type: 'open-connection-dialog' }
  | { type: 'open-settings' }
  | { type: 'open-agents' }
  | { type: 'open-history' };

// ─── NodaCommand ─────────────────────────────────────────────────────────────

export type CommandCategory =
  | 'Database'
  | 'Query'
  | 'Table'
  | 'Agent'
  | 'Schema'
  | 'Migration'
  | 'Settings';

export interface NodaCommand {
  id: string;
  /** Slash-command prefix, e.g. "/schema" */
  slash: string;
  label: string;
  description: string;
  category: CommandCategory;
  requiredPermission: Permission;
  requiresConnection: boolean;
  requiresConfirmation: boolean;
  args?: CommandArg[];
  action: (args?: Record<string, string>) => Promise<CommandResult> | CommandResult;
  uiAction?: UIAction;
  macShortcut?: string[];
  winShortcut?: string[];
}

// ─── Context injected by App.tsx ─────────────────────────────────────────────

export interface CommandRegistryContext {
  connectionId: string | null;
  dbType: DatabaseType | null;
  openQueryTab: () => void;
  openSchemaDesigner: () => void;
  openRelationFlow: () => void;
  openVisualQueryBuilder: () => void;
  openConnectionDialog: () => void;
  openSettings: () => void;
  openAgentsPanel: () => void;
  openHistory: () => void;
  openShortcutsDialog: () => void;
  runAgent?: (agentId: string, prompt?: string) => void;
}

// ─── Command Registry Factory ─────────────────────────────────────────────────

export function buildCommandRegistry(ctx: CommandRegistryContext): NodaCommand[] {
  const { connectionId, dbType } = ctx;

  const uiResult = (): CommandResult => ({ success: true });

  const requireConn = (): CommandResult | null => {
    if (!connectionId) {
      return { success: false, error: 'No active database connection. Use /connect first.' };
    }
    return null;
  };

  return [
    // ── DATABASE ─────────────────────────────────────────────────────────────
    {
      id: 'cmd-connect',
      slash: '/connect',
      label: 'Connect Database',
      description: 'Open the connection dialog to add or switch databases',
      category: 'Database',
      requiredPermission: 'NETWORK',
      requiresConnection: false,
      requiresConfirmation: false,
      args: [{ name: 'uri', placeholder: 'postgres://user:pass@host/db', description: 'Connection URI (optional)', required: false, type: 'string' }],
      action: () => { ctx.openConnectionDialog(); return uiResult(); },
      uiAction: { type: 'open-connection-dialog' },
    },
    {
      id: 'cmd-explore',
      slash: '/explore',
      label: 'Explore Tables',
      description: 'Open the data explorer to browse all tables',
      category: 'Database',
      requiredPermission: 'READ',
      requiresConnection: true,
      requiresConfirmation: false,
      action: () => { ctx.openQueryTab(); return uiResult(); },
      uiAction: { type: 'open-tab', tab: 'query' },
    },
    {
      id: 'cmd-status',
      slash: '/status',
      label: 'Connection Status',
      description: 'Show active connection details and database info',
      category: 'Database',
      requiredPermission: 'READ',
      requiresConnection: false,
      requiresConfirmation: false,
      action: async () => {
        if (!connectionId) return { success: false, error: 'No active connection.' };
        return { success: true, data: { connectionId, dbType } };
      },
    },
    // ── QUERY ────────────────────────────────────────────────────────────────
    {
      id: 'cmd-query',
      slash: '/query',
      label: 'New Query Tab',
      description: 'Open a new SQL query editor tab',
      category: 'Query',
      requiredPermission: 'READ',
      requiresConnection: true,
      requiresConfirmation: false,
      args: [{ name: 'sql', placeholder: 'SELECT * FROM users LIMIT 10', description: 'SQL to pre-fill', required: false, type: 'sql' }],
      action: () => { ctx.openQueryTab(); return uiResult(); },
      uiAction: { type: 'open-tab', tab: 'query' },
      macShortcut: ['⌘', 'N'],
      winShortcut: ['Ctrl', 'N'],
    },
    {
      id: 'cmd-explain',
      slash: '/explain',
      label: 'Explain Query',
      description: 'Show the execution plan for a SQL query',
      category: 'Query',
      requiredPermission: 'EXPLAIN',
      requiresConnection: true,
      requiresConfirmation: false,
      args: [{ name: 'sql', placeholder: 'SELECT * FROM orders WHERE ...', description: 'SQL query to explain', required: true, type: 'sql' }],
      action: async (args) => {
        const err = requireConn(); if (err) return err;
        if (!args?.sql) return { success: false, error: 'Usage: /explain <sql>' };
        try {
          const plan = await invoke('explain_query', { connectionId, query: args.sql, analyze: false, dbType: dbType?.toLowerCase() });
          return { success: true, data: plan };
        } catch (e) { return { success: false, error: String(e) }; }
      },
    },
    {
      id: 'cmd-history',
      slash: '/history',
      label: 'Query History',
      description: 'Browse previously executed queries',
      category: 'Query',
      requiredPermission: 'READ',
      requiresConnection: false,
      requiresConfirmation: false,
      action: () => { ctx.openHistory(); return uiResult(); },
      uiAction: { type: 'open-history' },
    },
    {
      id: 'cmd-query-builder',
      slash: '/builder',
      label: 'Visual Query Builder',
      description: 'Build SQL queries visually without writing code',
      category: 'Query',
      requiredPermission: 'READ',
      requiresConnection: true,
      requiresConfirmation: false,
      action: () => { ctx.openVisualQueryBuilder(); return uiResult(); },
      uiAction: { type: 'open-tab', tab: 'query-builder' },
    },
    // ── TABLE ────────────────────────────────────────────────────────────────
    {
      id: 'cmd-table',
      slash: '/table',
      label: 'Inspect Table',
      description: 'View columns, types, indexes, and constraints for a table',
      category: 'Table',
      requiredPermission: 'READ',
      requiresConnection: true,
      requiresConfirmation: false,
      args: [{ name: 'table_name', placeholder: 'users', description: 'Table name to inspect', required: true, type: 'string' }],
      action: async (args) => {
        const err = requireConn(); if (err) return err;
        if (!args?.table_name) return { success: false, error: 'Usage: /table <table_name>' };
        try {
          const [columns, indexes] = await Promise.all([
            invoke('get_table_structure', { connectionId, tableName: args.table_name, dbType: dbType?.toLowerCase() }),
            invoke('get_table_indexes', { connectionId, tableName: args.table_name, dbType: dbType?.toLowerCase() }),
          ]);
          return { success: true, data: { table: args.table_name, columns, indexes } };
        } catch (e) { return { success: false, error: String(e) }; }
      },
    },
    {
      id: 'cmd-indexes',
      slash: '/indexes',
      label: 'Table Indexes',
      description: 'Inspect and analyze indexes for a table',
      category: 'Table',
      requiredPermission: 'READ',
      requiresConnection: true,
      requiresConfirmation: false,
      args: [{ name: 'table_name', placeholder: 'orders', description: 'Table name', required: true, type: 'string' }],
      action: async (args) => {
        const err = requireConn(); if (err) return err;
        if (!args?.table_name) return { success: false, error: 'Usage: /indexes <table_name>' };
        try {
          const indexes = await invoke('get_table_indexes', { connectionId, tableName: args.table_name, dbType: dbType?.toLowerCase() });
          return { success: true, data: indexes };
        } catch (e) { return { success: false, error: String(e) }; }
      },
    },
    {
      id: 'cmd-search',
      slash: '/search',
      label: 'Search Database',
      description: 'Search across table names, columns, and metadata',
      category: 'Table',
      requiredPermission: 'READ',
      requiresConnection: true,
      requiresConfirmation: false,
      args: [{ name: 'term', placeholder: 'user_id', description: 'Search term', required: true, type: 'string' }],
      action: async (args) => {
        const err = requireConn(); if (err) return err;
        if (!args?.term) return { success: false, error: 'Usage: /search <term>' };
        try {
          const tables = await invoke<{ name: string }[]>('list_tables', { connectionId, dbType: dbType?.toLowerCase() });
          const matching = tables.filter(t => t.name.toLowerCase().includes(args.term!.toLowerCase()));
          return { success: true, data: { tables: matching, count: matching.length } };
        } catch (e) { return { success: false, error: String(e) }; }
      },
    },
    // ── SCHEMA ────────────────────────────────────────────────────────────────
    {
      id: 'cmd-schema',
      slash: '/schema',
      label: 'Schema Designer',
      description: 'Open the visual schema designer and ERD view',
      category: 'Schema',
      requiredPermission: 'SCHEMA',
      requiresConnection: true,
      requiresConfirmation: false,
      args: [{ name: 'table_name', placeholder: 'users', description: 'Jump to table in schema view (optional)', required: false, type: 'string' }],
      action: () => { ctx.openSchemaDesigner(); return uiResult(); },
      uiAction: { type: 'open-tab', tab: 'schema' },
      macShortcut: ['⌘', '⇧', 'E'],
      winShortcut: ['Ctrl', 'Shift', 'E'],
    },
    {
      id: 'cmd-flow',
      slash: '/flow',
      label: 'Relationship Flow',
      description: 'Visualize table relationships and trace foreign keys',
      category: 'Schema',
      requiredPermission: 'SCHEMA',
      requiresConnection: true,
      requiresConfirmation: false,
      action: () => { ctx.openRelationFlow(); return uiResult(); },
      uiAction: { type: 'open-tab', tab: 'flow' },
    },
    {
      id: 'cmd-context',
      slash: '/context',
      label: 'Database Context',
      description: 'Get structured database context (tables, schema) for AI agents',
      category: 'Schema',
      requiredPermission: 'READ',
      requiresConnection: true,
      requiresConfirmation: false,
      action: async () => {
        const err = requireConn(); if (err) return err;
        try {
          const tables = await invoke<{ name: string; row_count?: number; table_type?: string }[]>('list_tables', { connectionId, dbType: dbType?.toLowerCase() });
          return { success: true, data: { database_type: dbType, connection_id: connectionId, tables: tables.map(t => ({ name: t.name, rows: t.row_count, type: t.table_type })), table_count: tables.length } };
        } catch (e) { return { success: false, error: String(e) }; }
      },
    },
    // ── MIGRATION ─────────────────────────────────────────────────────────────
    {
      id: 'cmd-migrate',
      slash: '/migrate',
      label: 'Migration Manager',
      description: 'View applied migrations and manage database schema changes',
      category: 'Migration',
      requiredPermission: 'MIGRATION',
      requiresConnection: true,
      requiresConfirmation: false,
      action: async () => {
        const err = requireConn(); if (err) return err;
        try {
          const migrations = await invoke('list_applied_migrations', { connectionId, dbType: dbType?.toLowerCase() });
          return { success: true, data: migrations };
        } catch (e) { return { success: false, error: String(e) }; }
      },
    },
    // ── AGENT ─────────────────────────────────────────────────────────────────
    {
      id: 'cmd-agent',
      slash: '/agent',
      label: 'Run AI Agent',
      description: 'Execute Codex, Claude Code, OpenCode, or Gemini CLI with database context',
      category: 'Agent',
      requiredPermission: 'READ',
      requiresConnection: false,
      requiresConfirmation: false,
      args: [
        { name: 'agent_name', placeholder: 'codex | claude | opencode | gemini', description: 'Agent to execute', required: true, type: 'string' },
        { name: 'prompt', placeholder: 'Explain schema / Investigate query / Write migration...', description: 'Task for the agent', required: false, type: 'string' },
      ],
      action: (args) => {
        const agent = args?.agent_name ?? 'claude';
        const prompt = args?.prompt ?? 'Explain the database schema and suggest improvements';
        ctx.runAgent?.(agent, prompt);
        return uiResult();
      },
    },
    {
      id: 'cmd-acp',
      slash: '/acp',
      label: 'Agent Client Protocol (ACP) Session',
      description: 'Open interactive ACP session with Codex, Claude Code, OpenCode, or Gemini CLI',
      category: 'Agent',
      requiredPermission: 'READ',
      requiresConnection: false,
      requiresConfirmation: false,
      args: [
        { name: 'agent_name', placeholder: 'codex | claude | opencode | gemini', description: 'ACP Agent to connect', required: false, type: 'string' },
      ],
      action: () => {
        ctx.openAgentsPanel();
        return uiResult();
      },
      uiAction: { type: 'open-agents' },
    },
    {
      id: 'cmd-agents',
      slash: '/agents',
      label: 'Agent Control Center',
      description: 'ACP Agent Host, command timeline, live permissions governance',
      category: 'Agent',
      requiredPermission: 'ADMIN',
      requiresConnection: false,
      requiresConfirmation: false,
      action: () => { ctx.openAgentsPanel(); return uiResult(); },
      uiAction: { type: 'open-agents' },
    },
    {
      id: 'cmd-permissions',
      slash: '/permissions',
      label: 'Agent Permissions',
      description: 'View and control what AI agents are allowed to do',
      category: 'Agent',
      requiredPermission: 'ADMIN',
      requiresConnection: false,
      requiresConfirmation: false,
      action: () => { ctx.openAgentsPanel(); return uiResult(); },
      uiAction: { type: 'open-agents' },
    },
    // ── SETTINGS ──────────────────────────────────────────────────────────────
    {
      id: 'cmd-settings',
      slash: '/settings',
      label: 'Open Settings',
      description: 'Configure appearance, editor, and application preferences',
      category: 'Settings',
      requiredPermission: 'ADMIN',
      requiresConnection: false,
      requiresConfirmation: false,
      action: () => { ctx.openSettings(); return uiResult(); },
      uiAction: { type: 'open-settings' },
      macShortcut: ['⌘', ','],
      winShortcut: ['Ctrl', ','],
    },
    {
      id: 'cmd-shortcuts',
      slash: '/shortcuts',
      label: 'Keyboard Shortcuts',
      description: 'View all keyboard shortcuts for this platform',
      category: 'Settings',
      requiredPermission: 'ADMIN',
      requiresConnection: false,
      requiresConfirmation: false,
      action: () => { ctx.openShortcutsDialog(); return uiResult(); },
      macShortcut: ['⌘', '⇧', '?'],
      winShortcut: ['Ctrl', 'Shift', '?'],
    },
  ];
}

// ─── Parse Slash Query ────────────────────────────────────────────────────────

export function parseSlashQuery(
  query: string,
  commands: NodaCommand[],
): { command: NodaCommand | null; args: Record<string, string>; isSlashMode: boolean } {
  if (!query.startsWith('/')) return { command: null, args: {}, isSlashMode: false };
  const parts = query.trim().split(/\s+/);
  const slash = parts[0].toLowerCase();
  const positionalArgs = parts.slice(1);
  const command =
    commands.find(c => c.slash === slash) ??
    commands.find(c => c.slash.startsWith(slash)) ??
    null;
  if (!command) return { command: null, args: {}, isSlashMode: true };
  const args: Record<string, string> = {};
  if (command.args) {
    command.args.forEach((argDef, i) => {
      if (positionalArgs[i] !== undefined) args[argDef.name] = positionalArgs[i];
    });
    // Join remaining tokens into the last arg (for SQL)
    const lastArg = command.args[command.args.length - 1];
    if (lastArg && positionalArgs.length > command.args.length) {
      args[lastArg.name] = positionalArgs.join(' ');
    }
  }
  return { command, args, isSlashMode: true };
}
