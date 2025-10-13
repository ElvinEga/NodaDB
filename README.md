# NodaDB

A modern, cross-platform database management desktop application built with Tauri 2, React, TypeScript, and Rust.

## Features

### ✅ Implemented (Phases 1, 2 & 3 Complete)

#### Core Infrastructure
- **Modern UI**: Built with React 19, TypeScript, Tailwind CSS 3.4, and shadcn/ui components
- **Multi-Database Support**: Connect to SQLite, PostgreSQL, and MySQL databases
- **Connection Manager**: 
  - Create and manage multiple database connections
  - Support for both file-based (SQLite) and server-based (PostgreSQL, MySQL) databases
  - Native file picker for SQLite databases
  - Secure connection handling with pooling
- **Tauri 2 Backend**: 
  - Rust-powered backend using SQLx for database operations
  - Type-safe database interactions
  - Async command system for responsive UI
  - Connection pooling for performance

#### Database Explorer
- **Tree View Navigation**: 
  - Browse all tables in connected database
  - Collapsible/expandable database view
  - Quick table selection
  - Refresh functionality
  - Table count display

#### Table Data Viewer
- **Interactive Data Grid**:
  - View table data in a clean, paginated table
  - Column metadata display (data type, constraints, primary keys)
  - NULL value handling
  - 50 rows per page with navigation
  - Row numbering
  - Horizontal scrolling for wide tables
  - Automatic data type formatting

#### SQL Query Editor
- **Monaco-Powered Editor**:
  - Full SQL syntax highlighting (same engine as VS Code)
  - Execute queries with Ctrl+Enter keyboard shortcut
  - Tabbed interface (Tables/Query views)
  - Real-time query results display
  - Execution time tracking
  - Error messages with details
  - Export results:
    - Copy to clipboard as CSV
    - Download as CSV file
  - Results and Messages tabs for detailed feedback

#### CRUD Operations
- **Insert Rows**:
  - Add new rows dialog with form validation
  - Auto-generate form fields from table structure
  - Type-aware input fields (number, text, date, boolean)
  - Primary key auto-generation support
  - NULL value handling
  - Default value support

- **Update Rows**:
  - Inline cell editing (double-click to edit)
  - Enter to save, Escape to cancel
  - Save button for confirmation
  - Type-safe value updates
  - Automatic refresh after update

- **Delete Rows**:
  - Row selection with checkboxes
  - Select all/deselect all
  - Batch delete multiple rows
  - Confirmation dialog before deletion
  - Delete button shows count of selected rows
  - Primary key-based deletion

- **Additional Features**:
  - Refresh button to reload data
  - Row highlighting for selected rows
  - Visual feedback during operations
  - Error handling with user-friendly messages
  - Automatic data refresh after mutations

#### Schema Designer (Phase 4) 🆕
- **Visual Table Creator**:
  - Drag-and-drop column designer
  - Database-specific data types (SQLite, PostgreSQL, MySQL)
  - Primary key and NULL constraints
  - Real-time validation
  - Create tables without writing SQL
  
- **Table Management**:
  - Drop tables with confirmation
  - Rename tables
  - Add columns to existing tables (ALTER TABLE)
  - Context menus on table hover
  - Plus button to create new tables

#### Query History (Phase 4) 🆕
- **Automatic Tracking**:
  - Every query saved automatically
  - Success and failure tracking
  - Execution time metrics
  - Rows returned count
  - Error message capture
  
- **History Management**:
  - Search queries by text or connection
  - Filter tabs (All/Favorites/Success/Failed)
  - Star/favorite important queries
  - Re-run queries with one click
  - Delete individual entries
  - Clear history (keeps favorites)
  - LocalStorage persistence (500 queries max)
  - Statistics display (total, avg time)

### 📋 Planned Features (Phase 5+)

- Table data filtering (WHERE clause builder)
- Column sorting in table viewer
- Import/Export CSV to tables
- Foreign key management UI
- Create indexes UI
- Visual query builder
- ERD (Entity-Relationship Diagram) visualization
- Database migration tools
- Query performance analysis
- Multi-tab query editor
- SQL formatting and beautification
- Dark/Light theme toggle

