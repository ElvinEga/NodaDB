import { useState, useMemo } from 'react';
import { Search, Command } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';


interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Shortcut {
  mac: string[];
  win: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  // ── Tab Management ────────────────────────────────────────────────
  { mac: ['⌘', 'N'],           win: ['Ctrl', 'N'],           description: 'New Query Tab',          category: 'Tab Management' },
  { mac: ['⌘', 'W'],           win: ['Ctrl', 'W'],           description: 'Close Current Tab',      category: 'Tab Management' },
  { mac: ['⌘', '⇧', 'W'],     win: ['Ctrl', 'Shift', 'W'], description: 'Close All Tabs',         category: 'Tab Management' },
  { mac: ['Ctrl', 'Tab'],      win: ['Ctrl', 'Tab'],         description: 'Next Tab',               category: 'Tab Management' },
  { mac: ['Ctrl', '⇧', 'Tab'],win: ['Ctrl', 'Shift', 'Tab'],description: 'Previous Tab',           category: 'Tab Management' },
  { mac: ['⌘', '1 – 9'],      win: ['Ctrl', '1 – 9'],      description: 'Jump to Tab by Number',  category: 'Tab Management' },

  // ── Query Editor ──────────────────────────────────────────────────
  { mac: ['⌘', '↩'],          win: ['Ctrl', 'Enter'],       description: 'Execute Query',          category: 'Query Editor' },
  { mac: ['⌘', '⇧', '↩'],    win: ['Ctrl', 'Shift', 'Enter'], description: 'Execute Selection',  category: 'Query Editor' },
  { mac: ['⌘', '/'],          win: ['Ctrl', '/'],           description: 'Toggle Line Comment',    category: 'Query Editor' },
  { mac: ['⇧', '⌥', 'F'],    win: ['Shift', 'Alt', 'F'],  description: 'Format SQL',             category: 'Query Editor' },

  // ── Table View ────────────────────────────────────────────────────
  { mac: ['⌘', 'F'],          win: ['Ctrl', 'F'],           description: 'Filter Table',           category: 'Table View' },
  { mac: ['⌘', 'R'],          win: ['Ctrl', 'R'],           description: 'Refresh Table Data',     category: 'Table View' },
  { mac: ['⌘', 'Z'],          win: ['Ctrl', 'Z'],           description: 'Undo Edit',              category: 'Table View' },
  { mac: ['⌘', 'Y'],          win: ['Ctrl', 'Y'],           description: 'Redo Edit',              category: 'Table View' },
  { mac: ['F2'],              win: ['F2'],                  description: 'Edit Cell (inline)',     category: 'Table View' },
  { mac: ['⌘', 'C'],          win: ['Ctrl', 'C'],           description: 'Copy Cell / Selection',  category: 'Table View' },

  // ── Navigation ───────────────────────────────────────────────────
  { mac: ['⌘', '⇧', 'P'],    win: ['Ctrl', 'Shift', 'P'],  description: 'Open Command Palette',   category: 'Navigation' },
  { mac: ['⌘', 'K'],          win: ['Ctrl', 'K'],           description: 'Open Command Palette',   category: 'Navigation' },
  { mac: ['⌘', '⇧', '?'],    win: ['Ctrl', 'Shift', '?'], description: 'Show Keyboard Shortcuts', category: 'Navigation' },
  { mac: ['⌘', '⇧', 'E'],    win: ['Ctrl', 'Shift', 'E'], description: 'Schema Designer / ERD',  category: 'Navigation' },
  { mac: ['⌘', '⇧', 'C'],    win: ['Ctrl', 'Shift', 'C'], description: 'Switch Connection',       category: 'Navigation' },
  { mac: ['Esc'],             win: ['Esc'],                 description: 'Close Dialog / Cancel',  category: 'Navigation' },

  // ── General ──────────────────────────────────────────────────────
  { mac: ['⌘', ','],          win: ['Ctrl', ','],           description: 'Open Settings',          category: 'General' },
];

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredShortcuts = useMemo(() => {
    if (!searchQuery) return shortcuts;
    const q = searchQuery.toLowerCase();
    return shortcuts.filter(
      (s) =>
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.mac.some((k) => k.toLowerCase().includes(q)) ||
        s.win.some((k) => k.toLowerCase().includes(q)),
    );
  }, [searchQuery]);

  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, Shortcut[]> = {};
    filteredShortcuts.forEach((s) => {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    });
    return groups;
  }, [filteredShortcuts]);

  const renderKeys = (keys: string[]) => (
    <div className="flex items-center gap-0.5">
      {keys.map((key, i) => (
        <span key={i} className="flex items-center gap-0.5">
          <Badge
            variant="secondary"
            className="px-2 py-0.5 text-xs font-mono font-semibold"
          >
            {key}
          </Badge>
          {i < keys.length - 1 && (
            <span className="text-xs text-muted-foreground mx-0.5">+</span>
          )}
        </span>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Command className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            All available keyboard shortcuts for {isMac ? 'macOS' : 'Windows / Linux'}.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search shortcuts…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Shortcuts list */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {Object.keys(groupedShortcuts).length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No shortcuts found matching &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              Object.entries(groupedShortcuts).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                    {category}
                  </h3>
                  <div className="space-y-1">
                    {items.map((shortcut, index) => (
                      <div
                        key={`${category}-${index}`}
                        className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-sm">{shortcut.description}</span>
                        {renderKeys(isMac ? shortcut.mac : shortcut.win)}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t flex items-center justify-center gap-1.5">
          Press
          {isMac ? (
            <>
              <Badge variant="outline" className="mx-0.5 text-xs">⌘</Badge>
              <span>+</span>
              <Badge variant="outline" className="mx-0.5 text-xs">⇧</Badge>
              <span>+</span>
              <Badge variant="outline" className="mx-0.5 text-xs">?</Badge>
            </>
          ) : (
            <>
              <Badge variant="outline" className="mx-0.5 text-xs">Ctrl</Badge>
              <span>+</span>
              <Badge variant="outline" className="mx-0.5 text-xs">Shift</Badge>
              <span>+</span>
              <Badge variant="outline" className="mx-0.5 text-xs">?</Badge>
            </>
          )}
          to toggle this dialog
        </div>
      </DialogContent>
    </Dialog>
  );
}
