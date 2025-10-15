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
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  // Tab Management
  { keys: ['Ctrl', 'N'], description: 'New Query Tab', category: 'Tab Management' },
  { keys: ['Ctrl', 'W'], description: 'Close Current Tab', category: 'Tab Management' },
  { keys: ['Ctrl', 'Shift', 'W'], description: 'Close All Tabs', category: 'Tab Management' },
  { keys: ['Ctrl', 'Tab'], description: 'Next Tab', category: 'Tab Management' },
  { keys: ['Ctrl', 'Shift', 'Tab'], description: 'Previous Tab', category: 'Tab Management' },
  { keys: ['Ctrl', '1-9'], description: 'Jump to Tab by Number', category: 'Tab Management' },
  { keys: ['Ctrl', 'P'], description: 'Pin/Unpin Tab', category: 'Tab Management' },

  // Query Editor
  { keys: ['Ctrl', 'Enter'], description: 'Execute Query', category: 'Query Editor' },
  { keys: ['Ctrl', 'Shift', 'Enter'], description: 'Execute Selection', category: 'Query Editor' },
  { keys: ['Shift', 'Alt', 'F'], description: 'Format SQL', category: 'Query Editor' },
  { keys: ['Ctrl', '/'], description: 'Toggle Comment', category: 'Query Editor' },
  { keys: ['Ctrl', 'Shift', 'C'], description: 'Copy SQL Query', category: 'Query Editor' },
  { keys: ['Ctrl', 'E'], description: 'Export Query Results', category: 'Query Editor' },

  // Query Builder
  { keys: ['Ctrl', 'B'], description: 'Open Visual Query Builder', category: 'Query Builder' },
  { keys: ['Ctrl', 'Shift', 'B'], description: 'Add Table to Canvas', category: 'Query Builder' },
  { keys: ['Del'], description: 'Delete Selected Node/Edge', category: 'Query Builder' },
  { keys: ['Ctrl', 'G'], description: 'Generate SQL from Builder', category: 'Query Builder' },

  // Table Operations
  { keys: ['Ctrl', 'C'], description: 'Copy Cell Value', category: 'Table Operations' },
  { keys: ['Ctrl', 'D'], description: 'Duplicate Row', category: 'Table Operations' },
  { keys: ['Del'], description: 'Delete Row', category: 'Table Operations' },
  { keys: ['F2'], description: 'Edit Cell', category: 'Table Operations' },
  { keys: ['Ctrl', 'F'], description: 'Filter Table', category: 'Table Operations' },
  { keys: ['Ctrl', 'R'], description: 'Refresh Table Data', category: 'Table Operations' },
  { keys: ['Ctrl', 'I'], description: 'Insert New Row', category: 'Table Operations' },

  // Data Generation
  { keys: ['Ctrl', 'Shift', 'G'], description: 'Generate Test Data', category: 'Data Generation' },
  { keys: ['Ctrl', 'Shift', 'D'], description: 'Bulk Delete Rows', category: 'Data Generation' },

  // Navigation
  { keys: ['Ctrl', 'K'], description: 'Focus Search/Command Palette', category: 'Navigation' },
  { keys: ['Ctrl', '?'], description: 'Show Keyboard Shortcuts', category: 'Navigation' },
  { keys: ['Esc'], description: 'Close Dialog/Cancel', category: 'Navigation' },
  { keys: ['Ctrl', 'L'], description: 'Focus Connection List', category: 'Navigation' },
  { keys: ['Ctrl', 'T'], description: 'Focus Table List', category: 'Navigation' },

  // General
  { keys: ['Ctrl', 'S'], description: 'Save Changes', category: 'General' },
  { keys: ['Ctrl', 'Z'], description: 'Undo', category: 'General' },
  { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo', category: 'General' },
  { keys: ['Ctrl', ','], description: 'Open Settings', category: 'General' },
  { keys: ['F5'], description: 'Refresh Application', category: 'General' },
];

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Detect OS for proper key display
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  
  const modifierMap: Record<string, string> = isMac
    ? { Ctrl: '⌘', Alt: '⌥', Shift: '⇧', Enter: '⏎' }
    : { Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Enter: 'Enter' };

  // Filter shortcuts based on search
  const filteredShortcuts = useMemo(() => {
    if (!searchQuery) return shortcuts;
    
    const query = searchQuery.toLowerCase();
    return shortcuts.filter(
      (shortcut) =>
        shortcut.description.toLowerCase().includes(query) ||
        shortcut.keys.some((key) => key.toLowerCase().includes(query)) ||
        shortcut.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Group shortcuts by category
  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, Shortcut[]> = {};
    filteredShortcuts.forEach((shortcut) => {
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = [];
      }
      groups[shortcut.category].push(shortcut);
    });
    return groups;
  }, [filteredShortcuts]);

  const renderKey = (key: string) => {
    const displayKey = modifierMap[key] || key;
    return (
      <Badge
        key={key}
        variant="secondary"
        className="px-2 py-0.5 text-xs font-mono font-semibold"
      >
        {displayKey}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Command className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            All available keyboard shortcuts to boost your productivity
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search shortcuts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Shortcuts List */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {Object.keys(groupedShortcuts).length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No shortcuts found matching "{searchQuery}"
              </div>
            ) : (
              Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {shortcuts.map((shortcut, index) => (
                      <div
                        key={`${category}-${index}`}
                        className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-sm">{shortcut.description}</span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, i) => (
                            <div key={i} className="flex items-center gap-1">
                              {renderKey(key)}
                              {i < shortcut.keys.length - 1 && key !== '1-9' && (
                                <span className="text-xs text-muted-foreground mx-0.5">+</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer Hint */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Press <Badge variant="outline" className="mx-1 text-xs">Esc</Badge> or{' '}
          <Badge variant="outline" className="mx-1 text-xs">{isMac ? '⌘' : 'Ctrl'}</Badge>
          <span className="mx-0.5">+</span>
          <Badge variant="outline" className="mx-1 text-xs">?</Badge> to close
        </div>
      </DialogContent>
    </Dialog>
  );
}
