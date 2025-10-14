import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  EyeOff,
  Copy,
  Download,
  BarChart3,
  FileJson,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  copyColumnValues,
  copyColumnAsCsv,
  exportColumnToCsv,
} from '@/lib/tableOperations';

interface ColumnHeaderContextMenuProps {
  columnName: string;
  dataType: string;
  isPrimaryKey: boolean;
  isNullable: boolean;
  isSorted: false | 'asc' | 'desc';
  data: Record<string, any>[];
  onSort: (ascending: boolean) => void;
  onClearSort: () => void;
  onHide: () => void;
  onShowStats: () => void;
  children: React.ReactNode;
}

export function ColumnHeaderContextMenu({
  columnName,
  isSorted,
  data,
  onSort,
  onClearSort,
  onHide,
  onShowStats,
  children,
}: ColumnHeaderContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="cursor-context-menu">{children}</div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={() => onSort(true)}>
          <ChevronUp className="mr-2 h-4 w-4" />
          Sort Ascending
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onSort(false)}>
          <ChevronDown className="mr-2 h-4 w-4" />
          Sort Descending
        </ContextMenuItem>
        {isSorted && (
          <ContextMenuItem onClick={onClearSort}>
            <ChevronsUpDown className="mr-2 h-4 w-4" />
            Clear Sort
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onHide}>
          <EyeOff className="mr-2 h-4 w-4" />
          Hide Column
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Copy className="mr-2 h-4 w-4" />
            Copy Column
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => copyColumnValues(data, columnName)}>
              <FileJson className="mr-2 h-4 w-4" />
              Copy Values
            </ContextMenuItem>
            <ContextMenuItem onClick={() => copyColumnAsCsv(data, columnName)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Copy as CSV
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuItem onClick={() => exportColumnToCsv(data, columnName)}>
          <Download className="mr-2 h-4 w-4" />
          Export Column as CSV
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onShowStats}>
          <BarChart3 className="mr-2 h-4 w-4" />
          Show Statistics
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
