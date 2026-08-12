import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
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
} from 'lucide-react';

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
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: PaletteCommand[];
}

interface FlatItem {
  command: PaletteCommand;
  flatIndex: number;
}

export function CommandPalette({ open, onOpenChange, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const enabled = commands.filter((c) => !c.disabled);
    if (!query.trim()) return enabled;
    const q = query.toLowerCase();
    return enabled.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q),
    );
  }, [commands, query]);

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
            <Badge
              variant="secondary"
              className="px-1.5 py-0 text-[10px] font-mono font-semibold rounded"
            >
              {key}
            </Badge>
            {i < keys.length - 1 && (
              <span className="text-[10px] text-muted-foreground">+</span>
            )}
          </span>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[560px] p-0 gap-0 overflow-hidden border-border/60"
        onKeyDown={handleKeyDown}
      >
        {/* Search bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono shrink-0">
            Esc
          </Badge>
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[420px]">
          {flatItems.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No commands found{query ? ` for "${query}"` : ''}</p>
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
                          <p className="text-sm font-medium leading-none mb-0.5">{cmd.label}</p>
                          {cmd.description && (
                            <p className="text-xs text-muted-foreground truncate">{cmd.description}</p>
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
          </div>
          <span className="text-[10px] text-muted-foreground">
            {flatItems.length} command{flatItems.length !== 1 ? 's' : ''}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { Terminal, Database, Plus, Settings, Keyboard, LayoutGrid, Network, History };
