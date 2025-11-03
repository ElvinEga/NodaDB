# Server-Side Pagination Implementation

## Overview
Implemented fully functional server-side pagination to handle large datasets efficiently. The table now fetches only the data needed for the current page, dramatically improving performance.

## Changes Made

### 1. Settings Dialog (`components/SettingsDialog.tsx`)
Updated page size options to more reasonable values:
- **Before**: 50, 100, 250, 500, 1000
- **After**: 10, 20, 50, 100

### 2. SQL Utilities (`lib/sqlUtils.ts`)
Already had enhanced `buildSelectQuery()` and `buildCountQuery()` functions that support:
- `LIMIT` and `OFFSET` for pagination
- `ORDER BY` for sorting
- `WHERE` clauses for filtering
- Database-specific identifier quoting

### 3. Table Viewer (`components/TanStackTableViewer.tsx`)

#### State Management
```tsx
// Get default page size from settings
const defaultPageSize = useSettingsStore((state) => state.rowsPerPage);

// Controlled pagination state
const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
  pageIndex: 0,
  pageSize: defaultPageSize,
});

const [rowCount, setRowCount] = useState(0);
```

#### Data Loading
```tsx
const loadData = async (pageIndex?: number, pageSizeValue?: number) => {
  // Build query with LIMIT and OFFSET
  const query = buildSelectQuery({
    tableName: table.name,
    schema: table.schema,
    dbType: connection.db_type,
    limit: currentPageSize,
    offset: currentPageIndex * currentPageSize,
    sorting: sorting,
    filters: columnFilters,
    globalFilter: globalFilter,
    columns: tableColumns.map((col) => col.name),
  });

  // Get total row count
  const countQuery = buildCountQuery({...});

  // Execute both queries in parallel
  const [result, countResult] = await Promise.all([...]);
  
  setData(result.rows);
  setRowCount(Number(countResult.rows[0].count));
};
```

#### Table Configuration
```tsx
const tableInstance = useReactTable({
  data,
  columns,
  pageCount: Math.ceil(rowCount / pageSize), // Calculate total pages
  manualPagination: true,  // Server-side pagination
  manualSorting: true,     // Server-side sorting
  manualFiltering: true,   // Server-side filtering
  onPaginationChange: setPagination, // Hook to state
  state: {
    pagination: { pageIndex, pageSize },
    // ... other state
  },
});
```

#### Auto-Refetch on Changes
```tsx
useEffect(() => {
  loadData(pageIndex, pageSize);
}, [connection.id, table.name, pageIndex, pageSize, sorting, columnFilters, globalFilter]);
```

#### UI Enhancements
Added page size selector and improved pagination info:
```tsx
<Select
  value={`${pageSize}`}
  onValueChange={(value) => tableInstance.setPageSize(Number(value))}
>
  <SelectContent>
    {[10, 20, 50, 100].map((size) => (
      <SelectItem key={size} value={`${size}`}>
        {size} rows
      </SelectItem>
    ))}
  </SelectContent>
</Select>

<span>Page {pageIndex + 1} of {tableInstance.getPageCount()}</span>
<span>Showing {data.length} of {rowCount.toLocaleString()} rows</span>
```

## How It Works

### 1. Manual Pagination Mode
- `manualPagination: true` tells TanStack Table to not paginate the data array itself
- We provide the correct page of data and the total page count
- TanStack Table manages the UI state (buttons, page numbers)

### 2. Controlled State
- `onPaginationChange: setPagination` connects TanStack Table's internal pagination to our React state
- When user clicks "Next", TanStack Table calls this callback
- Our state updates, triggering the useEffect

### 3. Automatic Refetch
- `useEffect` watches `pageIndex`, `pageSize`, `sorting`, `columnFilters`, and `globalFilter`
- Any change triggers a new `loadData()` call
- `loadData()` builds a precise SQL query with LIMIT/OFFSET

### 4. Parallel Queries
- Data query: `SELECT * FROM table LIMIT 50 OFFSET 0`
- Count query: `SELECT COUNT(*) FROM table`
- Both execute in parallel for optimal performance

## Performance Benefits

### Before:
- Fetched 1,000 rows at once
- Client-side pagination through array slicing
- High memory usage
- Slow initial load

### After:
- Fetches only 10-100 rows per page (configurable)
- Server-side pagination with SQL LIMIT/OFFSET
- Minimal memory usage
- Fast page loads
- Can handle tables with millions of rows

## User Experience

### Features:
1. **Dynamic page size**: Users can choose 10, 20, 50, or 100 rows per page
2. **Page navigation**: Previous/Next buttons with proper disabled states
3. **Page info**: Shows "Page X of Y" and "Showing N of M rows"
4. **Instant updates**: Changing page size or navigating pages is instant
5. **Persistent settings**: Default page size saved in settings

### Keyboard Shortcuts:
- All existing shortcuts still work
- Pagination state persists during table operations

## Database Compatibility

Works with all supported databases:
- **SQLite**: `LIMIT X OFFSET Y`
- **PostgreSQL**: `LIMIT X OFFSET Y`
- **MySQL**: `LIMIT X OFFSET Y`

All queries use proper identifier quoting for each database type.

## Testing Checklist

- [x] Page navigation (Next/Previous)
- [x] Page size selection (10, 20, 50, 100)
- [x] First page shows correct data
- [x] Last page shows correct data
- [x] Page count calculation is accurate
- [x] Row count display is accurate
- [x] Sorting triggers refetch
- [x] Filtering triggers refetch
- [x] Global search triggers refetch
- [x] Settings default page size is respected
- [x] CRUD operations refresh current page
- [x] Works with SQLite, PostgreSQL, MySQL

## Future Enhancements

1. **Jump to page**: Add input field to jump to specific page number
2. **First/Last buttons**: Add buttons to jump to first/last page
3. **Page size persistence**: Remember page size per table
4. **Infinite scroll**: Alternative to pagination for some use cases
5. **Virtual scrolling**: Combine with pagination for extremely large pages
