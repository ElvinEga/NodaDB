import { produce } from 'immer';

export interface TableHeader {
  name: string;
}

export interface TableRow {
  raw: Record<string, any>;
  change?: Record<string, any>;
  isNewRow?: boolean;
  isRemoved?: boolean;
}

type ChangeCallback = () => void;

export class TableState {
  private headers: TableHeader[] = [];
  private data: TableRow[] = [];
  private focus: { y: number; x: number } | null = null;
  private selection: { y1: number; x1: number; y2: number; x2: number } | null = null;
  private columnWidths: number[];
  private editMode: { y: number; x: number } | null = null;
  private changedRows: Map<number, TableRow> = new Map();

  private changeListeners: Set<ChangeCallback> = new Set();
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(headers: TableHeader[], data: Record<string, any>[]) {
    this.headers = headers;
    this.data = data.map(row => ({ raw: row }));
    this.columnWidths = headers.map(() => 150);
  }

  getHeaders = () => this.headers;
  getRows = () => this.data;
  getRowCount = () => this.data.length;
  getColumnWidths = () => this.columnWidths;
  
  setHeaderWidth = (index: number, width: number) => {
    if (this.columnWidths[index] !== width) {
      this.columnWidths[index] = Math.max(50, width);
      this.broadcastChange();
    }
  };
  
  getValue = (y: number, x: number) => {
    const headerName = this.headers[x]?.name;
    if (!headerName) return null;
    const row = this.data[y];
    return row.change?.[headerName] ?? row.raw[headerName];
  };

  isInEditMode = () => !!this.editMode;
  getEditingCell = () => this.editMode;

  enterEditMode = (y?: number, x?: number) => {
    const targetY = y ?? this.focus?.y;
    const targetX = x ?? this.focus?.x;

    if (targetY === undefined || targetX === undefined) return;
    
    this.editMode = { y: targetY, x: targetX };
    this.broadcastChange();
  };

  exitEditMode = () => {
    this.editMode = null;
    this.broadcastChange();
  };
  
  changeValue = (y: number, x: number, newValue: any) => {
    const headerName = this.headers[x]?.name;
    if (!headerName) return;

    const row = this.data[y];
    if (!row) return;

    const oldValue = row.raw[headerName];

    if (newValue === oldValue) {
      if (row.change && headerName in row.change) {
        delete row.change[headerName];
        if (Object.keys(row.change).length === 0) {
          delete row.change;
          this.changedRows.delete(y);
        }
      }
    } else {
      if (!row.change) row.change = {};
      row.change[headerName] = newValue;
      this.changedRows.set(y, row);
    }

    this.broadcastChange();
  };

  setFocus = (y: number, x: number) => {
    this.focus = { y, x };
    this.selection = { y1: y, x1: x, y2: y, x2: x };
    this.exitEditMode();
    this.broadcastChange();
  };
  
  moveFocus = (dy: number, dx: number) => {
    if (!this.focus) {
      this.setFocus(0, 0);
      return;
    }
    
    const newY = Math.max(0, Math.min(this.getRowCount() - 1, this.focus.y + dy));
    const newX = Math.max(0, Math.min(this.getHeaders().length - 1, this.focus.x + dx));
    
    this.setFocus(newY, newX);
  };

  insertNewRow = (index: number) => {
    const newRow: TableRow = {
      isNewRow: true,
      raw: {},
      change: {},
    };
    this.data.splice(index, 0, newRow);
    this.changedRows.set(index, newRow);
    this.broadcastChange(true);
  };
  
  removeRow = (index: number) => {
    const row = this.data[index];
    if (row) {
      if (row.isNewRow) {
        this.data.splice(index, 1);
        this.changedRows.delete(index);
      } else {
        row.isRemoved = true;
        this.changedRows.set(index, row);
      }
      this.broadcastChange(true);
    }
  };

  getChangedRows = (): { index: number, row: TableRow }[] => {
    return Array.from(this.changedRows.entries()).map(([index, row]) => ({ index, row }));
  };

  getChangeCount = (): number => {
    return this.changedRows.size;
  };

  applyChanges = (updatedData: { index: number, newRaw: Record<string, any> }[]) => {
    updatedData.forEach(({ index, newRaw }) => {
      const row = this.data[index];
      if (row) {
        row.raw = newRaw;
        delete row.change;
        delete row.isNewRow;
      }
    });

    this.data = this.data.filter(row => !row.isRemoved);
    
    this.changedRows.clear();
    this.broadcastChange(true);
  };

  discardChanges = () => {
    this.data = this.data.filter(row => !row.isNewRow);
    
    this.data.forEach(row => {
      delete row.change;
      delete row.isRemoved;
    });

    this.changedRows.clear();
    this.broadcastChange(true);
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
