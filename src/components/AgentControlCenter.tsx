import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Database, Sparkles, Terminal, Play, Loader2, Check, AlertTriangle, Settings2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAcpStore } from '@/stores/acpStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import type { DatabaseType } from '@/types';

interface AgentControlCenterProps { open: boolean; onOpenChange: (open: boolean) => void; connectionId?: string | null; dbType?: DatabaseType | null; onExecuteCommandAction?: (action: string, params: Record<string, unknown>) => void; }

type AgentKey = 'codex' | 'claude' | 'opencode' | 'gemini';
const AGENTS: Record<AgentKey, string> = { codex: 'Codex CLI', claude: 'Claude Code', opencode: 'OpenCode', gemini: 'Gemini CLI' };
const STARTERS = [
  { label: 'Explain schema', prompt: 'Explain the current database schema, key relationships, and any design concerns.' },
  { label: 'Write SQL', prompt: 'Write the SQL query I need for the task I describe. Return production-ready SQL and explain it briefly.' },
  { label: 'Optimize query', prompt: 'Review the current SQL and database context. Identify bottlenecks and propose an optimized query and indexes.' },
  { label: 'Find relationships', prompt: 'Trace the important foreign-key relationships in the current schema and explain how the main entities connect.' },
];

export function AgentControlCenter({ open, onOpenChange, connectionId, dbType, onExecuteCommandAction }: AgentControlCenterProps) {
  const { sessions, activeSessionId, connectedAgents, createSession, setActiveSession, addMessage, appendMessageChunk, setSessionStatus, setAgentStatus, addRecentCommand } = useAcpStore();
  const { aiEnabled, aiProvider, aiAutoIncludeSchema, aiAutoIncludeQuery, aiConfirmGeneratedSql } = useSettingsStore();
  const [input, setInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AgentKey>(aiProvider);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const activeSession = sessions.find(s => s.id === activeSessionId) ?? sessions[0];

  useEffect(() => setSelectedAgent(aiProvider), [aiProvider]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeSession?.messages]);

  useEffect(() => {
    if (!open) return;
    invoke<{ agent_id: string; name: string; status: string; protocol_version: string }[]>('get_acp_connected_agents').then(list => list.forEach(a => setAgentStatus({ agent_id: a.agent_id, name: a.name, status: a.status as 'connected' | 'idle' | 'error' | 'disconnected', protocol_version: a.protocol_version }))).catch(() => {});
    const updates = listen<{ session_id: string; agent_id: string; chunk: { type: string; text?: string; tool?: string; arguments?: Record<string, unknown> } }>('acp://session_update', e => {
      const c = e.payload.chunk;
      if (c.type === 'message_chunk' && c.text) appendMessageChunk(e.payload.session_id, c.text);
      else if (c.type === 'tool_call' && c.tool) addMessage(e.payload.session_id, { role: 'tool_call', content: `Command: ${c.tool}`, toolCall: { callId: `${Date.now()}`, command: c.tool, arguments: c.arguments ?? {}, status: 'executed' } });
      else if (c.type === 'completed') setSessionStatus(e.payload.session_id, 'completed');
    });
    const commands = listen<{ id: string; timestamp: string; agent_id: string; command: string; arguments: Record<string, unknown>; status: string; duration_ms: number; ui_action_triggered?: string }>('acp://command_executed', e => { addRecentCommand(e.payload); if (e.payload.ui_action_triggered && onExecuteCommandAction) onExecuteCommandAction(e.payload.ui_action_triggered, e.payload.arguments); });
    return () => { updates.then(f => f()); commands.then(f => f()); };
  }, [open, setAgentStatus, appendMessageChunk, addMessage, setSessionStatus, addRecentCommand, onExecuteCommandAction]);

  const startSession = async (agent: AgentKey) => {
    const id = createSession(agent, AGENTS[agent]); setSelectedAgent(agent);
    try { await invoke('start_acp_session', { agentId: agent, sessionId: id }); toast.success(`${AGENTS[agent]} connected`); }
    catch (e) { toast.error(`Failed to connect ${AGENTS[agent]}: ${e}`); }
  };

  const send = async () => {
    const prompt = input.trim(); if (!prompt || !aiEnabled) return;
    let id = activeSession?.id; if (!id) { id = createSession(selectedAgent, AGENTS[selectedAgent]); try { await invoke('start_acp_session', { agentId: selectedAgent, sessionId: id }); } catch {} }
    setInput(''); setBusy(true); addMessage(id, { role: 'user', content: prompt }); setSessionStatus(id, 'running');
    try {
      await invoke('send_acp_prompt', { sessionId: id, prompt, context: { connection_id: connectionId, db_type: dbType, include_schema: aiAutoIncludeSchema, include_query: aiAutoIncludeQuery, confirm_generated_sql: aiConfirmGeneratedSql } });
    } catch (e) { toast.error(`AI request failed: ${e}`); setSessionStatus(id, 'failed'); } finally { setBusy(false); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-5xl h-[88vh] flex flex-col p-0 overflow-hidden">
    <DialogHeader className="px-5 py-3.5 border-b flex flex-row items-center justify-between shrink-0"><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><Bot className="h-5 w-5" /></div><div><DialogTitle className="text-base">AI Assistant</DialogTitle><DialogDescription className="text-xs mt-0.5">Ask about your schema, generate SQL, explain queries, or run an agent session.</DialogDescription></div></div><Badge variant="outline" className="text-[10px]">{AGENTS[selectedAgent]}</Badge></DialogHeader>
    <div className="flex-1 grid grid-cols-12 overflow-hidden">
      <aside className="col-span-3 border-r bg-muted/10 flex flex-col"><div className="p-3 border-b"><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Agents</p></div><div className="p-2 space-y-1">{(Object.keys(AGENTS) as AgentKey[]).map(a => <button key={a} onClick={() => void startSession(a)} className={cn('w-full flex items-center justify-between rounded-md border px-2.5 py-2 text-xs', selectedAgent === a ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted')}><span>{AGENTS[a]}</span><span className={cn('h-2 w-2 rounded-full', connectedAgents[a]?.status === 'connected' ? 'bg-emerald-500' : 'bg-muted-foreground/30')} /></button>)}</div><div className="p-3 mt-auto border-t text-xs"><div className="flex items-center gap-1.5 text-muted-foreground"><Database className="h-3.5 w-3.5 text-primary" />Database</div><p className="font-mono text-[11px] mt-1 truncate">{connectionId ?? 'No connection'}</p><p className="text-[10px] text-muted-foreground mt-1">{dbType ?? '—'}</p></div></aside>
      <section className="col-span-6 flex flex-col min-w-0"><ScrollArea className="flex-1 p-4"><div className="space-y-3">{!activeSession && <div className="py-12 text-center"><Bot className="h-8 w-8 mx-auto text-primary/60 mb-3" /><p className="text-sm font-medium">How can I help?</p><p className="text-xs text-muted-foreground mt-1">Your AI assistant can reason over the active database context.</p></div>}{activeSession?.messages.map(m => <div key={m.id} className={cn('rounded-lg px-3 py-2.5 text-sm whitespace-pre-wrap', m.role === 'user' ? 'bg-primary text-primary-foreground ml-10' : m.role === 'tool_call' ? 'border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300' : 'bg-muted mr-6')}>{m.role === 'tool_call' && <Terminal className="inline h-3.5 w-3.5 mr-1.5" />}{m.content}</div>)}<div ref={endRef} /></div></ScrollArea>
        <div className="p-3 border-t"><div className="flex flex-wrap gap-1.5 mb-2">{STARTERS.map(s => <Button key={s.label} variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setInput(s.prompt)}><Sparkles className="h-3 w-3 mr-1" />{s.label}</Button>)}</div><div className="rounded-lg border bg-background p-2"><textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder={connectionId ? 'Ask about your schema or SQL…' : 'Connect a database to provide schema context…'} className="w-full min-h-[70px] resize-none bg-transparent outline-none text-sm" disabled={!aiEnabled} /><div className="flex items-center justify-between pt-2"><span className="text-[10px] text-muted-foreground">Enter to send · Shift+Enter for newline</span><Button size="sm" disabled={!input.trim() || busy || !aiEnabled} onClick={() => void send()}>{busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}Send</Button></div></div></div>
      </section>
      <aside className="col-span-3 border-l bg-muted/10 p-3 space-y-3"><div className="flex items-center gap-2 text-xs font-semibold"><Settings2 className="h-3.5 w-3.5" />AI Context</div><div className="rounded-md border p-3 text-xs space-y-2"><div className="flex justify-between"><span className="text-muted-foreground">Schema</span><span>{aiAutoIncludeSchema ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : 'Off'}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Current SQL</span><span>{aiAutoIncludeQuery ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : 'Off'}</span></div><div className="flex justify-between"><span className="text-muted-foreground">SQL review</span><span>{aiConfirmGeneratedSql ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : 'Off'}</span></div></div><div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5 text-amber-600 mb-1" />Generated SQL should be reviewed before execution. Destructive operations remain governed by NodaDB permissions.</div><div className="text-[10px] text-muted-foreground"><p className="font-medium text-foreground mb-1">Integrations</p><p>Direct CLI · ACP · MCP · Plugins</p></div></aside>
    </div>
  </DialogContent></Dialog>;
}
