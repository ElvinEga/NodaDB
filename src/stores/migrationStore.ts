import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MigrationRecord } from "@/types";

interface MigrationStore {
  migrations: MigrationRecord[];
  saveMigration: (migration: MigrationRecord) => void;
  removeMigration: (id: string) => void;
  getMigrationsForConnection: (connectionId: string) => MigrationRecord[];
}

export const useMigrationStore = create<MigrationStore>()(
  persist(
    (set, get) => ({
      migrations: [],
      saveMigration: (migration) =>
        set((state) => ({
          migrations: state.migrations.some((item) => item.id === migration.id)
            ? state.migrations.map((item) =>
                item.id === migration.id ? migration : item,
              )
            : [...state.migrations, migration].sort(
                (a, b) => a.createdAt - b.createdAt,
              ),
        })),
      removeMigration: (id) =>
        set((state) => ({
          migrations: state.migrations.filter((migration) => migration.id !== id),
        })),
      getMigrationsForConnection: (connectionId) =>
        get().migrations
          .filter((migration) => migration.connectionId === connectionId)
          .sort((a, b) => a.createdAt - b.createdAt),
    }),
    {
      name: "nodadb-migrations-storage",
    },
  ),
);
