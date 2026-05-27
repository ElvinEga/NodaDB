import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ColumnTypeFamily } from "@/types";

export interface ColumnDisplayOverride {
  connectionId: string;
  tableName: string;
  columnName: string;
  typeFamily: ColumnTypeFamily;
  source: "manual" | "suggested";
}

interface ColumnDisplayStore {
  overrides: Record<string, ColumnDisplayOverride>;
  setOverride: (override: ColumnDisplayOverride) => void;
  clearOverride: (
    connectionId: string,
    tableName: string,
    columnName: string,
  ) => void;
  getOverride: (
    connectionId: string,
    tableName: string,
    columnName: string,
  ) => ColumnDisplayOverride | null;
}

export function getColumnOverrideKey(
  connectionId: string,
  tableName: string,
  columnName: string,
): string {
  return `${connectionId}::${tableName}::${columnName}`;
}

export const useColumnDisplayStore = create<ColumnDisplayStore>()(
  persist(
    (set, get) => ({
      overrides: {},
      setOverride: (override) =>
        set((state) => ({
          overrides: {
            ...state.overrides,
            [getColumnOverrideKey(
              override.connectionId,
              override.tableName,
              override.columnName,
            )]: override,
          },
        })),
      clearOverride: (connectionId, tableName, columnName) =>
        set((state) => {
          const nextOverrides = { ...state.overrides };
          delete nextOverrides[
            getColumnOverrideKey(connectionId, tableName, columnName)
          ];
          return { overrides: nextOverrides };
        }),
      getOverride: (connectionId, tableName, columnName) =>
        get().overrides[getColumnOverrideKey(connectionId, tableName, columnName)] ?? null,
    }),
    {
      name: "column-display-overrides-storage",
    },
  ),
);
