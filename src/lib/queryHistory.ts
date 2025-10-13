// Query History Management using localStorage

export interface QueryHistoryEntry {
  id: string;
  query: string;
  connectionId: string;
  connectionName: string;
  executedAt: Date;
  executionTime: number; // in milliseconds
  rowsReturned: number;
  success: boolean;
  error?: string;
  isFavorite: boolean;
}

const STORAGE_KEY = 'nodadb_query_history';
const MAX_HISTORY_SIZE = 500; // Keep last 500 queries

class QueryHistoryManager {
  private cache: QueryHistoryEntry[] = [];
  private isLoaded = false;

  private loadFromStorage(): QueryHistoryEntry[] {
    if (this.isLoaded) {
      return this.cache;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        this.cache = [];
        this.isLoaded = true;
        return this.cache;
      }

      const parsed = JSON.parse(stored);
      // Convert date strings back to Date objects
      this.cache = parsed.map((entry: any) => ({
        ...entry,
        executedAt: new Date(entry.executedAt),
      }));
      this.isLoaded = true;
      return this.cache;
    } catch (error) {
      console.error('Failed to load query history:', error);
      this.cache = [];
      this.isLoaded = true;
      return this.cache;
    }
  }

  private saveToStorage(entries: QueryHistoryEntry[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      this.cache = entries;
    } catch (error) {
      console.error('Failed to save query history:', error);
    }
  }

  addQuery(entry: Omit<QueryHistoryEntry, 'id' | 'executedAt' | 'isFavorite'>): QueryHistoryEntry {
    const history = this.loadFromStorage();
    
    const newEntry: QueryHistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      executedAt: new Date(),
      isFavorite: false,
    };

    // Add to beginning of array
    history.unshift(newEntry);

    // Trim to max size (but keep favorites)
    if (history.length > MAX_HISTORY_SIZE) {
      const favorites = history.filter((e) => e.isFavorite);
      const nonFavorites = history.filter((e) => !e.isFavorite);
      const trimmedNonFavorites = nonFavorites.slice(0, MAX_HISTORY_SIZE - favorites.length);
      this.saveToStorage([...favorites, ...trimmedNonFavorites]);
    } else {
      this.saveToStorage(history);
    }

    return newEntry;
  }

  getAll(): QueryHistoryEntry[] {
    return this.loadFromStorage();
  }

  getFavorites(): QueryHistoryEntry[] {
    return this.loadFromStorage().filter((entry) => entry.isFavorite);
  }

  getByConnection(connectionId: string): QueryHistoryEntry[] {
    return this.loadFromStorage().filter((entry) => entry.connectionId === connectionId);
  }

  search(searchTerm: string): QueryHistoryEntry[] {
    const term = searchTerm.toLowerCase();
    return this.loadFromStorage().filter(
      (entry) =>
        entry.query.toLowerCase().includes(term) ||
        entry.connectionName.toLowerCase().includes(term)
    );
  }

  toggleFavorite(id: string): void {
    const history = this.loadFromStorage();
    const entry = history.find((e) => e.id === id);
    if (entry) {
      entry.isFavorite = !entry.isFavorite;
      this.saveToStorage(history);
    }
  }

  delete(id: string): void {
    const history = this.loadFromStorage().filter((e) => e.id !== id);
    this.saveToStorage(history);
  }

  clear(): void {
    this.saveToStorage([]);
  }

  clearNonFavorites(): void {
    const favorites = this.getFavorites();
    this.saveToStorage(favorites);
  }

  getStats() {
    const history = this.loadFromStorage();
    const successful = history.filter((e) => e.success).length;
    const failed = history.filter((e) => !e.success).length;
    const avgExecutionTime =
      history.length > 0
        ? history.reduce((sum, e) => sum + e.executionTime, 0) / history.length
        : 0;

    return {
      total: history.length,
      successful,
      failed,
      favorites: history.filter((e) => e.isFavorite).length,
      avgExecutionTime: Math.round(avgExecutionTime),
    };
  }
}

export const queryHistory = new QueryHistoryManager();
