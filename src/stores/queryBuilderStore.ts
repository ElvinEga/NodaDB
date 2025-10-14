import { create } from 'zustand';
import { QueryBuilderState, QueryTable, QueryJoin, SelectedColumn, WhereCondition, OrderByClause } from '@/types';

interface QueryBuilderStore extends QueryBuilderState {
  addTable: (table: QueryTable) => void;
  removeTable: (tableId: string) => void;
  updateTablePosition: (tableId: string, position: { x: number; y: number }) => void;
  updateTableAlias: (tableId: string, alias: string) => void;
  
  addJoin: (join: QueryJoin) => void;
  removeJoin: (joinId: string) => void;
  updateJoin: (joinId: string, updates: Partial<QueryJoin>) => void;
  
  addSelectedColumn: (column: SelectedColumn) => void;
  removeSelectedColumn: (columnId: string) => void;
  updateSelectedColumn: (columnId: string, updates: Partial<SelectedColumn>) => void;
  
  addWhereCondition: (condition: WhereCondition) => void;
  removeWhereCondition: (conditionId: string) => void;
  updateWhereCondition: (conditionId: string, updates: Partial<WhereCondition>) => void;
  
  addOrderBy: (orderBy: OrderByClause) => void;
  removeOrderBy: (column: string) => void;
  
  setLimit: (limit?: number) => void;
  setDistinct: (distinct: boolean) => void;
  
  reset: () => void;
}

const initialState: QueryBuilderState = {
  tables: [],
  joins: [],
  selectedColumns: [],
  whereConditions: [],
  orderBy: [],
  limit: undefined,
  distinct: false,
};

export const useQueryBuilderStore = create<QueryBuilderStore>((set) => ({
  ...initialState,
  
  addTable: (table) =>
    set((state) => ({
      tables: [...state.tables, table],
    })),
  
  removeTable: (tableId) =>
    set((state) => ({
      tables: state.tables.filter((t) => t.id !== tableId),
      selectedColumns: state.selectedColumns.filter((c) => c.tableId !== tableId),
      joins: state.joins.filter((j) => j.leftTable !== tableId && j.rightTable !== tableId),
    })),
  
  updateTablePosition: (tableId, position) =>
    set((state) => ({
      tables: state.tables.map((t) =>
        t.id === tableId ? { ...t, position } : t
      ),
    })),
  
  updateTableAlias: (tableId, alias) =>
    set((state) => ({
      tables: state.tables.map((t) =>
        t.id === tableId ? { ...t, alias } : t
      ),
    })),
  
  addJoin: (join) =>
    set((state) => ({
      joins: [...state.joins, join],
    })),
  
  removeJoin: (joinId) =>
    set((state) => ({
      joins: state.joins.filter((j) => j.id !== joinId),
    })),
  
  updateJoin: (joinId, updates) =>
    set((state) => ({
      joins: state.joins.map((j) =>
        j.id === joinId ? { ...j, ...updates } : j
      ),
    })),
  
  addSelectedColumn: (column) =>
    set((state) => ({
      selectedColumns: [...state.selectedColumns, column],
    })),
  
  removeSelectedColumn: (columnId) =>
    set((state) => ({
      selectedColumns: state.selectedColumns.filter((c) => c.id !== columnId),
    })),
  
  updateSelectedColumn: (columnId, updates) =>
    set((state) => ({
      selectedColumns: state.selectedColumns.map((c) =>
        c.id === columnId ? { ...c, ...updates } : c
      ),
    })),
  
  addWhereCondition: (condition) =>
    set((state) => ({
      whereConditions: [...state.whereConditions, condition],
    })),
  
  removeWhereCondition: (conditionId) =>
    set((state) => ({
      whereConditions: state.whereConditions.filter((c) => c.id !== conditionId),
    })),
  
  updateWhereCondition: (conditionId, updates) =>
    set((state) => ({
      whereConditions: state.whereConditions.map((c) =>
        c.id === conditionId ? { ...c, ...updates } : c
      ),
    })),
  
  addOrderBy: (orderBy) =>
    set((state) => ({
      orderBy: [...state.orderBy, orderBy],
    })),
  
  removeOrderBy: (column) =>
    set((state) => ({
      orderBy: state.orderBy.filter((o) => o.column !== column),
    })),
  
  setLimit: (limit) => set({ limit }),
  
  setDistinct: (distinct) => set({ distinct }),
  
  reset: () => set(initialState),
}));
