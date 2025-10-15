import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Table2, Key, Link } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export interface SchemaNodeData extends Record<string, unknown> {
  tableName: string;
  columns: Array<{
    name: string;
    type: string;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    isNullable: boolean;
  }>;
  rowCount?: number;
}

export const SchemaNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as SchemaNodeData;

  return (
    <Card
      className={`
        min-w-[280px] max-w-[320px] bg-background border-2 transition-all
        ${selected ? 'border-primary shadow-lg' : 'border-border shadow-md'}
      `}
    >
      {/* Table Header */}
      <div className="bg-primary/10 border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Table2 className="h-4 w-4 text-primary flex-shrink-0" />
          <h3 className="font-semibold text-sm truncate flex-1">
            {nodeData.tableName}
          </h3>
          {nodeData.rowCount !== undefined && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {nodeData.rowCount}
            </Badge>
          )}
        </div>
      </div>

      {/* Columns */}
      <div className="max-h-[400px] overflow-y-auto">
        {nodeData.columns.map((column, index) => (
          <div
            key={column.name}
            className="relative px-3 py-2 text-xs border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors"
          >
            {/* Connection Handles */}
            {column.isPrimaryKey && (
              <Handle
                type="source"
                position={Position.Right}
                id={`${nodeData.tableName}-${column.name}-source`}
                className="!w-2 !h-2 !bg-primary !border !border-background"
                style={{ top: 46 + index * 33 + 16 }}
              />
            )}
            {column.isForeignKey && (
              <Handle
                type="target"
                position={Position.Left}
                id={`${nodeData.tableName}-${column.name}-target`}
                className="!w-2 !h-2 !bg-orange-500 !border !border-background"
                style={{ top: 46 + index * 33 + 16 }}
              />
            )}

            <div className="flex items-center gap-2">
              {/* Column Icons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {column.isPrimaryKey && (
                  <Key className="h-3 w-3 text-primary" />
                )}
                {column.isForeignKey && (
                  <Link className="h-3 w-3 text-orange-500" />
                )}
              </div>

              {/* Column Name */}
              <span
                className={`font-mono flex-1 truncate ${
                  column.isPrimaryKey ? 'font-semibold' : ''
                }`}
              >
                {column.name}
              </span>

              {/* Data Type */}
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-mono flex-shrink-0"
              >
                {column.type}
              </Badge>

              {/* Nullable Indicator */}
              {!column.isNullable && (
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  NOT NULL
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border">
        {nodeData.columns.length} column{nodeData.columns.length !== 1 ? 's' : ''}
      </div>
    </Card>
  );
});

SchemaNode.displayName = 'SchemaNode';
