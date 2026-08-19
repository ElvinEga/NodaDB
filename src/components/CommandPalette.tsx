import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Search,
  Terminal,
  Database,
  Plus,
  Settings,
  Keyboard,
  LayoutGrid,
  Network,
  History,
  ChevronRight,
  Slash,
  Bot,
} from 'lucide-react';
import { parseSlashQuery, type NodaCommand } from '@/lib/commandRegistry';
import { toast } from 'sonner';

export interface PaletteCommand {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  macShortcut?: string[];
  winShortcut?: string[];
  category: string;
  action: () => void;
  disabled?: boolean;
  /** Optional slash-command hint shown in the palette */
  slash?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: PaletteCommand[];
  /** NodaDB slash-commands for slash-mode routing */
  nodaCommands?: NodaCommand[];
}

interface FlatItem {
  command: PaletteCommand;
  flatIndex: number;
}

export function CommandPalette({ open, onOpenChange, commands, nodaCommands = [] }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  const isMac =
    typeof navigator !== 'undefined' &&
    (/Mac|iPhone|iPad|iPod/.test(navigator.userAgent) || /Mac/.test(navigator.platform ?? ''));

  // ── Open/close reset ─────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ── Slash-mode detection ─────────────────────────────────────────────────
  const isSlashMode = query.startsWith('/');

  const slashParsed = useMemo(() => {
    if (!isSlashMode) return null;
    return parseSlashQuery(query, nodaCommands);
  }, [query, isSlashMode, nodaCommands]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const enabled = commands.filter((c) => !c.disabled);

    if (isSlashMode) {
      // In slash mode: show commands whose slash prefix matches
      const slashPrefix = query.split(' ')[0].toLowerCase();
      const matchingNodeCommands = nodaCommands
        .filter((nc) => nc.slash.startsWith(slashPrefix))
        .map((nc): PaletteCommand => ({
          id: nc.id,
          label: nc.label,
          description: nc.description,
          slash: nc.slash,
          macShortcut: nc.macShortcut,
          winShortcut: nc.winShortcut,
          category: nc.category,
          action: () => {
            const { args } = parseSlashQuery(query, nodaCommands);
            const result = nc.action(args);
            if (result instanceof Promise) {
              result.then((r) => {
                if (!r.success) toast.error(r.error ?? 'Command failed');
              }).catch((e) => toast.error(String(e)));
            }
          },
        }));
      if (matchingNodeCommands.length > 0) return matchingNodeCommands;
      // Fallback: show slash-tagged palette commands
      return enabled.filter((c) => c.slash?.startsWith(slashPrefix));
    }

    if (!query.trim()) return enabled;
    const q = query.toLowerCase();
    return enabled.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.slash?.includes(q),
    );
  }, [commands, nodaCommands, query, isSlashMode]);

  const grouped = useMemo(() => {
    const map: Record<string, PaletteCommand[]> = {};
    for (const cmd of filtered) {
      if (!map[cmd.category]) map[cmd.category] = [];
      map[cmd.category].push(cmd);
    }
    return map;
  }, [filtered]);

  const flatItems = useMemo<FlatItem[]>(() => {
    let i = 0;
    const items: FlatItem[] = [];
    for (const cmds of Object.values(grouped)) {
      for (const cmd of cmds) {
        items.push({ command: cmd, flatIndex: i++ });
      }
    }
    return items;
  }, [grouped]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const execute = useCallback(
    (cmd: PaletteCommand) => {
      onOpenChange(false);
      setTimeout(() => cmd.action(), 80);
    },
    [onOpenChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = flatItems[selectedIndex];
        if (item) execute(item.command);
      }
    },
    [flatItems, selectedIndex, execute],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const renderShortcut = (cmd: PaletteCommand) => {
    const keys = isMac ? cmd.macShortcut : cmd.winShortcut;
    if (!keys?.length) return null;
    return (
      <div className="flex items-center gap-0.5 shrink-0 ml-3">
        {keys.map((key, i) => (
          <span key={i} className="flex items-center gap-0.5">
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono font-semibold rounded">
              {key}
            </Badge>
            {i < keys.length - 1 && <span className="text-[10px] text-muted-foreground">+</span>}
          </span>
        ))}
      </div>
    );
  };

  // ── Slash-mode arg hint ──────────────────────────────────────────────────
  const renderSlashHint = () => {
    if (!isSlashMode || !slashParsed?.command) return null;
    const cmd = slashParsed.command;
    if (!cmd.args?.length) return null;
    const parts = query.trim().split(/\s+/);
    const typedArgs = parts.length - 1; // how many args typed so far

    return (
      <div className="px-4 py-2 border-b border-border/40 bg-muted/30 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-mono text-primary font-semibold">{cmd.slash}</span>
        {cmd.args.map((arg, i) => {
          const isTyped = i < typedArgs;
          const isCurrent = i === typedArgs;
          return (
            <span
              key={arg.name}
              className={cn(
                'text-[10px] font-mono px-1.5 py-0.5 rounded border',
                isTyped && 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
                isCurrent && 'border-primary/50 text-primary bg-primary/10',
                !isTyped && !isCurrent && 'border-border/50 text-muted-foreground',
              )}
            >
              &lt;{arg.name}&gt;
              {arg.required && <span className="text-destructive ml-0.5">*</span>}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        {/* Content — no close button (uses Radix primitives directly) */}
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-[560px] translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-lg border border-border/60 bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          onKeyDown={handleKeyDown}
        >
          {/* Search bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
            {isSlashMode ? (
              <Slash className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isSlashMode ? 'Type a slash-command…' : 'Type a command or / for slash-commands…'}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono shrink-0">
              Esc
            </Badge>
          </div>

          {/* Slash-mode arg hints */}
          {renderSlashHint()}

          {/* Results */}
          <ScrollArea className="max-h-[400px]">
            {flatItems.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  {isSlashMode
                    ? `No slash-command matches "${query}"`
                    : query
                    ? `No commands found for "${query}"`
                    : 'No commands found'}
                </p>
                {isSlashMode && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Try: /explore /schema /query /agents /status /context
                  </p>
                )}
              </div>
            ) : (
              <div className="py-2">
                {Object.entries(grouped).map(([category, cmds]) => (
                  <div key={category}>
                    <p className="px-4 py-1.5 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/70">
                      {category}
                    </p>
                    {cmds.map((cmd) => {
                      const fi = flatItems.find((f) => f.command.id === cmd.id);
                      const isSelected = fi?.flatIndex === selectedIndex;
                      return (
                        <div
                          key={cmd.id}
                          ref={isSelected ? selectedRef : undefined}
                          onClick={() => execute(cmd)}
                          className={cn(
                            'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors select-none',
                            isSelected
                              ? 'bg-primary/10 text-foreground'
                              : 'text-foreground/80 hover:bg-muted/50',
                          )}
                        >
                          <span
                            className={cn(
                              'h-7 w-7 flex items-center justify-center rounded-md shrink-0 text-muted-foreground',
                              isSelected && 'text-primary bg-primary/10',
                            )}
                          >
                            {cmd.icon ?? <ChevronRight className="h-3.5 w-3.5" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium leading-none">{cmd.label}</p>
                              {cmd.slash && (
                                <span className="text-[10px] font-mono text-muted-foreground/70">{cmd.slash}</span>
                              )}
                            </div>
                            {cmd.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{cmd.description}</p>
                            )}
                          </div>
                          {renderShortcut(cmd)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer hint */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-border/60 bg-muted/20">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono">↑</Badge>
                <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono">↓</Badge>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">↩</Badge>
                select
              </span>
              {!isSlashMode && (
                <span className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">/</Badge>
                  slash-mode
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {flatItems.length} command{flatItems.length !== 1 ? 's' : ''}
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export { Terminal, Database, Plus, Settings, Keyboard, LayoutGrid, Network, History, Bot };
