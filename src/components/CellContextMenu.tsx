import {
  Copy,
  Edit2,
  FileJson,
  FileSpreadsheet,
  Code,
  Trash2,
  Files,
  Filter,
  Zap,
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
  copyCellValue,
  copyRowAsJson,
  copyRowAsCsv,
  copyRowAsSql,
} from '@/lib/tableOperations';

interface CellContextMenuProps {
  row: Record<string, any>;
  columnName: string;
  cellValue: unknown;
  tableName: string;
  columnNames: string[];
  isPrimaryKey: boolean;
  canEdit: boolean;
  onEdit?: () => void;
  onSetNull?: () => void;
  onDuplicateRow?: () => void;
  onDeleteRow?: () => void;
  onFilterByValue?: () => void;
  children: React.ReactNode;
}

export function CellContextMenu({
  row,
  cellValue,
  tableName,
  columnNames,
  isPrimaryKey,
  canEdit,
  onEdit,
  onSetNull,
  onDuplicateRow,
  onDeleteRow,
  onFilterByValue,
  children,
}: CellContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="cursor-context-menu">{children}</div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        {/* Cell Actions */}
        <ContextMenuItem onClick={() => copyCellValue(cellValue)}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Cell
          <span className="ml-auto text-xs text-muted-foreground">Ctrl+C</span>
        </ContextMenuItem>

        {canEdit && onEdit && (
          <ContextMenuItem onClick={onEdit}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit Cell
          </ContextMenuItem>
        )}

        {canEdit && onSetNull && !isPrimaryKey && (
          <ContextMenuItem onClick={onSetNull}>
            <Zap className="mr-2 h-4 w-4" />
            Set to NULL
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {/* Row Actions */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Copy className="mr-2 h-4 w-4" />
            Copy Row
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => copyRowAsJson(row)}>
              <FileJson className="mr-2 h-4 w-4" />
              Copy as JSON
            </ContextMenuItem>
            <ContextMenuItem onClick={() => copyRowAsCsv(row, columnNames)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Copy as CSV
            </ContextMenuItem>
            <ContextMenuItem onClick={() => copyRowAsSql(row, tableName, columnNames)}>
              <Code className="mr-2 h-4 w-4" />
              Copy as SQL INSERT
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {onDuplicateRow && (
          <ContextMenuItem onClick={onDuplicateRow}>
            <Files className="mr-2 h-4 w-4" />
            Duplicate Row
            <span className="ml-auto text-xs text-muted-foreground">Ctrl+D</span>
          </ContextMenuItem>
        )}

        {onDeleteRow && (
          <ContextMenuItem onClick={onDeleteRow} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Row
            <span className="ml-auto text-xs text-muted-foreground">Del</span>
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {/* Filter Actions */}
        {onFilterByValue && cellValue !== null && cellValue !== undefined && (
          <ContextMenuItem onClick={onFilterByValue}>
            <Filter className="mr-2 h-4 w-4" />
            Filter by This Value
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
