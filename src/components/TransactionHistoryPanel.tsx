import { useMemo } from 'react';
import { Undo2, Redo2, Trash2, Edit, Plus, Copy, Clock, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useUndoRedoStore, ActionType } from '@/stores/undoRedoStore';
import { formatDistanceToNow } from 'date-fns';

interface TransactionHistoryPanelProps {
  tableKey: string;
  onUndo: () => void;
  onRedo: () => void;
}

const actionIcons: Record<ActionType, typeof Plus> = {
  insert: Plus,
  update: Edit,
  delete: Trash2,
  batch_update: Edit,
  batch_delete: Trash2,
  batch_duplicate: Copy,
};

const actionColors: Record<ActionType, string> = {
  insert: 'text-green-500',
  update: 'text-blue-500',
  delete: 'text-red-500',
  batch_update: 'text-blue-500',
  batch_delete: 'text-red-500',
  batch_duplicate: 'text-purple-500',
};

const actionLabels: Record<ActionType, string> = {
  insert: 'Insert',
  update: 'Update',
  delete: 'Delete',
  batch_update: 'Batch Update',
  batch_delete: 'Batch Delete',
  batch_duplicate: 'Duplicate',
};

export function TransactionHistoryPanel({
  tableKey,
  onUndo,
  onRedo,
}: TransactionHistoryPanelProps) {
  const history = useUndoRedoStore((state) => state.getHistory(tableKey));
  const currentIndex = useUndoRedoStore((state) => state.currentIndex.get(tableKey) ?? -1);
  const canUndo = useUndoRedoStore((state) => state.canUndo(tableKey));
  const canRedo = useUndoRedoStore((state) => state.canRedo(tableKey));
  const clearHistory = useUndoRedoStore((state) => state.clearHistory);

  const sortedHistory = useMemo(() => {
    return [...history].reverse();
  }, [history]);

  const getActionDescription = (action: typeof history[0]) => {
    switch (action.type) {
      case 'insert':
        return `Inserted ${action.data.rows?.length || 1} row(s)`;
      case 'delete':
        return `Deleted ${action.data.rows?.length || 1} row(s)`;
      case 'update':
        return `Updated ${action.data.oldValues?.length || 1} row(s)`;
      case 'batch_update':
        return `Batch updated ${action.data.primaryKeyValues?.length || 0} rows`;
      case 'batch_delete':
        return `Batch deleted ${action.data.primaryKeyValues?.length || 0} rows`;
      case 'batch_duplicate':
        return `Duplicated ${action.data.rows?.length || 0} rows`;
      default:
        return 'Unknown action';
    }
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="h-12 border-b border-border flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Transaction History</h3>
          <Badge variant="secondary" className="text-xs">
            {history.length}
          </Badge>
        </div>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearHistory(tableKey)}
            className="h-7 text-xs"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Undo/Redo Controls */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onUndo}
            disabled={!canUndo}
            className="flex-1 h-8"
          >
            <Undo2 className="h-3.5 w-3.5 mr-1.5" />
            Undo
            {canUndo && (
              <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                Ctrl+Z
              </Badge>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRedo}
            disabled={!canRedo}
            className="flex-1 h-8"
          >
            <Redo2 className="h-3.5 w-3.5 mr-1.5" />
            Redo
            {canRedo && (
              <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                Ctrl+Y
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* History List */}
      <ScrollArea className="flex-1">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No transaction history</p>
            <p className="text-xs text-muted-foreground mt-1">
              Changes will appear here
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {sortedHistory.map((action, index) => {
              const originalIndex = history.length - 1 - index;
              const isCurrent = originalIndex === currentIndex;
              const isFuture = originalIndex > currentIndex;
              const Icon = actionIcons[action.type];

              return (
                <div
                  key={action.id}
                  className={`
                    p-3 rounded-lg border transition-all
                    ${isCurrent
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : isFuture
                      ? 'border-border/50 bg-muted/30 opacity-50'
                      : 'border-border bg-card hover:bg-muted/30'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className={`
                        p-2 rounded-md flex-shrink-0
                        ${isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted'}
                      `}
                    >
                      <Icon className={`h-3.5 w-3.5 ${!isCurrent && actionColors[action.type]}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold truncate">
                          {actionLabels[action.type]}
                        </span>
                        {isCurrent && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {getActionDescription(action)}
                      </p>

                      {/* Timestamp */}
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(action.timestamp, { addSuffix: true })}
                        </span>
                      </div>

                      {/* SQL Preview (collapsible) */}
                      {action.undoSql && (
                        <details className="mt-2">
                          <summary className="text-[10px] text-muted-foreground cursor-pointer flex items-center gap-1 hover:text-foreground">
                            <ChevronDown className="h-3 w-3" />
                            View SQL
                          </summary>
                          <code className="block mt-1 p-2 bg-muted/50 rounded text-[10px] font-mono overflow-x-auto">
                            {isFuture ? action.redoSql : action.undoSql}
                          </code>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {history.length > 0 && (
        <>
          <Separator />
          <div className="p-3 text-[10px] text-muted-foreground text-center">
            Max {history.length}/50 transactions stored
          </div>
        </>
      )}
    </div>
  );
}
