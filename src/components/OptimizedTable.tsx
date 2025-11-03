import { useRef, useMemo } from 'react';
import { TableHeader } from '@/lib/table-state';
import { useTableState } from '@/hooks/use-table-state';
import { cn } from '@/lib/utils';
import { useTableVirtualization } from '@/hooks/use-table-virtualization';

interface OptimizedTableProps {
  headers: TableHeader[];
  data: Record<string, any>[];
}

export const OptimizedTable = ({ headers, data }: OptimizedTableProps) => {
  const state = useTableState(headers, data);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  const ROW_HEIGHT = 36;

  const { rowStartIndex, rowEndIndex, colStartIndex, colEndIndex } = useTableVirtualization({
    containerRef: tableContainerRef,
    totalRows: state.getRowCount(),
    totalColumns: state.getHeaders().length,
    rowHeight: ROW_HEIGHT,
    columnWidths: state.getColumnWidths(),
  });

  const totalHeight = state.getRowCount() * ROW_HEIGHT;
  const totalWidth = useMemo(() => state.getColumnWidths().reduce((sum, w) => sum + w, 0), [state]);
  
  const headersToRender = useMemo(() => state.getHeaders().slice(colStartIndex, colEndIndex + 1), [state, colStartIndex, colEndIndex]);
  const rowsToRender = useMemo(() => state.getRows().slice(rowStartIndex, rowEndIndex + 1), [state, rowStartIndex, rowEndIndex]);

  const paddingTop = rowStartIndex * ROW_HEIGHT;
  const paddingLeft = useMemo(() => {
    return state.getColumnWidths().slice(0, colStartIndex).reduce((sum, w) => sum + w, 0);
  }, [state, colStartIndex]);

  return (
    <div
      ref={tableContainerRef}
      className="h-full w-full overflow-auto border"
      tabIndex={0}
      style={{ contain: 'strict' }}
    >
      <div style={{ height: `${totalHeight}px`, width: `${totalWidth}px`, position: 'relative' }}>
        <table className="border-collapse" style={{
          position: 'absolute',
          top: `${paddingTop}px`,
          left: `${paddingLeft}px`,
        }}>
          <thead className="sticky top-0 bg-secondary z-10">
            <tr>
              {headersToRender.map((header, i) => {
                const x = colStartIndex + i;
                return (
                  <th key={header.name} className="border p-2 text-left text-sm" style={{ width: `${state.getColumnWidths()[x]}px`}}>
                    {header.name}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rowsToRender.map((row, i) => {
              const y = rowStartIndex + i;
              return (
                <tr key={y} style={{ height: `${ROW_HEIGHT}px` }}>
                  {headersToRender.map((header, j) => {
                    const x = colStartIndex + j;
                    const isFocused = state.getFocus()?.y === y && state.getFocus()?.x === x;
                    const isSelected = state.isCellSelected(y, x);

                    return (
                      <td
                        key={x}
                        className={cn('border p-2 text-xs font-mono select-none overflow-hidden whitespace-nowrap text-ellipsis', {
                          'bg-blue-100 dark:bg-blue-900': isSelected,
                          'ring-2 ring-blue-500 ring-inset': isFocused,
                        })}
                        style={{ width: `${state.getColumnWidths()[x]}px` }}
                        onMouseDown={() => state.setFocus(y, x)}
                        onMouseMove={(e) => {
                          if (e.buttons === 1) state.setSelection(y, x);
                        }}
                      >
                        {String(state.getValue(y, x) ?? 'NULL')}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
