# NodaDB

A modern, cross-platform database management tool built with Tauri 2, React, and Rust.

## Screenshots

![NodaDB Screenshot](screenshots/screenshot.png)

![NodaDB Dark Mode](screenshots/screenshot_dark.png)

## Features

- **Multi-Database Support** - Connect to SQLite, PostgreSQL, and MySQL
- **Visual Table Explorer** - Browse and navigate database schemas
- **SQL Query Editor** - Monaco-powered editor with syntax highlighting
- **CRUD Operations** - Insert, update, and delete rows with inline editing
- **Schema Designer** - Create and modify tables visually, inspect real relationships, and export schema SQL
- **Visual Query Builder** - Build queries with a node-based interface
- **Foreign Key Management** - Create, inspect, and drop foreign key constraints across supported databases
- **Database Migrations** - Save manual up/down SQL migrations per connection and apply or rollback them in-app
- **Query History** - Track, search, and favorite your queries
- **Export Data** - Download results as CSV
- **Connection Picker** - Switch quickly from the current database pill or browse all saved connections
- **In-App Auto Updates** - Check release notes, download signed updates, and restart into the latest version

## Tech Stack

**Frontend:** React 19, TypeScript, Tailwind CSS, shadcn/ui, Monaco Editor  
**Backend:** Rust, Tauri 2, SQLx, Tokio  
**Runtime:** Bun

## Getting Started

### Prerequisites

- Bun (JavaScript runtime)
- Rust (latest stable)
- System dependencies for Tauri:
  - **Linux:** `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`, `libssl-dev`, `pkg-config`, `libxdo-dev`
  - **macOS:** Xcode command line tools
  - **Windows:** WebView2

### Installation

```bash
# Clone repository
git clone <repository-url>
cd NodaDB

# Install dependencies
bun install

# Run in development
bun run tauri dev

# Build for production
bun run tauri build
```

### macOS Icon Setup (Liquid Glass)

For macOS 26+ Liquid Glass icon support, you need to manually generate an `Assets.car` file:

1. **Verify actool is available:**
   ```bash
   xcrun actool --version
   ```

2. **Check your `.icon` file:**
   ```bash
   find src-tauri/icons/AppIcon.icon -maxdepth 3 -type f -print
   ```

3. **Generate Assets.car manually:**
   ```bash
   rm -rf /tmp/nodadb-icon-out
   mkdir -p /tmp/nodadb-icon-out

   xcrun actool \
     src-tauri/icons/AppIcon.icon \
     --compile /tmp/nodadb-icon-out \
     --output-format human-readable-text \
     --notices \
     --warnings \
     --errors \
     --output-partial-info-plist /tmp/nodadb-icon-out/assetcatalog_generated_info.plist \
     --app-icon AppIcon \
     --include-all-app-icons \
     --enable-on-demand-resources NO \
     --development-region en \
     --target-device mac \
     --minimum-deployment-target 26.0 \
     --platform macosx
   ```

4. **Copy generated Assets.car to icons folder:**
   ```bash
   cp /tmp/nodadb-icon-out/Assets.car src-tauri/icons/Assets.car
   ```

5. **Update `tauri.conf.json`:**
   ```json
   {
     "bundle": {
       "icon": [
         "icons/32x32.png",
         "icons/128x128.png",
         "icons/128x128@2x.png",
         "icons/icon.icns",
         "icons/icon.ico",
         "icons/Assets.car"
       ]
     }
   }
   ```

   **Important:** Remove `icons/AppIcon.icon` from the bundle config if you encounter actool errors.

6. **Rebuild:**
   ```bash
   rm -rf src-tauri/target
   bun run tauri build
   ```

The built app bundle should now contain both `Assets.car` (for Liquid Glass) and `icon.icns` (fallback).

## Usage

### Connect to Database

1. Click the **+** button to open your saved connections list
2. Either:
   - select an existing saved connection, or
   - click **Add New Connection** to open the connection form
3. Enter connection details:
   - **SQLite:** Browse and select `.db` file
   - **PostgreSQL/MySQL:** Enter host, port, credentials
4. Click **Connect**

### Switch Between Saved Connections

- Click the current database pill in the top bar to open recent connections
- Select a recent connection to reconnect immediately
- Use **Browse all connections** to open the full saved-connections screen

### Browse and Edit Data

- Click tables in the sidebar to view data
- **Insert:** Click "Add Row" button
- **Update:** Double-click any cell to edit
- **Delete:** Select rows and click "Delete"
- Navigate with pagination controls

### Execute SQL Queries

- Switch to "Query" tab
- Write SQL in the editor
- Press `Ctrl+Enter` to execute
- Export results as CSV

### Manage Schema

- Hover over tables for context menu
- Create new tables with visual designer
- Add columns, primary keys, and foreign key relationships
- Open the foreign key manager from the explorer toolbar to inspect or drop relationships
- Drop or rename tables

### Run Database Migrations

- Open the migrations manager from the explorer toolbar
- Save manual **up** and **down** SQL scripts per connection
- Apply pending migrations into the target database
- Roll back the latest applied migration when needed

### Query History

- All queries saved automatically
- Search and filter history
- Star favorites
- Re-run queries with one click

### App Updates

- Open **Settings → Updates** or **Help → About NodaDB** to:
  - check for updates
  - read the latest changelog
  - download and install the newest desktop build
- On startup, NodaDB can check for updates automatically and notify you when a new release is available

## Keyboard Shortcuts

- `Ctrl+Enter` - Execute query
- `Ctrl+Shift+C` - Open saved connections list
- `Enter` - Save cell edit
- `Escape` - Cancel edit
- `Double-click` - Edit cell

## Project Structure

```
NodaDB/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── stores/            # State management
│   └── types/             # TypeScript types
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── commands/      # Tauri commands
│   │   ├── database/      # Connection logic
│   │   └── models/        # Data structures
│   └── Cargo.toml
└── package.json
```

## Roadmap

- [x] Multi-database connections
- [x] Table viewer with pagination
- [x] SQL query editor
- [x] CRUD operations
- [x] Schema designer
- [x] Visual query builder
- [x] Query history
- [x] In-app desktop updates
- [x] Data filtering and sorting
- [x] Foreign key management
- [x] ERD visualization
- [x] Dark/light theme toggle
- [x] Database migrations

## Release Updates

NodaDB uses signed GitHub Release artifacts for desktop updates.

To publish an update:

1. Bump app versions consistently in:
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`
2. Ensure GitHub Actions secrets are set:
   - `TAURI_SIGNING_PRIVATE_KEY`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
3. For notarized macOS releases, set `ENABLE_APPLE_NOTARIZATION=true` and also provide:
   - `APPLE_CERTIFICATE`
   - `APPLE_CERTIFICATE_PASSWORD`
   - `APPLE_SIGNING_IDENTITY`
   - `APPLE_ID`
   - `APPLE_PASSWORD`
   - `APPLE_TEAM_ID`
4. Push a version tag:

```bash
git tag v0.2.8
git push origin v0.2.8
```

The release workflow builds platform installers, notarizes macOS builds only when `ENABLE_APPLE_NOTARIZATION=true` and all Apple secrets are configured, falls back to ad-hoc signing otherwise, verifies the app is not linked against Homebrew dylibs, generates updater artifacts such as `latest.json`, and publishes them to GitHub Releases.

## Contributing

Contributions welcome! Fork the repo, create a feature branch, and submit a PR.

## License

MIT

## Acknowledgments

Built with [Tauri](https://tauri.app/), [shadcn/ui](https://ui.shadcn.com/), and [SQLx](https://github.com/launchbadge/sqlx).
