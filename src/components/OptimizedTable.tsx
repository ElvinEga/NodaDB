import { TableHeader } from '@/lib/table-state';
import { useTableState } from '@/hooks/use-table-state';
import { cn } from '@/lib/utils';

interface OptimizedTableProps {
  headers: TableHeader[];
  data: Record<string, any>[];
}

export const OptimizedTable = ({ headers, data }: OptimizedTableProps) => {
  const state = useTableState(headers, data);
  const rows = state.getRows();

  return (
    <div className="h-full w-full overflow-auto border" tabIndex={0}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="sticky top-0 bg-secondary">
            {state.getHeaders().map((header, x) => (
              <th key={header.name} className="border p-2 text-left text-sm">
                {header.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, y) => (
            <tr key={y}>
              {state.getHeaders().map((header, x) => {
                const isFocused = state.getFocus()?.y === y && state.getFocus()?.x === x;
                const isSelected = state.isCellSelected(y, x);
                
                return (
                  <td
                    key={x}
                    className={cn('border p-2 text-xs font-mono select-none', {
                      'bg-blue-100 dark:bg-blue-900': isSelected,
                      'ring-2 ring-blue-500 ring-inset': isFocused,
                    })}
                    onMouseDown={() => state.setFocus(y, x)}
                    onMouseMove={(e) => {
                      if (e.buttons === 1) {
                        state.setSelection(y, x);
                      }
                    }}
                  >
                    {String(state.getValue(y, x) ?? 'NULL')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
