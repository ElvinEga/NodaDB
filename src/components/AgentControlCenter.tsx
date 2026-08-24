import { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Shield,
  ShieldCheck,
  ShieldX,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Terminal,
  Activity,
  ChevronDown,
  ChevronUp,
  Plus,
  Layers,
  Database,
  ExternalLink,
  Brain,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAcpStore, type AcpSession, type AcpMessage } from '@/stores/acpStore';
import { useAgentStore, ALL_PERMISSIONS } from '@/stores/agentStore';
import { AiIcon } from '@/components/AiIcon';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import type { DatabaseType } from '@/types';

interface AgentControlCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId?: string | null;
  dbType?: DatabaseType | null;
  onExecuteCommandAction?: (action: string, params: Record<string, unknown>) => void;
}

export function AgentControlCenter({
  open,
  onOpenChange,
  connectionId,
  dbType,
  onExecuteCommandAction,
}: AgentControlCenterProps) {
  const {
    sessions,
    activeSessionId,
    connectedAgents,
    recentCommands,
    pendingApprovals,
    createSession,
    setActiveSession,
    addMessage,
    appendMessageChunk,
    setSessionStatus,
    setAgentStatus,
    addRecentCommand,
    addPendingApproval,
    resolvePendingApproval,
  } = useAcpStore();

  const { agents, grantPermission, revokePermission } = useAgentStore();

  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<'codex' | 'claude' | 'opencode' | 'gemini'>('codex');
  const [activeTab, setActiveTab] = useState<'chat' | 'permissions' | 'audit'>('chat');
  const [thoughtExpanded, setThoughtExpanded] = useState<Record<string, boolean>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0];

  // Auto-scroll chat stream
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, activeSession?.status]);

  // Listen to Tauri ACP events
  useEffect(() => {
    if (!open) return;

    // Fetch live connected agents
    invoke<{ agent_id: string; name: string; status: string; protocol_version: string }[]>('get_acp_connected_agents')
      .then((list) => {
        list.forEach((item) => {
          setAgentStatus({
            agent_id: item.agent_id,
            name: item.name,
            status: item.status as 'connected' | 'idle' | 'error' | 'disconnected',
            protocol_version: item.protocol_version,
          });
        });
      })
      .catch(() => {});

    // Listen to session updates
    const unlistenUpdate = listen<{
      session_id: string;
      agent_id: string;
      chunk: { type: string; text?: string; step?: string; tool?: string; arguments?: Record<string, unknown>; call_id?: string; requires_approval?: boolean };
      timestamp: string;
    }>('acp://session_update', (event) => {
      const { session_id, chunk } = event.payload;

      if (chunk.type === 'message_chunk' && chunk.text) {
        appendMessageChunk(session_id, chunk.text);
      } else if (chunk.type === 'thought' && chunk.text) {
        addMessage(session_id, {
          role: 'thought',
          content: chunk.text,
        });
      } else if (chunk.type === 'tool_call' && chunk.tool) {
        addMessage(session_id, {
          role: 'tool_call',
          content: `Invoking command ${chunk.tool}`,
          toolCall: {
            callId: chunk.call_id ?? `call-${Date.now()}`,
            command: chunk.tool,
            arguments: chunk.arguments ?? {},
            status: chunk.requires_approval ? 'pending' : 'executed',
          },
        });
        if (chunk.requires_approval && chunk.call_id) {
          addPendingApproval({
            call_id: chunk.call_id,
            session_id,
            agent_id: event.payload.agent_id,
            command: chunk.tool,
            arguments: chunk.arguments ?? {},
            reason: 'Requires user confirmation for destructive execution',
            destructive: true,
            timestamp: new Date().toLocaleTimeString(),
          });
        }
      } else if (chunk.type === 'completed') {
        setSessionStatus(session_id, 'completed');
      }
    });

    // Listen to recent command executions
    const unlistenCommand = listen<{
      id: string;
      timestamp: string;
      agent_id: string;
      command: string;
      arguments: Record<string, unknown>;
      status: string;
      duration_ms: number;
      ui_action_triggered?: string;
    }>('acp://command_executed', (event) => {
      addRecentCommand(event.payload);
      if (event.payload.ui_action_triggered && onExecuteCommandAction) {
        onExecuteCommandAction(event.payload.ui_action_triggered, event.payload.arguments);
      }
    });

    return () => {
      unlistenUpdate.then((f) => f());
      unlistenCommand.then((f) => f());
    };
  }, [open, setAgentStatus, appendMessageChunk, addMessage, setSessionStatus, addPendingApproval, addRecentCommand, onExecuteCommandAction]);

  // Send turn prompt
  const handleSend = async () => {
    if (!inputPrompt.trim()) return;

    let targetSessionId = activeSession?.id;
    if (!targetSessionId) {
      const names = {
        codex: 'Codex CLI',
        claude: 'Claude Code',
        opencode: 'OpenCode',
        gemini: 'Gemini CLI',
      };
      targetSessionId = createSession(selectedAgent, names[selectedAgent]);
    }

    const userText = inputPrompt.trim();
    setInputPrompt('');

    addMessage(targetSessionId, {
      role: 'user',
      content: userText,
    });
    setSessionStatus(targetSessionId, 'running');

    try {
      await invoke('send_acp_prompt', {
        sessionId: targetSessionId,
        prompt: userText,
        context: {
          connection_id: connectionId,
          db_type: dbType,
        },
      });
    } catch (e) {
      toast.error(`ACP Prompt failed: ${e}`);
      setSessionStatus(targetSessionId, 'failed');
    }
  };

  const handleStartNewSession = async (agentKey: 'codex' | 'claude' | 'opencode' | 'gemini') => {
    const names = {
      codex: 'Codex CLI',
      claude: 'Claude Code',
      opencode: 'OpenCode',
      gemini: 'Gemini CLI',
    };
    const sid = createSession(agentKey, names[agentKey]);
    setSelectedAgent(agentKey);

    try {
      await invoke('start_acp_session', {
        agentId: agentKey,
        sessionId: sid,
      });
      toast.success(`ACP Session connected with ${names[agentKey]}`);
    } catch (err) {
      toast.error(`Failed to connect ACP agent: ${err}`);
    }
  };

  const handleApproveTool = async (callId: string, approved: boolean) => {
    try {
      await invoke('approve_acp_tool', { callId, approved });
      resolvePendingApproval(callId);
      toast.success(approved ? 'Action approved and executed' : 'Action rejected');
    } catch (e) {
      toast.error(`Failed approval: ${e}`);
    }
  };

  const togglePermission = (agentId: string, perm: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;
    if (agent.permissions.includes(perm as any)) {
      revokePermission(agentId, perm as any);
    } else {
      grantPermission(agentId, perm as any);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[88vh] flex flex-col p-0 overflow-hidden bg-background">
        {/* Top Control Bar */}
        <DialogHeader className="px-5 py-3.5 border-b border-border/60 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold">
                  Agent Control Center
                </DialogTitle>
                <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-primary/30 text-primary">
                  ACP Host Mode
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Standardized Agent Client Protocol bridge for database exploration, schema design, and flow analysis.
              </DialogDescription>
            </div>
          </div>

          {/* Connected Agent Status Pills */}
          <div className="flex items-center gap-2">
            {(['codex', 'claude', 'opencode', 'gemini'] as const).map((agentKey) => {
              const status = connectedAgents[agentKey]?.status ?? 'idle';
              const names = { codex: 'Codex', claude: 'Claude', opencode: 'OpenCode', gemini: 'Gemini' };
              return (
                <button
                  key={agentKey}
                  onClick={() => handleStartNewSession(agentKey)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors',
                    selectedAgent === agentKey
                      ? 'bg-primary/10 border-primary/40 text-primary'
                      : 'border-border/60 hover:bg-muted/50 text-muted-foreground',
                  )}
                  title={`Start session with ${names[agentKey]}`}
                >
                  <AiIcon name={agentKey} className="h-3.5 w-3.5 shrink-0" />
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40',
                    )}
                  />
                  {names[agentKey]}
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* Workspace Body Grid */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden">
          {/* Left Session Column (2 cols) */}
          <div className="col-span-3 border-r border-border/60 bg-muted/10 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-border/40 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sessions</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => handleStartNewSession(selectedAgent)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                New
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {sessions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No active sessions.<br />Click New to launch.
                  </div>
                ) : (
                  sessions.map((sess) => {
                    const isSelected = sess.id === (activeSession?.id ?? '');
                    return (
                      <button
                        key={sess.id}
                        onClick={() => setActiveSession(sess.id)}
                        className={cn(
                          'w-full text-left p-2.5 rounded-md border transition-all text-xs block',
                          isSelected
                            ? 'bg-primary/10 border-primary/30 text-foreground'
                            : 'border-border/40 hover:bg-muted/40 text-muted-foreground',
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <AiIcon name={sess.agentId} className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-semibold truncate">{sess.agentName}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground/70 shrink-0">{sess.createdAt}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          {sess.messages[sess.messages.length - 1]?.content ?? 'Empty session'}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            {/* Active Database Context Footer */}
            <div className="p-3 border-t border-border/40 bg-muted/20 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Database className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">Active Database:</span>
              </div>
              <p className="font-mono text-[11px] text-foreground font-semibold truncate">
                {connectionId ?? 'No database selected'}
              </p>
            </div>
          </div>

          {/* Main Interaction Pane (6 cols) */}
          <div className="col-span-6 flex flex-col overflow-hidden border-r border-border/60">
            {/* Conversation Stream */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3.5">
                {activeSession?.messages.map((msg) => {
                  if (msg.role === 'thought') {
                    const isExp = thoughtExpanded[msg.id] ?? false;
                    return (
                      <div key={msg.id} className="rounded-md border border-purple-500/30 bg-purple-500/5 p-2.5 text-xs">
                        <button
                          onClick={() => setThoughtExpanded((prev) => ({ ...prev, [msg.id]: !isExp }))}
                          className="flex items-center justify-between w-full text-purple-600 dark:text-purple-400 font-semibold"
                        >
                          <div className="flex items-center gap-1.5">
                            <Brain className="h-3.5 w-3.5" />
                            <span>Agent Thought Process</span>
                          </div>
                          {isExp ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                        {isExp && (
                          <p className="mt-2 text-muted-foreground font-mono text-[11px] whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        )}
                      </div>
                    );
                  }

                  if (msg.role === 'tool_call' && msg.toolCall) {
                    return (
                      <div key={msg.id} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                            <Terminal className="h-3.5 w-3.5" />
                            <span>NodaDB Command Request: {msg.toolCall.command}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {msg.toolCall.status}
                          </Badge>
                        </div>
                        <pre className="text-[10px] font-mono bg-black/40 text-gray-200 p-2 rounded overflow-x-auto mb-2">
                          {JSON.stringify(msg.toolCall.arguments, null, 2)}
                        </pre>
                        {msg.toolCall.status === 'pending' && (
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleApproveTool(msg.toolCall!.callId, false)}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                              onClick={() => handleApproveTool(msg.toolCall!.callId, true)}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Approve & Execute
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex gap-2.5 max-w-[88%]',
                        msg.role === 'user' ? 'ml-auto flex-row-reverse' : '',
                      )}
                    >
                      <div
                        className={cn(
                          'h-7 w-7 rounded-md flex items-center justify-center shrink-0 text-xs',
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'bg-muted/80 text-muted-foreground p-1 border border-border/50',
                        )}
                      >
                        {msg.role === 'user' ? 'U' : <AiIcon name={activeSession?.agentId ?? selectedAgent} className="h-4 w-4 shrink-0" />}
                      </div>
                      <div
                        className={cn(
                          'rounded-lg px-3.5 py-2.5 text-xs leading-relaxed',
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'bg-muted/60 text-foreground border border-border/40 whitespace-pre-wrap',
                        )}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Prompt Input Bar */}
            <div className="p-3 border-t border-border/60 bg-card">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  placeholder={`Ask ${activeSession?.agentName ?? 'agent'} to inspect schema, trace relations, or explain queries...`}
                  className="text-xs h-9"
                />
                <Button type="submit" size="sm" className="h-9 px-3 shrink-0" disabled={!inputPrompt.trim()}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </div>

          {/* Right Governance & Timeline Column (3 cols) */}
          <div className="col-span-3 bg-muted/5 flex flex-col overflow-hidden">
            {/* Tab switch */}
            <div className="flex border-b border-border/40 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('chat')}
                className={cn(
                  'flex-1 py-2.5 text-center border-b-2 transition-colors',
                  activeTab === 'chat' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                Timeline
              </button>
              <button
                onClick={() => setActiveTab('permissions')}
                className={cn(
                  'flex-1 py-2.5 text-center border-b-2 transition-colors',
                  activeTab === 'permissions' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                Permissions
              </button>
            </div>

            {/* Tab Content */}
            <ScrollArea className="flex-1 p-3">
              {activeTab === 'chat' ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Recent Agent Commands
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/60">{recentCommands.length} events</span>
                  </div>

                  {recentCommands.map((cmd) => (
                    <div key={cmd.id} className="p-2 rounded border border-border/40 bg-card text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-primary font-semibold">{cmd.command}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {cmd.timestamp}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground truncate">
                        {JSON.stringify(cmd.arguments)}
                      </div>
                      <div className="flex items-center justify-between pt-0.5 text-[10px]">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                          {cmd.duration_ms}ms
                        </Badge>
                        <span className="text-muted-foreground font-mono flex items-center gap-1">
                          <AiIcon name={cmd.agent_id} className="h-3 w-3 shrink-0" />
                          {cmd.agent_id}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>Active Agent Governance</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Granular permission matrix enforced on ACP command invocations.
                  </p>

                  <div className="space-y-2 pt-1">
                    {ALL_PERMISSIONS.map(({ value, label, description, destructive }) => {
                      const granted = agents.find((a) => a.id === selectedAgent)?.permissions.includes(value) ?? true;
                      return (
                        <div key={value} className="flex items-start justify-between p-2 rounded border border-border/40 bg-card">
                          <div>
                            <span className="text-xs font-semibold font-mono block mb-0.5">{label}</span>
                            <span className="text-[10px] text-muted-foreground leading-tight block">{description}</span>
                          </div>
                          <button
                            onClick={() => togglePermission(selectedAgent, value)}
                            className={cn(
                              'p-1 rounded transition-colors',
                              granted ? (destructive ? 'text-amber-500' : 'text-emerald-500') : 'text-muted-foreground/40',
                            )}
                            title={granted ? `Revoke ${value}` : `Grant ${value}`}
                          >
                            {granted ? <ShieldCheck className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
