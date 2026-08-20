import { useState, useEffect } from 'react';
import { Bot, Copy, Check, Plus, Trash2, Shield, ShieldCheck, ShieldX, Info, ChevronDown, ChevronUp, Play, Sparkles, Terminal, CheckCircle2, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAgentStore, ALL_PERMISSIONS, type AgentConfig } from '@/stores/agentStore';
import { copyMcpConfigToClipboard, getMcpSetupInstructions } from '@/lib/mcpConfigExport';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import type { Permission } from '@/lib/commandRegistry';

export interface InstalledAgentMeta {
  id: string;
  name: string;
  binary_name: string;
  installed: boolean;
  version?: string;
  path?: string;
  capabilities: string[];
  description: string;
}

interface AgentsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLaunchAgent?: (agentId: string, agentName: string, prompt: string) => void;
}

function PermissionBadge({ permission, granted }: { permission: Permission; granted: boolean }) {
  const def = ALL_PERMISSIONS.find((p) => p.value === permission);
  return (
    <Badge
      variant={granted ? 'default' : 'outline'}
      className={cn(
        'text-[10px] font-mono px-1.5 py-0',
        granted && def?.destructive && 'bg-amber-500/80 hover:bg-amber-500/80 border-amber-500',
        granted && !def?.destructive && 'bg-emerald-600/80 hover:bg-emerald-600/80 border-emerald-600',
        !granted && 'text-muted-foreground/40',
      )}
    >
      {permission}
    </Badge>
  );
}

