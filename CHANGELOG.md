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

## [0.2.0] - 2024-01-13

### Added - Phase 3: CRUD Operations

#### Backend Commands
- **Insert Row**: `insert_row` command for adding new rows
  - JSON data support
  - Type-safe value conversion
  - SQL escaping for strings
  - NULL value handling

- **Update Row**: `update_row` command for modifying existing rows
  - WHERE clause-based updates
  - JSON data with field selection
  - Primary key identification
  - Rows affected count

- **Delete Rows**: `delete_rows` command for removing rows
  - WHERE clause-based deletion
  - Batch deletion support
  - Primary key-based operations
  - Confirmation required

#### Frontend Components
- **AddRowDialog**:
  - Dynamic form generation from table structure
  - Type-aware input fields (number, text, date, boolean)
  - Primary key auto-generation support
  - Nullable field handling
  - Default value support
  - Form validation
  - Success callback for refresh

- **Enhanced TableDataViewer**:
  - **Row Selection**:
    - Checkbox per row
    - Select all/deselect all
    - Visual highlight for selected rows
    - Selection count display
  
  - **Inline Editing**:
    - Double-click any cell to edit
    - Enter to save changes
    - Escape to cancel
    - Save button for confirmation
    - Type-safe updates
    - Auto-refresh after save
  
  - **Delete Operations**:
    - Delete button (shows count)
    - Batch delete selected rows
    - Browser confirmation dialog
    - Primary key-based deletion
    - Error handling
  
  - **Additional Features**:
    - Add Row button (opens dialog)
    - Refresh button to reload data
    - Improved header layout
    - Selected count in stats

### Technical Changes
- Added 3 new Rust commands to backend
- Enhanced ConnectionManager with CRUD methods
- SQL query generation with proper escaping
- WHERE clause construction for updates/deletes
- Type conversion for JSON data
- Error handling improvements

## [Unreleased]

### Planned
- Schema designer (Create, Alter, Drop tables)
- Query history and favorites
- Inline table editing
- Import/Export (CSV, JSON, SQL)
- Additional keyboard shortcuts
- Theme customization (Dark/Light mode)
- Connection management improvements
- Performance optimizations
