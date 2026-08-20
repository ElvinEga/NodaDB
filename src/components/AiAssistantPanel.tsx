import { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Square,
  Sparkles,
  Database,
  Code,
  Play,
  Copy,
  Check,
  RotateCcw,
  Maximize2,
  Minimize2,
  X,
  ChevronDown,
  ChevronUp,
  Brain,
  AlertCircle,
  ExternalLink,
  Layers,
  ArrowRight,
  Shield,
  Trash2,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useSettingsStore, type AiProvider, type AiIntegration } from '@/stores/settingsStore';
import { useAgentStore } from '@/stores/agentStore';
import { buildSelectiveAiContext, detectPromptIntent } from '@/lib/aiContextProvider';
import type { ConnectionConfig } from '@/types';
import type { TabType } from '@/components/TabBar';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'thought' | 'system';
  content: string;
  timestamp: string;
  sqlBlocks?: string[];
  entityRef?: string;
  migrationDdl?: string;
}

interface AiAssistantPanelProps {
  connection: ConnectionConfig | null;
  activeTab?: TabType | null;
  onInsertSql?: (sql: string) => void;
  onRunSql?: (sql: string) => void;
  onOpenRelationFlow?: (entityVal: string) => void;
  onOpenSchemaDesigner?: () => void;
  onOpenSettings?: () => void;
  onClose: () => void;
}

