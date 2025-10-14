import { useState, useMemo } from 'react';
import { Clock, Play, Copy, Trash2, Search, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useQueryHistoryStore } from '@/stores/queryHistoryStore';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface QueryHistoryPanelProps {
  connectionId?: string;
  onSelectQuery: (query: string) => void;
}

export function QueryHistoryPanel({ connectionId, onSelectQuery }: QueryHistoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const history = useQueryHistoryStore((state) => state.history);
  const removeQuery = useQueryHistoryStore((state) => state.removeQuery);
  const clearHistory = useQueryHistoryStore((state) => state.clearHistory);

  // Filter by current connection and search query
  const filteredHistory = useMemo(() => {
    let filtered = history;

    // Filter by connection if specified
    if (connectionId) {
      filtered = filtered.filter((item) => item.connectionId === connectionId);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.query.toLowerCase().includes(query) ||
          item.connectionName.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [history, connectionId, searchQuery]);

  const handleCopyQuery = (query: string) => {
    navigator.clipboard.writeText(query);
    toast.success('Query copied to clipboard');
  };

  const handleDeleteQuery = (id: string) => {
    removeQuery(id);
    toast.success('Query removed from history');
  };

  const handleClearAll = () => {
    if (confirm('Clear all query history? This cannot be undone.')) {
      clearHistory();
      toast.success('Query history cleared');
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const truncateQuery = (query: string, maxLength = 100) => {
    const normalized = query.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return normalized.substring(0, maxLength) + '...';
  };

  return (
    <div className="h-full flex flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">Query History</h2>
            {filteredHistory.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
                {filteredHistory.length}
              </span>
            )}
          </div>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-7 text-xs"
            >
              Clear All
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search queries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* History List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredHistory.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {history.length === 0 ? 'No queries executed yet' : 'No queries match your search'}
            </div>
          ) : (
            <div className="space-y-2">
              <TooltipProvider delayDuration={300}>
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="group relative rounded-md border border-border p-3 hover:bg-muted/50 transition-colors"
                  >
                    {/* Status Icon */}
                    <div className="absolute top-2 left-2">
                      {item.status === 'success' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </div>

                    {/* Query Text */}
                    <div className="pl-5 mb-2">
                      <code className="text-xs text-foreground/90 break-words">
                        {truncateQuery(item.query)}
                      </code>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
                      <span>
                        {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                      </span>
                      {item.duration && (
                        <span className="flex items-center gap-1">
                          ⏱ {formatDuration(item.duration)}
                        </span>
                      )}
                      {item.rowsAffected !== undefined && (
                        <span>{item.rowsAffected} rows</span>
                      )}
                      {!connectionId && (
                        <span className="px-1.5 py-0.5 rounded bg-secondary">
                          {item.connectionName}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => onSelectQuery(item.query)}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Run
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Load and run this query</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => handleCopyQuery(item.query)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copy query</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteQuery(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Remove from history</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Error Message */}
                    {item.error && (
                      <div className="mt-2 text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
                        {item.error}
                      </div>
                    )}
                  </div>
                ))}
              </TooltipProvider>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