## Tech Stack

### Frontend
- **Runtime**: Bun
- **Framework**: React 19 with TypeScript
- **Styling**: Tailwind CSS 3.4 + shadcn/ui
- **Build Tool**: Vite 7
- **State Management**: Zustand
- **Code Editor**: Monaco Editor (VS Code engine)
- **Icons**: Lucide React

### Backend
- **Framework**: Tauri 2.8
- **Language**: Rust 1.89
- **Database Driver**: SQLx 0.7 (SQLite, PostgreSQL, MySQL)
- **Async Runtime**: Tokio
- **Serialization**: Serde + serde_json
- **Time Handling**: Chrono

## Getting Started

### Prerequisites

- **Bun**: JavaScript runtime and package manager
- **Rust**: Latest stable version
- **System dependencies for Tauri**: 
  - Linux: `webkit2gtk`, `libgtk-3-dev`, `libsoup2.4-dev`, etc.
  - macOS: Xcode command line tools
  - Windows: WebView2

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd NodaDB
```

2. Install frontend dependencies:
```bash
bun install
```

3. Build and run in development mode:
```bash
bun run tauri dev
```

### Building for Production

```bash
bun run tauri build
```

The built application will be in `src-tauri/target/release/bundle/`.

## Project Structure

```
NodaDB/
├── src/                          # React frontend
│   ├── components/              # React components
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── ConnectionDialog.tsx # Connection management
│   │   ├── DatabaseExplorer.tsx # Table tree view
│   │   ├── TableDataViewer.tsx  # Paginated data grid
│   │   └── QueryEditor.tsx      # Monaco-based SQL editor
│   ├── stores/                  # Zustand state management
│   │   └── connectionStore.ts   # Connection state
│   ├── types/                   # TypeScript type definitions
│   │   └── index.ts            # Database-related types
│   ├── lib/                    # Utility functions
│   │   └── utils.ts            # Class name utilities
│   ├── App.tsx                 # Main application component
│   ├── main.tsx                # React entry point
│   └── index.css               # Global styles (Tailwind)
├── src-tauri/                   # Rust backend
│   ├── src/
│   │   ├── commands/           # Tauri commands
│   │   │   └── mod.rs          # Database command handlers
│   │   ├── database/           # Database logic
│   │   │   └── mod.rs          # Connection manager
│   │   ├── models/             # Data structures
│   │   │   └── mod.rs          # Shared types
│   │   ├── lib.rs              # Library entry point
│   │   └── main.rs             # Application entry point
│   ├── Cargo.toml              # Rust dependencies
│   └── tauri.conf.json         # Tauri configuration
├── package.json                 # Frontend dependencies (Bun)
├── tailwind.config.js          # Tailwind CSS configuration
├── vite.config.ts              # Vite configuration
└── components.json             # shadcn/ui configuration
```

## Available Tauri Commands

### Connection Management
- `connect_database(config: ConnectionConfig)` - Establish a database connection
- `disconnect_database(connection_id: String)` - Close a database connection

### Schema Operations
- `list_tables(connection_id: String, db_type: DatabaseType)` - List all tables in database
- `get_table_structure(connection_id: String, table_name: String, db_type: DatabaseType)` - Get column information for a table

### Query Execution
- `execute_query(connection_id: String, query: String)` - Execute a SQL query

### CRUD Operations
- `insert_row(connection_id: String, table_name: String, data: JSON, db_type: DatabaseType)` - Insert a new row
- `update_row(connection_id: String, table_name: String, data: JSON, where_clause: String, db_type: DatabaseType)` - Update existing row(s)
- `delete_rows(connection_id: String, table_name: String, where_clause: String)` - Delete row(s)

## Usage

### 1. Create a Connection
- Click "New Connection" in the header
- Enter a connection name
- Select database type (SQLite, PostgreSQL, or MySQL)
- **For SQLite**: Click "Browse" and select a `.db` file
- **For PostgreSQL/MySQL**: Enter host, port, username, password, and database name
- Click "Connect"

### 2. Explore Database
Once connected, you'll see:
- **Left Sidebar**: Database explorer showing all tables
- **Main Area**: Tabbed interface with "Tables" and "Query" views

### 3. View and Edit Table Data
- Click any table in the explorer
- Navigate to the "Tables" tab
- Browse data with pagination (50 rows per page)
- See column metadata (type, nullable, primary key)
- Use Previous/Next buttons to navigate pages

**Editing Data:**
- **Insert**: Click "Add Row" button, fill form, click "Insert Row"
- **Update**: Double-click any cell, edit value, press Enter or click "Save"
- **Delete**: Select rows with checkboxes, click "Delete (X)" button
- **Refresh**: Click refresh icon to reload data

### 4. Execute SQL Queries
- Switch to the "Query" tab
- Write your SQL query in the Monaco editor
- Press **Ctrl+Enter** or click "Execute" to run
- View results in the results table below
- Check the "Messages" tab for execution details
- Export results:
  - Click "Copy" to copy as CSV to clipboard
  - Click "Download" to save as CSV file

### 5. Keyboard Shortcuts
- **Ctrl+Enter**: Execute current query (in Query Editor)
- **Enter**: Save cell edit (in table cell editing mode)
- **Escape**: Cancel cell edit (in table cell editing mode)
- **Double-click**: Start editing a cell (in table viewer)
- Standard text editing shortcuts work in Monaco editor

## Development Notes

### Database Support

The application uses SQLx's `Any` type for database-agnostic operations, with specific handling for:

- **SQLite**: File-based databases, PRAGMA queries for metadata
- **PostgreSQL**: information_schema queries, server-based connections
- **MySQL**: information_schema queries, server-based connections

### Type Safety

Both frontend and backend use strong typing:
- **Frontend**: TypeScript interfaces for all data structures
- **Backend**: Rust structs with Serde serialization/deserialization
- **Communication**: JSON serialization via Tauri's command system

### State Management

- **Zustand**: Lightweight state management for connections
- **React Query**: Planned for server state management (queries, tables)
- **Local Storage**: Planned for persisting connection configurations

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Roadmap

### ✅ Phase 1: Foundation (Complete)
- [x] Project setup with Tauri 2 + React + TypeScript + Bun
- [x] Tailwind CSS and shadcn/ui integration
- [x] Rust backend with SQLx
- [x] Connection manager UI
- [x] Multi-database support (SQLite, PostgreSQL, MySQL)

### ✅ Phase 2: Core Features (Complete)
- [x] Database explorer tree view with tables
- [x] SQL query editor with Monaco Editor
- [x] Execute queries and display results
- [x] Table data viewer with pagination
- [x] Export results (CSV)
- [x] Keyboard shortcuts (Ctrl+Enter)

### ✅ Phase 3: CRUD Operations (Complete)
- [x] Insert new rows into tables (Add Row dialog)
- [x] Update existing rows (double-click inline editing)
- [x] Delete rows with confirmation dialog
- [x] Batch operations (multi-row selection)
- [x] Row selection with checkboxes
- [x] Refresh data functionality
- [x] Form validation for inserts
- [x] Type-aware input fields
- [x] Primary key-based operations

### Phase 4: Advanced Features
- [ ] Schema designer for table creation/modification
- [ ] Import/Export functionality (CSV, JSON, SQL)
- [ ] Query history with search
- [ ] Syntax highlighting and auto-completion

### Phase 4: Polish & Release (Weeks 7-8)
- [ ] Keyboard shortcuts
- [ ] Theme customization
- [ ] Error handling improvements
- [ ] Testing and bug fixes
- [ ] Documentation
- [ ] Distribution packages

## License

[Add your license here]

## Acknowledgments

- [Tauri](https://tauri.app/) - Cross-platform desktop framework
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [SQLx](https://github.com/launchbadge/sqlx) - Rust SQL toolkit
- Inspired by [vscode-database-client](https://github.com/cweijan/vscode-database-client) and [DBCode](https://dbcode.io)
