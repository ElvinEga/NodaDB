import type { AgentConfig } from '@/stores/agentStore';

// ─── MCP Config Export ────────────────────────────────────────────────────────
// Generates the JSON snippet users paste into their AI agent config files.

export interface McpServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface ClaudeDesktopConfig {
  mcpServers: Record<string, McpServerConfig>;
}

/**
 * Detect the platform-specific path where `nodadb-mcp` binary is installed.
 * In production this comes from the Tauri app bundle; in dev it's from cargo.
 */
function getMcpBinaryPath(): string {
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  const isWindows = /Win/.test(navigator.userAgent);

  if (isMac) return '/Applications/NodaDB.app/Contents/MacOS/nodadb-mcp';
  if (isWindows) return 'C:\\Program Files\\NodaDB\\nodadb-mcp.exe';
  return '/usr/local/bin/nodadb-mcp';
}

/**
 * Build a Claude Desktop / Claude Code MCP config snippet for a given agent.
 */
export function buildClaudeDesktopConfig(
  agent: AgentConfig,
  connectionUrl?: string,
): ClaudeDesktopConfig {
  const env: Record<string, string> = {
    NODADB_AGENT_ID: agent.id,
  };
  if (connectionUrl) {
    env.DATABASE_URL = connectionUrl;
  }

  return {
    mcpServers: {
      nodadb: {
        command: getMcpBinaryPath(),
        args: ['--agent-id', agent.id],
        env,
      },
    },
  };
}

/**
 * Build a generic JSON config string suitable for any MCP-compatible agent.
 * Includes: binary path, args, env vars, granted permissions.
 */
export function buildMcpConfigJson(agent: AgentConfig, connectionUrl?: string): string {
  const config = buildClaudeDesktopConfig(agent, connectionUrl);
  return JSON.stringify(config, null, 2);
}

/**
 * Generate an agents.json file content for the nodadb-mcp server to read
 * from ~/.config/nodadb/agents.json.
 */
export function buildAgentsJsonContent(agents: AgentConfig[]): string {
  const exportable = agents.map(({ id, name, permissions, trusted }) => ({
    id,
    name,
    permissions,
    trusted,
  }));
  return JSON.stringify(exportable, null, 2);
}

/**
 * Copy config to clipboard and return success/error.
 */
export async function copyMcpConfigToClipboard(
  agent: AgentConfig,
  connectionUrl?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const json = buildMcpConfigJson(agent, connectionUrl);
    await navigator.clipboard.writeText(json);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Generate setup instructions for a given agent.
 */
export function getMcpSetupInstructions(agent: AgentConfig): string {
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  const binaryPath = getMcpBinaryPath();
  const configPath = isMac
    ? '~/Library/Application Support/Claude/claude_desktop_config.json'
    : isMac ? '~/.config/Claude/claude_desktop_config.json' : '%APPDATA%\\Claude\\claude_desktop_config.json';

  return `# NodaDB MCP Setup for ${agent.name}

## 1. Add to your agent config

File: ${configPath}

{
  "mcpServers": {
    "nodadb": {
      "command": "${binaryPath}",
      "args": ["--agent-id", "${agent.id}"],
      "env": {
        "NODADB_AGENT_ID": "${agent.id}",
        "DATABASE_URL": "<your-database-url>"
      }
    }
  }
}

## 2. Granted Permissions

${agent.permissions.map(p => `  ✓ ${p}`).join('\n')}

## 3. Available Tools

${getToolListForPermissions(agent.permissions)}

## 4. Restart your agent after saving the config.
`;
}

function getToolListForPermissions(permissions: string[]): string {
  const tools: string[] = [];
  if (permissions.includes('READ')) {
    tools.push('  • explore    — List all tables');
    tools.push('  • schema     — Get table structure (columns, types, PKs)');
    tools.push('  • indexes    — List table indexes');
    tools.push('  • context    — Full database context for reasoning');
    tools.push('  • status     — Agent info and connection status');
  }
  if (permissions.includes('EXPLAIN')) {
    tools.push('  • explain    — Query execution plan');
  }
  if (permissions.includes('WRITE')) {
    tools.push('  • query      — Execute any SQL (SELECT + DML with confirmation)');
    tools.push('  • insert     — Insert a row');
    tools.push('  • update     — Update rows (requires confirmation)');
    tools.push('  • delete     — Delete rows (requires confirmation)');
  } else if (permissions.includes('READ')) {
    tools.push('  • query      — Execute SELECT queries');
  }
  return tools.join('\n') || '  (no tools available)';
}