export function AiAssistantPanel({
  connection,
  activeTab,
  onInsertSql,
  onRunSql,
  onOpenRelationFlow,
  onOpenSchemaDesigner,
  onOpenSettings,
  onClose,
}: AiAssistantPanelProps) {
  const {
    aiEnabled,
    aiProvider,
    aiIntegration,
    aiModel,
    aiConfirmGeneratedSql,
    aiAllowWriteOperations,
  } = useSettingsStore();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I'm your NodaDB database assistant.\n\nI can help you inspect schemas, generate or optimize queries, trace foreign-key relationships, and write safe migrations.`,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeThought, setActiveThought] = useState<string | null>(null);
  const [showThought, setShowThought] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);
  const [contextSummary, setContextSummary] = useState<string>('Detecting context...');
  const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update context preview string when connection or active tab changes
  useEffect(() => {
    buildSelectiveAiContext({
      connection,
      activeTab,
    }).then((bundle) => {
      setContextSummary(bundle.summaryDescription);
    });
  }, [connection, activeTab]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeThought, isRunning]);

  // Listen to Tauri agent events
  useEffect(() => {
    const unlistenStdout = listen<{ session_id: string; line: string }>(
      'agent://stdout',
      (event) => {
        if (currentSessionId && event.payload.session_id === currentSessionId) {
          const line = event.payload.line;

          // Check if line contains thinking indicator
          if (line.startsWith('<thought>') || line.startsWith('Thinking:')) {
            setActiveThought((prev) => (prev ? prev + '\n' + line : line));
            return;
          }

          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant') {
              const updatedContent = last.content + '\n' + line;
              const sqlBlocks = extractSqlBlocks(updatedContent);
              const entityRef = extractEntityRef(updatedContent);
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  content: updatedContent,
                  sqlBlocks,
                  entityRef,
                },
              ];
            } else {
              const sqlBlocks = extractSqlBlocks(line);
              return [
                ...prev,
                {
                  id: `msg-${Date.now()}`,
                  role: 'assistant',
                  content: line,
                  timestamp: new Date().toLocaleTimeString(),
                  sqlBlocks,
                },
              ];
            }
          });
        }
      },
    );

    const unlistenStatus = listen<{ session_id: string; status: string; exit_code?: number }>(
      'agent://status',
      (event) => {
        if (currentSessionId && event.payload.session_id === currentSessionId) {
          if (event.payload.status === 'completed' || event.payload.status === 'error' || event.payload.status === 'killed') {
            setIsRunning(false);
            setCurrentSessionId(null);
            setActiveThought(null);
          }
        }
      },
    );

    return () => {
      unlistenStdout.then((f) => f());
      unlistenStatus.then((f) => f());
    };
  }, [currentSessionId]);

  // Send turn prompt
  const handleSend = async (promptOverride?: string) => {
    const textToSend = promptOverride ?? inputPrompt.trim();
    if (!textToSend || isRunning) return;

    if (!aiEnabled) {
      toast.error('AI Assistant is disabled in Settings');
      return;
    }

    const intent = detectPromptIntent(textToSend);
    const contextBundle = await buildSelectiveAiContext({
      connection,
      activeTab,
      intent,
    });

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsRunning(true);
    setActiveThought(null);

    const sessionId = `ai-chat-${Date.now()}`;
    setCurrentSessionId(sessionId);

    // Initial placeholder for assistant message
    setMessages((prev) => [
      ...prev,
      {
        id: `assist-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    try {
      if (aiIntegration === 'acp') {
        // Run via ACP Host Manager
        await invoke('send_acp_prompt', {
          sessionId,
          prompt: textToSend,
          context: {
            connection_id: contextBundle.connectionId,
            db_type: contextBundle.dbType,
            active_table: contextBundle.activeTable,
            active_query: contextBundle.activeQuery,
            explain_plan: contextBundle.explainPlan,
            selected_entity: contextBundle.selectedEntity,
          },
        });
      } else {
        // Run via Direct Native CLI Bridge (default)
        await invoke('run_agent_session', {
          sessionId,
          agentId: aiProvider,
          prompt: textToSend,
          connectionId: contextBundle.connectionId,
          dbType: contextBundle.dbType,
          activeTable: contextBundle.activeTable,
          activeQuery: contextBundle.activeQuery,
          explainPlan: contextBundle.explainPlan,
          selectedEntity: contextBundle.selectedEntity,
          customInstructions: aiModel ? `Use model: ${aiModel}` : undefined,
        });
      }
    } catch (err) {
      setIsRunning(false);
      setCurrentSessionId(null);
      toast.error(`Agent execution failed: ${err}`);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'system',
          content: `Failed to execute ${aiProvider}: ${err}. Ensure binary is installed or change settings.`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }
  };

  const handleStop = async () => {
    if (!currentSessionId) return;
    try {
      await invoke('stop_agent_session', { sessionId: currentSessionId });
      setIsRunning(false);
      setCurrentSessionId(null);
      toast.info('AI generation stopped');
    } catch (e) {
      console.error('Stop error:', e);
    }
  };

  const handleCopyCode = (sql: string, blockId: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedBlockId(blockId);
    toast.success('SQL copied to clipboard');
    setTimeout(() => setCopiedBlockId(null), 2000);
  };

  const handleExecuteSql = (sql: string) => {
    if (aiConfirmGeneratedSql) {
      const isDestructive = /drop|delete|truncate|alter|create/i.test(sql);
      if (isDestructive && !aiAllowWriteOperations) {
        toast.warning('Destructive write operations require permission in Settings.');
      }
    }
    onRunSql?.(sql);
  };

  return (
    <div className="flex flex-col h-full bg-background border-l border-border select-none">
      {/* Header */}
      <div className="h-11 px-3.5 border-b border-border/70 flex items-center justify-between shrink-0 bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <Bot className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-foreground">AI Assistant</span>
              <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 border-primary/30 text-primary uppercase">
                {aiProvider} · {aiIntegration}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setMessages([
                {
                  id: 'welcome-cleared',
                  role: 'assistant',
                  content: "Context refreshed. How can I help with your database?",
                  timestamp: new Date().toLocaleTimeString(),
                },
              ]);
            }}
            title="Clear conversation"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            title="Close Assistant"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Context Accordion Bar */}
      <div className="border-b border-border/40 bg-muted/10">
        <button
          onClick={() => setContextExpanded(!contextExpanded)}
          className="w-full px-3 py-1.5 text-left flex items-center justify-between text-[11px] text-muted-foreground hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-1.5 truncate">
            <Database className="h-3 w-3 text-primary shrink-0" />
            <span className="truncate font-mono">{contextSummary}</span>
          </div>
          {contextExpanded ? (
            <ChevronUp className="h-3 w-3 shrink-0 ml-1" />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0 ml-1" />
          )}
        </button>

        {contextExpanded && (
          <div className="px-3 py-2 text-[10px] space-y-1 bg-muted/20 border-t border-border/30 font-mono text-muted-foreground">
            <div><strong>Active DB:</strong> {connection ? `${connection.name} (${connection.db_type})` : 'None'}</div>
            {activeTab?.type === 'table' && <div><strong>Selected Table:</strong> {activeTab.table?.name}</div>}
            {activeTab?.type === 'query' && (
              <div className="truncate"><strong>Active SQL:</strong> {activeTab.queryContent || 'Empty editor'}</div>
            )}
            <div className="pt-1 flex justify-end">
              <button
                onClick={onOpenSettings}
                className="text-primary hover:underline flex items-center gap-1"
              >
                Configure Context in Settings <ExternalLink className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Chips (When few messages) */}
      {messages.length <= 2 && (
        <div className="p-3 border-b border-border/40 bg-muted/5 space-y-1.5 shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => handleSend('Explain this database schema and list main tables')}
              className="text-left p-1.5 rounded border border-border/60 bg-card hover:bg-accent/40 text-[11px] text-foreground transition-all flex items-center gap-1.5"
            >
              <Database className="h-3 w-3 text-primary shrink-0" />
              <span className="truncate">Explain schema</span>
            </button>
            <button
              onClick={() => handleSend('Analyze and optimize the current SQL query for performance')}
              className="text-left p-1.5 rounded border border-border/60 bg-card hover:bg-accent/40 text-[11px] text-foreground transition-all flex items-center gap-1.5"
            >
              <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
              <span className="truncate">Optimize query</span>
            </button>
            <button
              onClick={() => handleSend('Write a SQL query to ')}
              className="text-left p-1.5 rounded border border-border/60 bg-card hover:bg-accent/40 text-[11px] text-foreground transition-all flex items-center gap-1.5"
            >
              <Code className="h-3 w-3 text-blue-500 shrink-0" />
              <span className="truncate">Generate SQL</span>
            </button>
            <button
              onClick={() => handleSend('Explain foreign key relationships between tables')}
              className="text-left p-1.5 rounded border border-border/60 bg-card hover:bg-accent/40 text-[11px] text-foreground transition-all flex items-center gap-1.5"
            >
              <Layers className="h-3 w-3 text-purple-500 shrink-0" />
              <span className="truncate">Explore relations</span>
            </button>
          </div>
        </div>
      )}

      {/* Messages Stream */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3.5">
          {messages.map((msg, i) => (
            <div
              key={msg.id || i}
              className={cn(
                'space-y-1.5 text-xs',
                msg.role === 'user' ? 'ml-auto max-w-[90%]' : 'mr-auto max-w-full',
              )}
            >
              {/* Message Header */}
              <div
                className={cn(
                  'flex items-center gap-1.5 text-[10px] text-muted-foreground',
                  msg.role === 'user' ? 'justify-end' : '',
                )}
              >
                {msg.role === 'user' ? (
                  <span>You • {msg.timestamp}</span>
                ) : (
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <Bot className="h-3 w-3 text-primary" />
                    {aiProvider} • {msg.timestamp}
                  </span>
                )}
              </div>

              {/* Message Body */}
              <div
                className={cn(
                  'rounded-lg p-2.5 text-xs leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : msg.role === 'system'
                    ? 'bg-destructive/10 border border-destructive/30 text-destructive'
                    : 'bg-muted/40 border border-border/50 text-foreground whitespace-pre-wrap',
                )}
              >
                {msg.content || (isRunning && i === messages.length - 1 ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground italic">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                    Analyzing database...
                  </span>
                ) : null)}
              </div>

              {/* Actionable SQL Blocks */}
              {msg.sqlBlocks && msg.sqlBlocks.length > 0 && (
                <div className="space-y-2 pt-1">
                  {msg.sqlBlocks.map((sql, sIdx) => {
                    const blockId = `${msg.id}-sql-${sIdx}`;
                    const isCopied = copiedBlockId === blockId;
                    return (
                      <div
                        key={blockId}
                        className="rounded-md border border-primary/30 bg-card overflow-hidden text-xs shadow-sm"
                      >
                        <div className="px-2.5 py-1.5 bg-muted/40 border-b border-border/40 flex items-center justify-between">
                          <span className="text-[10px] font-mono font-semibold text-primary">Generated SQL</span>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 text-[10px] px-1.5"
                              onClick={() => handleCopyCode(sql, blockId)}
                            >
                              {isCopied ? <Check className="h-3 w-3 text-emerald-500 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                              {isCopied ? 'Copied' : 'Copy'}
                            </Button>
                            {onInsertSql && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 text-[10px] px-1.5 text-primary hover:text-primary"
                                onClick={() => onInsertSql(sql)}
                              >
                                <Code className="h-3 w-3 mr-1" />
                                Insert
                              </Button>
                            )}
                            {onRunSql && (
                              <Button
                                size="sm"
                                className="h-5 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleExecuteSql(sql)}
                              >
                                <Play className="h-2.5 w-2.5 mr-1" />
                                Run
                              </Button>
                            )}
                          </div>
                        </div>
                        <pre className="p-2.5 text-[11px] font-mono overflow-x-auto bg-muted/20 text-foreground">
                          {sql}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Actionable Entity Flow Card */}
              {msg.entityRef && onOpenRelationFlow && (
                <div className="p-2 rounded-md border border-purple-500/30 bg-purple-500/5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Layers className="h-3.5 w-3.5 text-purple-500" />
                    <span>Entity relation reference detected: <strong>{msg.entityRef}</strong></span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] border-purple-500/40 text-purple-600 dark:text-purple-400"
                    onClick={() => onOpenRelationFlow(msg.entityRef!)}
                  >
                    Open Flow <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          ))}

          {/* Collapsible Active Thought Stream */}
          {activeThought && (
            <div className="rounded-md border border-purple-500/30 bg-purple-500/5 p-2 text-xs">
              <button
                onClick={() => setShowThought(!showThought)}
                className="flex items-center justify-between w-full text-purple-600 dark:text-purple-400 font-semibold"
              >
                <div className="flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 animate-pulse" />
                  <span>Agent Reasoning...</span>
                </div>
                {showThought ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showThought && (
                <pre className="mt-1.5 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                  {activeThought}
                </pre>
              )}
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-2.5 border-t border-border/70 bg-card shrink-0">
        <div className="relative flex flex-col gap-1.5">
          <Textarea
            ref={textareaRef}
            value={inputPrompt}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputPrompt(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Ask ${aiProvider} about schemas, SQL, optimizations...`}
            rows={2}
            className="min-h-[56px] text-xs resize-none pr-10 leading-relaxed font-sans"
            disabled={isRunning}
          />
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-muted-foreground">
              <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[9px]">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[9px]">Shift+Enter</kbd> for newline
            </span>

            {isRunning ? (
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs px-2.5 gap-1"
                onClick={handleStop}
              >
                <Square className="h-3 w-3 fill-current" />
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-7 text-xs px-3 gap-1"
                onClick={() => handleSend()}
                disabled={!inputPrompt.trim()}
              >
                <Send className="h-3 w-3" />
                Send
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helpers
function extractSqlBlocks(text: string): string[] {
  const blocks: string[] = [];
  const regex = /```(?:sql)?\s*([\s\S]*?)\s*```/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const code = match[1].trim();
    if (/SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|EXPLAIN/i.test(code)) {
      blocks.push(code);
    }
  }
  return blocks;
}

function extractEntityRef(text: string): string | undefined {
  const match = /\/flow\s+([\w_]+:[\w_\-]+)/i.exec(text) || /(?:entity|customer|order|user|id)[:\s]+([\w_]+:[\w_\-]+)/i.exec(text);
  return match ? match[1] : undefined;
}
