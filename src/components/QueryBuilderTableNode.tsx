import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Database, X, Edit2, Check, GripVertical } from 'lucide-react';
import { QueryTable } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useQueryBuilderStore } from '@/stores/queryBuilderStore';

export interface TableNodeData extends Record<string, unknown> {
  table: QueryTable;
  onRemove: (tableId: string) => void;
  onColumnSelect: (tableId: string, columnName: string, selected: boolean) => void;
}

export const QueryBuilderTableNode = memo(({ data, id }: NodeProps) => {
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState((data as TableNodeData).table.alias || '');
  const { updateTableAlias, selectedColumns } = useQueryBuilderStore();

  const handleSaveAlias = () => {
    if (aliasInput.trim()) {
      updateTableAlias(id, aliasInput.trim());
    }
    setIsEditingAlias(false);
  };

  const isColumnSelected = (columnName: string) => {
    return selectedColumns.some(
      (col) => col.tableId === id && col.columnName === columnName
    );
  };

  const nodeData = data as TableNodeData;

  return (
    <div className="bg-background border-2 border-border rounded-lg shadow-lg min-w-[250px] max-w-[300px]">
      {/* Table Header */}
      <div className="bg-primary/10 border-b border-border p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-move flex-shrink-0" />
          <Database className="h-4 w-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{nodeData.table.tableName}</div>
            {!isEditingAlias && nodeData.table.alias && (
              <div className="text-xs text-muted-foreground truncate">
                alias: {nodeData.table.alias}
              </div>
            )}
            {isEditingAlias && (
              <div className="flex items-center gap-1 mt-1">
                <Input
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  placeholder="Enter alias"
                  className="h-6 text-xs"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveAlias();
                    if (e.key === 'Escape') setIsEditingAlias(false);
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={handleSaveAlias}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isEditingAlias && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => {
                setAliasInput(nodeData.table.alias || '');
                setIsEditingAlias(true);
              }}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => nodeData.onRemove(id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Columns List */}
      <div className="p-2 max-h-[400px] overflow-y-auto">
        {nodeData.table.columns.map((column, index) => (
          <div
            key={column.name}
            className="relative group"
          >
            {/* Output handle for each column */}
            <Handle
              type="source"
              position={Position.Right}
              id={`${id}-${column.name}`}
              className="!w-3 !h-3 !bg-primary !border-2 !border-background"
              style={{ top: 68 + index * 28 + 14 }}
            />

            {/* Input handle for each column */}
            <Handle
              type="target"
              position={Position.Left}
              id={`${id}-${column.name}`}
              className="!w-3 !h-3 !bg-primary !border-2 !border-background"
              style={{ top: 68 + index * 28 + 14 }}
            />

            <div className="flex items-center gap-2 p-1 rounded hover:bg-secondary/50 transition-colors">
              <Checkbox
                checked={isColumnSelected(column.name)}
                onCheckedChange={(checked) =>
                  nodeData.onColumnSelect(id, column.name, checked as boolean)
                }
                className="flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{column.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {column.data_type}
                  {column.is_primary_key && ' • PK'}
                  {!column.is_nullable && ' • NOT NULL'}
                </div>
              </div>
              {column.is_primary_key && (
                <div className="flex-shrink-0 text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1 rounded">
                  PK
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Main connection handles */}
      <Handle
        type="source"
        position={Position.Right}
        id="table-output"
        className="!w-4 !h-4 !bg-primary !border-2 !border-background"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="table-input"
        className="!w-4 !h-4 !bg-primary !border-2 !border-background"
      />
    </div>
  );
});

QueryBuilderTableNode.displayName = 'QueryBuilderTableNode';
