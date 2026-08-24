import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Square, Copy, Check, Terminal, Database, Sparkles, AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AiIcon } from '@/components/AiIcon';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import type { DatabaseType } from '@/types';

export interface AgentRunParams {
  agentId: string;
  agentName: string;
  prompt: string;
  connectionId?: string | null;
  dbType?: DatabaseType | null;
  activeTable?: string | null;
}

interface AgentRunnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runParams: AgentRunParams | null;
}

interface LogLine {
  id: string;
  text: string;
  stream: 'stdout' | 'stderr' | 'system';
  timestamp: string;
}

export function AgentRunnerDialog({ open, onOpenChange, runParams }: AgentRunnerDialogProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed' | 'killed'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [contextText, setContextText] = useState<string>('');
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Launch agent process when dialog opens with new runParams
  const startAgentSession = useCallback(async (params: AgentRunParams) => {
    const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setSessionId(newSessionId);
    setLogs([
      {
        id: `sys-start-${Date.now()}`,
        text: `[NodaDB] Initializing ${params.agentName} session...`,
        stream: 'system',
        timestamp: new Date().toLocaleTimeString(),
      },
      {
        id: `sys-prompt-${Date.now()}`,
        text: `[NodaDB] Prompt: "${params.prompt}"`,
        stream: 'system',
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    setStatus('running');
    setErrorMsg(null);

    // Fetch DB context preview
    if (params.connectionId && params.dbType) {
      invoke<{ tables_summary: string; schema_ddl?: string }>('get_agent_db_context', {
        connectionId: params.connectionId,
        dbType: params.dbType.toLowerCase(),
        activeTable: params.activeTable,
      })
        .then((ctx) => {
          setContextText(
            `Connection: ${params.connectionId}\nDatabase Type: ${params.dbType}\n\n${ctx.tables_summary}${
              ctx.schema_ddl ? `\n\nSchema DDL:\n${ctx.schema_ddl}` : ''
            }`,
          );
        })
        .catch(() => {
          setContextText('No schema context available');
        });
    } else {
      setContextText('No active database connection');
    }

    try {
      await invoke('run_agent_session', {
        sessionId: newSessionId,
        agentId: params.agentId,
        prompt: params.prompt,
        connectionId: params.connectionId ?? undefined,
        dbType: params.dbType?.toLowerCase() ?? undefined,
        activeTable: params.activeTable ?? undefined,
      });
    } catch (err) {
      setStatus('failed');
      const errStr = String(err);
      setErrorMsg(errStr);
      setLogs((prev) => [
        ...prev,
        {
          id: `sys-err-${Date.now()}`,
          text: `[NodaDB Error] ${errStr}`,
          stream: 'stderr',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      toast.error(`Agent failed: ${errStr}`);
    }
  }, []);

  useEffect(() => {
    if (open && runParams) {
      startAgentSession(runParams);
    } else if (!open) {
      // Reset on close
      setStatus('idle');
      setSessionId(null);
    }
  }, [open, runParams, startAgentSession]);

  // Listen to Tauri events from Rust AgentSessionManager
  useEffect(() => {
    let unlistenStdout: UnlistenFn | undefined;
    let unlistenStderr: UnlistenFn | undefined;
    let unlistenStatus: UnlistenFn | undefined;

    const setupListeners = async () => {
      unlistenStdout = await listen<{ session_id: string; text: string }>('agent://stdout', (event) => {
        if (sessionId && event.payload.session_id !== sessionId) return;
        setLogs((prev) => [
          ...prev,
          {
            id: `out-${Date.now()}-${Math.random()}`,
            text: event.payload.text,
            stream: 'stdout',
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      });

      unlistenStderr = await listen<{ session_id: string; text: string }>('agent://stderr', (event) => {
        if (sessionId && event.payload.session_id !== sessionId) return;
        setLogs((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}-${Math.random()}`,
            text: event.payload.text,
            stream: 'stderr',
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      });

      unlistenStatus = await listen<{
        session_id: string;
        status: 'started' | 'completed' | 'failed' | 'killed';
        exit_code?: number;
        error?: string;
      }>('agent://status', (event) => {
        if (event.payload.status === 'started') {
          setStatus('running');
        } else {
          setStatus(event.payload.status);
        }
        if (event.payload.status === 'completed') {
          setLogs((prev) => [
            ...prev,
            {
              id: `sys-done-${Date.now()}`,
              text: `[NodaDB] Agent execution finished successfully.`,
              stream: 'system',
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
        } else if (event.payload.status === 'failed') {
          setLogs((prev) => [
            ...prev,
            {
              id: `sys-fail-${Date.now()}`,
              text: `[NodaDB] Agent exited with error${event.payload.error ? `: ${event.payload.error}` : ''}.`,
              stream: 'stderr',
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
        }
      });
    };

    setupListeners();

    return () => {
      unlistenStdout?.();
      unlistenStderr?.();
      unlistenStatus?.();
    };
  }, [sessionId]);

  const handleStop = async () => {
    if (!sessionId) return;
    try {
      await invoke('stop_agent_session', { sessionId });
      setStatus('killed');
      toast.info('Agent session cancelled');
    } catch (e) {
      toast.error(`Failed to cancel: ${e}`);
    }
  };

  const handleCopy = () => {
    const fullText = logs.map((l) => l.text).join('\n');
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      toast.success('Terminal output copied');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'running':
        return (
          <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Running
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            Failed
          </Badge>
        );
      case 'killed':
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Cancelled
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-background">
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-md bg-muted/60 flex items-center justify-center p-1 border border-border/50">
                <AiIcon name={runParams?.agentId ?? runParams?.agentName} className="h-5 w-5 shrink-0" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-semibold">
                    {runParams?.agentName ?? 'AI Agent'}
                  </DialogTitle>
                  {getStatusBadge()}
                </div>
                <DialogDescription className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {runParams?.prompt}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy} title="Copy output">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
              {status === 'running' && (
                <Button variant="outline" size="sm" className="text-xs text-destructive hover:bg-destructive/10" onClick={handleStop}>
                  <Square className="h-3.5 w-3.5 mr-1.5 fill-current" />
                  Stop
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Context Accordion Bar */}
        <div className="px-4 py-2 border-b border-border/40 bg-muted/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
            <span>Database Context: <strong className="text-foreground">{runParams?.connectionId ?? 'None'}</strong> ({runParams?.dbType ?? 'N/A'})</span>
          </div>
          <button
            onClick={() => setShowContext((v) => !v)}
            className="flex items-center gap-1 text-primary hover:underline text-xs font-medium"
          >
            {showContext ? 'Hide Context' : 'View Context'}
            {showContext ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {showContext && (
          <div className="border-b border-border/40 bg-muted/40 p-3 max-h-[140px] overflow-auto">
            <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
              {contextText}
            </pre>
          </div>
        )}

        {/* Live Terminal Output */}
        <div className="flex-1 min-h-[360px] max-h-[440px] bg-black/90 text-emerald-400 p-4 font-mono text-xs overflow-y-auto">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground/60 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Waiting for agent output...</span>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    'leading-relaxed whitespace-pre-wrap break-words',
                    log.stream === 'stderr' && 'text-red-400',
                    log.stream === 'system' && 'text-cyan-400 font-semibold',
                    log.stream === 'stdout' && 'text-gray-100',
                  )}
                >
                  <span className="text-gray-500 select-none mr-2 text-[10px]">[{log.timestamp}]</span>
                  {log.text}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border/60 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5 text-primary" />
            <span>Direct Agent CLI Bridge via native subprocess</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
