# Persistent Connections Implementation

## Overview
Implemented persistent connection storage using Zustand's persist middleware. Connections are now automatically saved to localStorage and restored when the app reopens.

## Changes Made

### 1. Connection Store (`stores/connectionStore.ts`)

#### Added Persist Middleware
```typescript
import { persist, createJSONStorage } from 'zustand/middleware';

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set, get) => ({
      // ... store implementation
    }),
    {
      name: 'nodadb-connections-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ connections: state.connections }),
    }
  )
);
```

#### New Features
- **Auto-save**: Connections automatically saved to localStorage on every change
- **Auto-restore**: Connections loaded from localStorage on app start
- **updateConnection()**: New method to edit existing connections
- **Confirmation dialog**: Added to `removeConnection()` for safety

### 2. App.tsx - Connection Selection Screen

#### Three-State UI Logic
```typescript
{activeConnectionId && activeConnection ? (
  // State 1: Active connection - Show main app
  <AppSidebar ... />
  <SidebarInset ... />
) : connections.length > 0 ? (
  // State 2: No active connection but saved connections exist - Show list
  <ConnectionSelectionScreen />
) : (
  // State 3: No connections at all - Show welcome screen
  <WelcomeScreen />
)}
```

#### Connection Selection Screen
- Grid layout of saved connections
- Shows connection name, database type, and connection details
- Click to activate a connection
- "Add New Connection" button
- Clean, card-based UI with hover effects

### 3. Disconnect/Switch Connection Feature

#### Header Button
- Added LogOut icon button in header
- Tooltip: "Switch Connection"
- Keyboard shortcut: `Ctrl+Shift+C`
- Calls `setActiveConnection(null)` to return to connection list

#### Keyboard Shortcut
```typescript
// Ctrl+Shift+C for Switch Connection
if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
  e.preventDefault();
  setActiveConnection(null);
}
```

## User Flow

### First Time User
1. App opens → No connections → Welcome screen
2. Click "Create Your First Connection"
3. Fill in connection details → Connect
4. Connection saved to localStorage automatically
5. Main app interface loads

### Returning User
1. App opens → Connections loaded from localStorage
2. Connection selection screen shows saved connections
3. Click a connection → Activates and opens main app
4. All tabs and state cleared when switching connections

### Switching Connections
1. Click LogOut button (or press `Ctrl+Shift+C`)
2. Returns to connection selection screen
3. Select different connection
4. New connection becomes active

### Managing Connections
- **Add**: Click "+" button or "Add New Connection"
- **Remove**: Delete button in connection list (with confirmation)
- **Update**: Use `updateConnection()` method (ready for future edit feature)

## Storage Details

### LocalStorage Key
```
nodadb-connections-storage
```

### Stored Data
```json
{
  "state": {
    "connections": [
      {
        "id": "uuid",
        "name": "My Database",
        "db_type": "sqlite",
        "file_path": "/path/to/db.sqlite",
        // ... other connection details
      }
    ]
  },
  "version": 0
}
```

### What's NOT Stored
- `activeConnectionId` - Always starts fresh (security/UX decision)
- Passwords - Stored in memory only during active session
- Tabs and UI state - Cleared on connection switch

## Benefits

### User Experience
- ✅ No need to re-enter connection details
- ✅ Quick switching between databases
- ✅ Persistent across app restarts
- ✅ Clean connection management UI

### Performance
- ✅ Instant connection list loading
- ✅ No database queries needed for connection list
- ✅ Minimal localStorage usage (only connection metadata)

### Security
- ✅ Passwords stored in memory only during active session
- ✅ Confirmation before deleting connections
- ✅ No sensitive data persisted unnecessarily

## Future Enhancements

### Planned Features
1. **Edit Connection**: Use `updateConnection()` to modify saved connections
2. **Connection Groups**: Organize connections by project/environment
3. **Recent Connections**: Show most recently used at top
4. **Connection Search**: Filter connections by name/type
5. **Import/Export**: Backup and restore connections
6. **Connection Testing**: Test connection before activating
7. **Connection Favorites**: Pin frequently used connections

### Security Enhancements
1. **Encryption**: Encrypt stored connection details
2. **Password Manager**: Optional integration with system keychain
3. **Session Timeout**: Auto-disconnect after inactivity
4. **Connection Permissions**: Role-based access control

## Testing Checklist

- [x] Connections persist across app restarts
- [x] Connection selection screen shows all saved connections
- [x] Clicking a connection activates it
- [x] Disconnect button returns to connection list
- [x] Ctrl+Shift+C keyboard shortcut works
- [x] Adding new connection saves to localStorage
- [x] Removing connection shows confirmation
- [x] Removing connection updates localStorage
- [x] Welcome screen shows for first-time users
- [x] Tabs clear when switching connections
- [x] No active connection on app start (security)

## Migration Notes

### Existing Users
- Existing connections in memory will be lost on first update
- Users will need to re-add connections once
- After that, connections will persist automatically

### Breaking Changes
- None - fully backward compatible
- Store structure unchanged, only wrapped with persist middleware
