# AGENTS.md - NodaDB Development Guide

This file provides guidelines and commands for agentic coding agents working on NodaDB.

## Project Overview

NodaDB is a cross-platform database management tool built with Tauri 2, React 19, and Rust. It supports SQLite, PostgreSQL, and MySQL databases.

## Build Commands

### Frontend (React + TypeScript + Vite)

```bash
# Development with hot reload
bun run dev

# Production build (runs type check + vite build)
bun run build

# Preview production build locally
bun run preview
```

### Tauri Application

```bash
# Development (runs frontend dev server + Tauri dev window)
bun run tauri dev

# Production build (creates installers for all platforms)
bun run tauri build
```

### Rust Backend

```bash
# From src-tauri directory
cd src-tauri

# Check code without building
cargo check

# Build the Rust library
cargo build

# Run tests (if any exist)
cargo test

# Lint with clippy
cargo clippy
```

## Code Style Guidelines

### TypeScript / React (Frontend)

**Imports & Path Aliases**
- Use path alias `@/` for imports from `src/` directory
- Example: `import { Button } from "@/components/ui/button";`
- Do not use relative paths like `../../components/...`

**Component Naming & Structure**
- Components: PascalCase (e.g., `DatabaseExplorer`, `TableRow`)
- Hooks: camelCase with `use` prefix (e.g., `useTableState`, `useMultiCellSelection`)
- Variables & Functions: camelCase (e.g., `connectionStore`, `formatRowCount`)
- Constants: SCREAMING_SNAKE_CASE (e.g., `MAX_ROWS_PER_PAGE`)
- Files: Match exported component name (e.g., `Button.tsx` exports `Button`)

**React Patterns**
- Use function components with TypeScript interfaces for props
- Use `React.forwardRef` when component needs to accept ref
- Use named exports for components and default exports for pages
- Use `useCallback`, `useMemo` for performance optimization
- Use `useEffect` with proper cleanup (return cleanup function)

**Styling**
- Use Tailwind CSS with shadcn/ui components
- Use `cn()` utility from `@/lib/utils` for class merging
- Use `cva` (class-variance-authority) for component variants
- Example:
  ```typescript
  import { cn } from "@/lib/utils";
  import { cva, type VariantProps } from "class-variance-authority";

  const buttonVariants = cva("inline-flex items-center...", {
    variants: { variant: { default: "bg-primary...", ... }, size: {...} },
  });
  ```

**State Management**
- Use Zustand stores in `src/stores/` for global state
- Use `persist` middleware for persistent storage
- Example:
  ```typescript
  import { create } from 'zustand';
  import { persist } from 'zustand/middleware';

  export const useConnectionStore = create<ConnectionStore>()(
    persist((set, get) => ({ ... }), { name: 'nodadb-connections-storage' })
  );
  ```

**Error Handling**
- Use `try/catch` with toast notifications via `sonner`
- Log errors to console with descriptive messages
- Example:
  ```typescript
  try {
    await someAsyncOperation();
    toast.success("Operation completed");
  } catch (error) {
    toast.error(`Failed: ${error}`);
    console.error("Operation error:", error);
  }
  ```

**TypeScript Strictness**
- Enable `strict: true` in tsconfig.json
- Define types in `@/types/index.ts`
- Use explicit interfaces rather than `any`
- Do NOT use `@ts-ignore`, `as any`, or `@ts-expect-error`

### Rust (Backend)

**Naming Conventions**
- Variables & Functions: snake_case (e.g., `list_tables`, `connection_id`)
- Types & Structs: PascalCase (e.g., `ConnectionManager`, `DatabasePool`)
- Constants: SCREAMING_SNAKE_CASE
- Modules: snake_case (e.g., `database`, `ssh_tunnel`)

**Error Handling**
- Use `anyhow` crate for error handling
- Return `Result<T, anyhow::Error>` from functions
- Use `?` operator for error propagation
- Use `anyhow!()` macro or `anyhow::anyhow!()` for creating errors
- Example:
  ```rust
  use anyhow::{Result, anyhow};

  pub async fn connect(&self, config: ConnectionConfig) -> Result<()> {
      let pool = sqlx::SqlitePool::connect(&connection_string).await?;
      Ok(())
  }
  ```

**Async & Concurrency**
- Use `tokio` for async runtime
- Use `Arc<RwLock<T>>` for shared mutable state
- Use `async/await` with proper error handling

**Macros & Patterns**
- Custom macros are defined in `database/mod.rs`:
  - `process_rows!`: Process query result rows into JSON
  - `execute_query!`: Execute SQL and return rows affected

**SQLx Patterns**
- Use type-safe SQL queries with sqlx
- Use `sqlx::query()` with `.fetch_all()`, `.fetch_one()`, `.execute()`
- Use `try_get::<T>()` with fallbacks using `.unwrap_or()` or `.ok()`

## Architecture

```
NodaDB/
├── src/                      # React frontend
│   ├── components/           # UI components
│   │   ├── ui/              # shadcn/ui base components
│   │   └── *.tsx            # Feature components
│   ├── lib/                 # Utilities & helpers
│   ├── stores/              # Zustand state stores
│   ├── hooks/               # Custom React hooks
│   └── types/               # TypeScript type definitions
├── src-tauri/               # Rust backend
│   └── src/
│       ├── commands/        # Tauri command handlers
│       ├── database/        # Connection management & queries
│       ├── models/          # Data structures
│       └── ssh_tunnel.rs    # SSH tunnel implementation
└── package.json             # Bun + Tauri scripts
```

## Communication with Backend

Frontend communicates with Rust backend via Tauri invoke:

```typescript
import { invoke } from "@tauri-apps/api/core";

// Invoke a Rust command
const result = await invoke<ReturnType>("command_name", {
  connectionId: connection.id,
  query: "SELECT * FROM users",
});
```

Rust commands are decorated with `#[tauri::command]` in `src-tauri/src/commands/mod.rs`.

## Important Notes

1. **No existing tests**: The project currently has no test suite. Consider adding tests when implementing new features.
2. **Visual changes**: Delegate all UI/styling changes to frontend specialists.
3. **Type safety**: Never suppress TypeScript errors. Fix the root cause.
4. **Error messages**: Provide descriptive error messages that help users understand what went wrong.
5. **Console logging**: Include context in console.error() calls for debugging.
