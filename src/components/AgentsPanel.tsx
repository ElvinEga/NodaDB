import { useState } from 'react';
import { Bot, Copy, Check, Plus, Trash2, Shield, ShieldCheck, ShieldX, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAgentStore, ALL_PERMISSIONS, type AgentConfig } from '@/stores/agentStore';
import { copyMcpConfigToClipboard, getMcpSetupInstructions } from '@/lib/mcpConfigExport';
import { toast } from 'sonner';
import type { Permission } from '@/lib/commandRegistry';

interface AgentsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PermissionBadge({ permission, granted }: { permission: Permission; granted: boolean }) {
  const def = ALL_PERMISSIONS.find(p => p.value === permission);
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

function AddAgentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const addAgent = useAgentStore(s => s.addAgent);

  const handleAdd = () => {
    if (!id.trim() || !name.trim()) return;
    addAgent({
      id: id.trim().toLowerCase().replace(/\s+/g, '-'),
      name: name.trim(),
      permissions: ['READ', 'EXPLAIN'],
      trusted: false,
    });
    setId('');
    setName('');
    onOpenChange(false);
    toast.success(`Agent "${name.trim()}" added`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Custom Agent</DialogTitle>
          <DialogDescription>Start with READ + EXPLAIN permissions. Adjust as needed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Agent ID</label>
            <Input placeholder="my-agent" value={id} onChange={e => setId(e.target.value)} className="font-mono text-sm" />
            <p className="text-[10px] text-muted-foreground mt-1">Used in NODADB_AGENT_ID env var. Lowercase, no spaces.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Display Name</label>
            <Input placeholder="My Custom Agent" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1" disabled={!id.trim() || !name.trim()} onClick={handleAdd}>Add Agent</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AgentCard({ agent }: { agent: AgentConfig }) {
  const { grantPermission, revokePermission, setTrusted, removeAgent } = useAgentStore();
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card">
        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{agent.name}</span>
            {agent.builtin && <Badge variant="outline" className="text-[9px] px-1 py-0">preset</Badge>}
            {agent.trusted && (
              <Badge className="text-[9px] px-1 py-0 bg-blue-600/80 border-blue-600">trusted</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono">{agent.id}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopyConfig} title="Copy MCP config">
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          {!agent.builtin && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { removeAgent(agent.id); toast.success(`Agent "${agent.name}" removed`); }} title="Remove agent">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(v => !v)}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Permission Badges (always visible) */}
      <div className="px-4 py-2 border-t border-border/50 bg-muted/20 flex flex-wrap gap-1">
        {agent.permissions.map(p => <PermissionBadge key={p} permission={p} granted={true} />)}
        {ALL_PERMISSIONS.filter(p => !agent.permissions.includes(p.value)).map(p => (
          <PermissionBadge key={p.value} permission={p.value} granted={false} />
        ))}
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-border/50">
          {/* Description */}
          {agent.description && (
            <p className="px-4 py-2 text-xs text-muted-foreground">{agent.description}</p>
          )}

          {/* Permission Toggles */}
          <div className="px-4 py-3 space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">Permissions</p>
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
              <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform', agent.trusted ? 'translate-x-4' : 'translate-x-0.5')} />
            </button>
          </div>

          {/* Setup instructions */}
          <div className="px-4 pb-3 border-t border-border/40 pt-3">
            <button
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowInstructions(v => !v)}
            >
              <Info className="h-3 w-3" />
              {showInstructions ? 'Hide' : 'Show'} setup instructions
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

export function AgentsPanel({ open, onOpenChange }: AgentsPanelProps) {
  const agents = useAgentStore(s => s.agents);
  const resetToDefaults = useAgentStore(s => s.resetToDefaults);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Agent Control
            </DialogTitle>
            <DialogDescription>
              Configure which AI agents can access your databases and what operations they can perform.
            </DialogDescription>
          </DialogHeader>

          {/* Info banner */}
          <div className="rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2.5">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              <strong>MCP Integration:</strong> Each agent uses the <code className="font-mono">nodadb-mcp</code> binary over stdio.
              Click the copy icon on any agent to get the config snippet for Claude Desktop / Claude Code / Codex / OpenCode.
            </p>
          </div>

          {/* Agent list */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3 py-2">
              {agents.map(agent => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="flex items-center justify-between border-t pt-3">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { resetToDefaults(); toast.success('Reset to default agents'); }}>
              Reset to defaults
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Agent
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddAgentDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
