import { useState, useEffect } from 'react';
import { Star, Trash2, Play, Search, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { queryHistory, QueryHistoryEntry } from '@/lib/queryHistory';
import { toast } from 'sonner';

interface QueryHistoryProps {
  connectionId?: string;
  onQuerySelect: (query: string) => void;
}

export function QueryHistory({ connectionId, onQuerySelect }: QueryHistoryProps) {
  const [entries, setEntries] = useState<QueryHistoryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorites' | 'success' | 'failed'>('all');

  const loadHistory = () => {
    let history: QueryHistoryEntry[];
    
    if (connectionId) {
      history = queryHistory.getByConnection(connectionId);
    } else {
      history = queryHistory.getAll();
    }

    // Apply search
    if (searchTerm) {
      history = history.filter(
        (entry) =>
          entry.query.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.connectionName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply filter
    if (filter === 'favorites') {
      history = history.filter((e) => e.isFavorite);
    } else if (filter === 'success') {
      history = history.filter((e) => e.success);
    } else if (filter === 'failed') {
      history = history.filter((e) => !e.success);
    }

    setEntries(history);
  };

  useEffect(() => {
    loadHistory();
  }, [connectionId, searchTerm, filter]);

  const handleToggleFavorite = (id: string) => {
    queryHistory.toggleFavorite(id);
    loadHistory();
    toast.success('Query favorite status updated');
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this query from history?')) {
      queryHistory.delete(id);
      loadHistory();
      toast.success('Query deleted from history');
    }
  };

  const handleClearHistory = () => {
    if (confirm('Clear all non-favorite queries from history?')) {
      queryHistory.clearNonFavorites();
      loadHistory();
      toast.success('History cleared');
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  };

  const truncateQuery = (query: string, maxLength: number = 100) => {
    const normalized = query.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return normalized.substring(0, maxLength) + '...';
  };

  const stats = queryHistory.getStats();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Query History</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearHistory}
            disabled={entries.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search queries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Filters */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="favorites">
              <Star className="h-3 w-3 mr-1" />
              {stats.favorites}
            </TabsTrigger>
            <TabsTrigger value="success">
              <CheckCircle className="h-3 w-3 mr-1" />
              {stats.successful}
            </TabsTrigger>
            <TabsTrigger value="failed">
              <XCircle className="h-3 w-3 mr-1" />
              {stats.failed}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Entries */}
      <ScrollArea className="flex-1">
        {entries.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No query history</p>
            <p className="text-xs mt-1">Execute queries to see them here</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`p-3 rounded-lg border transition-colors ${
                  entry.success ? 'hover:bg-muted/50' : 'border-destructive/50 bg-destructive/5'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {entry.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground truncate">
                        {entry.connectionName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(entry.executedAt)} • {entry.executionTime}ms
                        {entry.success && ` • ${entry.rowsReturned} rows`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleToggleFavorite(entry.id)}
                    >
                      <Star
                        className={`h-3 w-3 ${
                          entry.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''
                        }`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => onQuerySelect(entry.query)}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleDelete(entry.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Query */}
                <div className="font-mono text-xs bg-muted p-2 rounded mb-2">
                  {truncateQuery(entry.query, 150)}
                </div>

                {/* Error */}
                {!entry.success && entry.error && (
                  <div className="text-xs text-destructive mt-2">
                    Error: {entry.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer Stats */}
      {entries.length > 0 && (
        <div className="p-3 border-t text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>{entries.length} queries</span>
            <span>Avg: {stats.avgExecutionTime}ms</span>
          </div>
        </div>
      )}
    </div>
  );
}