function PromptDialog({
  open,
  onOpenChange,
  agentName,
  onExecute,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agentName: string;
  onExecute: (prompt: string) => void;
}) {
  const [prompt, setPrompt] = useState('');

  const templates = [
    'Explain the database schema and suggest optimizations',
    'Investigate missing indexes or performance bottlenecks',
    'Write a safe migration script to add an audit log table',
    'Find relationships and foreign key dependencies',
  ];

  const handleRun = () => {
    if (!prompt.trim()) return;
    onExecute(prompt.trim());
    setPrompt('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Run {agentName}
          </DialogTitle>
          <DialogDescription>
            NodaDB will supply your active database schema and context to {agentName}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">What should {agentName} do?</label>
            <textarea
              className="w-full h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Ask a question, request a query, or describe a migration..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5">Quick Starters</p>
            <div className="space-y-1">
              {templates.map((tpl) => (
                <button
                  key={tpl}
                  className="w-full text-left text-xs p-1.5 rounded border border-border/40 hover:bg-muted/60 transition-colors truncate block"
                  onClick={() => setPrompt(tpl)}
                >
                  {tpl}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={!prompt.trim()} onClick={handleRun}>
              <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
              Launch Session
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AgentCard({
  agent,
  detectedMeta,
  onLaunch,
}: {
  agent: AgentConfig;
  detectedMeta?: InstalledAgentMeta;
  onLaunch?: (agentId: string, agentName: string) => void;
}) {
  const { grantPermission, revokePermission, setTrusted, removeAgent } = useAgentStore();
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isInstalled = detectedMeta?.installed ?? false;
  const version = detectedMeta?.version;

  const handleCopyConfig = async () => {
    const result = await copyMcpConfigToClipboard(agent);
    if (result.success) {
      setCopied(true);
      toast.success('MCP config copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Failed to copy config');
    }
  };

  const togglePermission = (permission: Permission) => {
    if (agent.permissions.includes(permission)) {
      revokePermission(agent.id, permission);
    } else {
      grantPermission(agent.id, permission);
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{agent.name}</span>
            {isInstalled ? (
              <Badge className="text-[9px] px-1.5 py-0 bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="h-2.5 w-2.5" />
                CLI Installed {version ? `(${version})` : ''}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground flex items-center gap-1">
                <XCircle className="h-2.5 w-2.5 text-muted-foreground/60" />
                CLI Not in PATH
              </Badge>
            )}
            {agent.trusted && <Badge className="text-[9px] px-1 py-0 bg-blue-600/80 border-blue-600">trusted</Badge>}
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{agent.id}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isInstalled && onLaunch && (
            <Button
              size="sm"
              className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => onLaunch(agent.id, agent.name)}
            >
              <Play className="h-3 w-3 mr-1 fill-current" />
              Run Agent
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyConfig} title="Copy MCP config">
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          {!agent.builtin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => {
                removeAgent(agent.id);
                toast.success(`Agent "${agent.name}" removed`);
              }}
              title="Remove agent"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Capabilities / Description */}
      {detectedMeta?.capabilities && detectedMeta.capabilities.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {detectedMeta.capabilities.map((cap) => (
            <span key={cap} className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded">
              {cap}
            </span>
          ))}
        </div>
      )}

      {/* Permission Badges */}
      <div className="px-4 py-2 border-t border-border/50 bg-muted/20 flex flex-wrap gap-1">
        {agent.permissions.map((p) => (
          <PermissionBadge key={p} permission={p} granted={true} />
        ))}
        {ALL_PERMISSIONS.filter((p) => !agent.permissions.includes(p.value)).map((p) => (
          <PermissionBadge key={p.value} permission={p.value} granted={false} />
        ))}
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-border/50 bg-background/50">
          {agent.description && <p className="px-4 py-2.5 text-xs text-muted-foreground">{agent.description}</p>}

          {/* Path info */}
          {detectedMeta?.path && (
            <div className="px-4 py-1.5 text-xs text-muted-foreground font-mono flex items-center gap-1.5">
              <Terminal className="h-3 w-3" />
              <span>Binary: {detectedMeta.path}</span>
            </div>
          )}

          {/* Permission Toggles */}
          <div className="px-4 py-3 space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
              Permissions
            </p>
            {ALL_PERMISSIONS.map(({ value, label, description, destructive }) => {
              const granted = agent.permissions.includes(value);
              return (
                <div key={value} className="flex items-center gap-3">
                  <button
                    onClick={() => togglePermission(value)}
                    className={cn(
                      'flex items-center gap-1.5 min-w-[100px] text-xs font-mono font-medium transition-colors',
                      granted && destructive && 'text-amber-600 dark:text-amber-400',
                      granted && !destructive && 'text-emerald-600 dark:text-emerald-400',
                      !granted && 'text-muted-foreground',
                    )}
                    title={granted ? `Revoke ${value}` : `Grant ${value}`}
                  >
                    {granted ? <ShieldCheck className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}
                    {label}
                  </button>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              );
            })}
          </div>

          {/* Trusted toggle */}
          <div className="px-4 pb-3 flex items-center gap-3 border-t border-border/40 pt-3">
            <Shield className={cn('h-4 w-4', agent.trusted ? 'text-blue-500' : 'text-muted-foreground')} />
            <div className="flex-1">
              <p className="text-xs font-medium">Trusted Agent</p>
              <p className="text-[10px] text-muted-foreground">Bypass confirmation dialogs for WRITE operations</p>
            </div>
            <button
              onClick={() => setTrusted(agent.id, !agent.trusted)}
              className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                agent.trusted ? 'bg-blue-600' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                  agent.trusted ? 'translate-x-4' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>

          {/* Setup instructions */}
          <div className="px-4 pb-3 border-t border-border/40 pt-3">
            <button
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowInstructions((v) => !v)}
            >
              <Info className="h-3 w-3" />
              {showInstructions ? 'Hide' : 'Show'} MCP configuration instructions
            </button>
            {showInstructions && (
              <pre className="mt-2 text-[10px] font-mono bg-muted/50 rounded-md p-3 whitespace-pre-wrap text-muted-foreground overflow-x-auto">
                {getMcpSetupInstructions(agent)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentsPanel({ open, onOpenChange, onLaunchAgent }: AgentsPanelProps) {
  const agents = useAgentStore((s) => s.agents);
  const resetToDefaults = useAgentStore((s) => s.resetToDefaults);
  const [detectedAgents, setDetectedAgents] = useState<InstalledAgentMeta[]>([]);
  const [promptTarget, setPromptTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (open) {
      invoke<InstalledAgentMeta[]>('detect_installed_agents')
        .then((list) => setDetectedAgents(list))
        .catch(() => setDetectedAgents([]));
    }
  }, [open]);

  const handleLaunchClick = (agentId: string, agentName: string) => {
    setPromptTarget({ id: agentId, name: agentName });
  };

  const handlePromptSubmit = (prompt: string) => {
    if (!promptTarget) return;
    onOpenChange(false);
    onLaunchAgent?.(promptTarget.id, promptTarget.name, prompt);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Agent Control Hub
            </DialogTitle>
            <DialogDescription>
              Direct native CLI integration and permission governance for Codex, Claude Code, OpenCode, and Gemini.
            </DialogDescription>
          </DialogHeader>

          {/* Banner */}
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3.5 py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-foreground/90">
              <Terminal className="h-4 w-4 text-primary shrink-0" />
              <span>
                <strong>Direct CLI Bridge:</strong> NodaDB runs your locally installed agent CLIs directly and supplies database context automatically.
              </span>
            </div>
          </div>

          {/* Agent List */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3 py-2">
              {agents.map((agent) => {
                const detected = detectedAgents.find(
                  (d) => d.id === agent.id || d.binary_name === agent.id,
                );
                return (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    detectedMeta={detected}
                    onLaunch={handleLaunchClick}
                  />
                );
              })}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="flex items-center justify-between border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => {
                resetToDefaults();
                toast.success('Reset to default agent configurations');
              }}
            >
              Reset to defaults
            </Button>
            <span className="text-[11px] text-muted-foreground">
              CLI executable: <code className="font-mono bg-muted px-1 py-0.5 rounded">noda agent run &lt;agent&gt; &quot;...&quot;</code>
            </span>
          </div>
        </DialogContent>
      </Dialog>

      <PromptDialog
        open={promptTarget !== null}
        onOpenChange={(v) => !v && setPromptTarget(null)}
        agentName={promptTarget?.name ?? ''}
        onExecute={handlePromptSubmit}
      />
    </>
  );
}
