# Changelog

All notable changes to NodaDB will be documented in this file.

## [0.1.0] - 2024-01-13

### Added

#### Phase 1: Foundation
- Initial project setup with Tauri 2, React 19, TypeScript, and Bun
- Tailwind CSS 3.4 integration with shadcn/ui component library
- Rust backend with SQLx for database connectivity
- Support for SQLite, PostgreSQL, and MySQL databases
- Connection manager with dialog-based UI
- File picker for SQLite database files
- Connection pooling for performance
- State management with Zustand

#### Phase 2: Core Features
- **Database Explorer**:
  - Tree view navigation showing all tables
  - Collapsible database sections
  - Refresh functionality
  - Table count display
  - Quick table selection

- **Table Data Viewer**:
  - Paginated data grid (50 rows per page)
  - Column metadata display (type, constraints, PK)
  - NULL value handling and formatting
  - Navigation controls (Previous/Next)
  - Row numbering
  - Horizontal scrolling for wide tables

- **SQL Query Editor**:
  - Monaco Editor integration (VS Code engine)
  - SQL syntax highlighting
  - Ctrl+Enter keyboard shortcut for execution
  - Real-time query results display
  - Execution time tracking
  - Error message display with details
  - Tabbed interface (Tables/Query views)
  - Results export:
    - Copy to clipboard as CSV
    - Download as CSV file
  - Results and Messages tabs

### Technical Details
- Frontend built with React 19 and TypeScript
- Bun used as package manager (replacing npm)
- Vite 7 for fast development and building
- Monaco Editor for code editing
- Lucide React for icons
- shadcn/ui components (Button, Input, Card, Dialog, Select, Table, Tabs, ScrollArea, Dropdown, Sonner)
- Rust backend using:
  - Tauri 2.8
  - SQLx 0.7 with runtime-tokio-rustls
  - Serde for serialization
  - Chrono for time handling
  - Anyhow for error handling

### Project Structure
- Modular Rust architecture (commands, database, models)
- Component-based React architecture
- Type-safe communication between frontend and backend
- Async command system for non-blocking UI

## [Unreleased]

### Planned
- CRUD operations (Insert, Update, Delete rows)
- Schema designer (Create, Alter, Drop tables)
- Query history and favorites
- Inline table editing
- Import/Export (CSV, JSON, SQL)
- Additional keyboard shortcuts
- Theme customization (Dark/Light mode)
- Connection management improvements
- Performance optimizations
