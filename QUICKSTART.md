# NodaDB Quick Start Guide

Get up and running with NodaDB in minutes!

## Prerequisites

Before you begin, make sure you have:

- **Bun** installed (https://bun.sh)
- **Rust** (latest stable) - Install from https://rustup.rs
- **System dependencies for Tauri** (varies by OS)

### Linux Dependencies

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

### macOS Dependencies

```bash
xcode-select --install
```

### Windows Dependencies

- Install Microsoft Edge WebView2 (usually pre-installed on Windows 10+)

## Installation

1. **Clone the repository** (or use the existing directory):
   ```bash
   cd /home/snakeos/Development/rust/NodaDB
   ```

2. **Install frontend dependencies**:
   ```bash
   bun install
   ```

3. **Run the development server**:
   ```bash
   bun run tauri dev
   ```

That's it! The app should launch automatically.

## First Steps

### 1. Connect to a SQLite Database

The easiest way to get started is with SQLite:

1. Click **"New Connection"** in the top-right
2. Enter a name (e.g., "My First DB")
3. Keep "SQLite" selected
4. Click **"Browse"** to select a `.db` file
   - Don't have one? Create a test database (see below)
5. Click **"Connect"**

### 2. Creating a Test SQLite Database

If you don't have a SQLite database, create one quickly:

```bash
# Install sqlite3 if needed
sudo apt install sqlite3  # Linux
# or brew install sqlite3  # macOS

# Create a test database
sqlite3 test.db << 'EOF'
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (name, email) VALUES 
    ('Alice Johnson', 'alice@example.com'),
    ('Bob Smith', 'bob@example.com'),
    ('Charlie Brown', 'charlie@example.com');

CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER DEFAULT 0
);

INSERT INTO products (name, price, stock) VALUES
    ('Laptop', 999.99, 15),
    ('Mouse', 29.99, 50),
    ('Keyboard', 79.99, 30);
EOF

echo "Test database created at: $(pwd)/test.db"
```

### 3. Explore Your Database

Once connected:

1. **View Tables**: See all tables in the left sidebar
2. **Browse Data**: Click a table to see its data
3. **Navigate**: Use Previous/Next buttons to browse pages
4. **See Structure**: Column types and constraints are displayed

### 4. Run SQL Queries

1. Click the **"Query"** tab at the top
2. Write your SQL query in the editor
3. Press **Ctrl+Enter** (or click "Execute")
4. See results below the editor

Example queries to try:

```sql
-- Get all users
SELECT * FROM users;

-- Count products
SELECT COUNT(*) as total FROM products;

-- Join example (if you have the test DB above)
SELECT 'user' as type, name FROM users
UNION ALL
SELECT 'product' as type, name FROM products;

-- Get users created today
SELECT * FROM users 
WHERE date(created_at) = date('now');
```

### 5. Export Results

After running a query:
- Click **"Copy"** to copy results as CSV
- Click **"Download"** to save as a CSV file

## Keyboard Shortcuts

- **Ctrl+Enter**: Execute query (in Query Editor)
- All standard text editing shortcuts work in the editor

## Common Tasks

### Connect to PostgreSQL

1. Click "New Connection"
2. Select "PostgreSQL"
3. Fill in:
   - Name: "My Postgres DB"
   - Host: localhost (or IP address)
   - Port: 5432 (default)
   - Username: postgres
   - Password: your_password
   - Database: your_database
4. Click "Connect"

### Connect to MySQL

1. Click "New Connection"
2. Select "MySQL"
3. Fill in:
   - Name: "My MySQL DB"
   - Host: localhost
   - Port: 3306 (default)
   - Username: root
   - Password: your_password
   - Database: your_database
4. Click "Connect"

## Troubleshooting

### "Failed to connect to database"

**SQLite:**
- Check that the file path is correct
- Ensure you have read permissions for the file

**PostgreSQL/MySQL:**
- Verify the server is running
- Check credentials
- Ensure the database exists
- Check firewall settings

### "Command not found: bun"

Install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
```

### Monaco Editor Not Loading

The Monaco editor requires internet connection on first load (for CDN resources). After first load, it should work offline.

## Building for Production

```bash
bun run tauri build
```

The built application will be in `src-tauri/target/release/bundle/`

## Next Steps

- Explore the **Table Viewer** for browsing data
- Use the **Query Editor** for complex SQL operations
- Try different database types (SQLite, PostgreSQL, MySQL)
- Check out the full [README.md](README.md) for more features

## Getting Help

- Check [CHANGELOG.md](CHANGELOG.md) for latest features
- Read the [README.md](README.md) for detailed documentation
- Open an issue on GitHub if you encounter problems

## Development

To contribute or customize:

1. Frontend code is in `src/`
2. Backend code is in `src-tauri/src/`
3. Run tests: `bun test` (frontend) and `cargo test` (backend)
4. Build: `bun run build` (frontend) and `cargo build` (backend)

Enjoy using NodaDB! 🚀
