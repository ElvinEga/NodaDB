import { produce } from 'immer';

export interface TableHeader {
  name: string;
}

export interface TableRow {
  raw: Record<string, any>;
  change?: Record<string, any>;
}

type ChangeCallback = () => void;

export class TableState {
  private headers: TableHeader[] = [];
  private data: TableRow[] = [];
  private focus: { y: number; x: number } | null = null;
  private selection: { y1: number; x1: number; y2: number; x2: number } | null = null;

  private changeListeners: Set<ChangeCallback> = new Set();
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(headers: TableHeader[], data: Record<string, any>[]) {
    this.headers = headers;
    this.data = data.map(row => ({ raw: row }));
  }

  getHeaders = () => this.headers;
  getRows = () => this.data;
  getRowCount = () => this.data.length;
  getValue = (y: number, x: number) => {
    const headerName = this.headers[x]?.name;
    if (!headerName) return null;
    const row = this.data[y];
    return row.change?.[headerName] ?? row.raw[headerName];
  };

  setFocus = (y: number, x: number) => {
    this.focus = { y, x };
    this.selection = { y1: y, x1: x, y2: y, x2: x };
    this.broadcastChange();
  };

  getFocus = () => this.focus;

  setSelection = (y2: number, x2: number) => {
    if (!this.focus) return;
    this.selection = {
      y1: this.focus.y,
      x1: this.focus.x,
      y2,
      x2,
    };
    this.broadcastChange(false);
  };
  
  getSelection = () => this.selection;
  
  isCellSelected = (y: number, x: number): boolean => {
    if (!this.selection) return false;
    const { y1, x1, y2, x2 } = this.selection;
    return y >= Math.min(y1, y2) && y <= Math.max(y1, y2) &&
           x >= Math.min(x1, x2) && x <= Math.max(x1, x2);
  };

  addChangeListener = (callback: ChangeCallback) => {
    this.changeListeners.add(callback);
  };
  
  removeChangeListener = (callback: ChangeCallback) => {
    this.changeListeners.delete(callback);
  };

  private broadcastChange = (instant: boolean = true) => {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const fire = () => {
      this.changeListeners.forEach(cb => cb());
    };

    if (instant) {
      fire();
    } else {
      this.debounceTimer = setTimeout(fire, 5);
    }
  };
}
