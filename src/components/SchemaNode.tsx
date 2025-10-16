import { memo, useState } from 'react';
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
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);

  return (
    <Card
      className={`
        min-w-[280px] max-w-[320px] bg-background border-2 transition-all
        ${selected ? 'border-primary shadow-xl ring-2 ring-primary/20' : 'border-border shadow-md hover:shadow-lg'}
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
            className={`
              relative px-3 py-2 text-xs border-b border-border/50 last:border-b-0
              transition-all duration-200
              ${hoveredColumn === column.name ? 'bg-primary/5 scale-[1.02]' : 'hover:bg-muted/30'}
              ${column.isPrimaryKey ? 'bg-primary/5' : ''}
              ${column.isForeignKey ? 'bg-orange-500/5' : ''}
            `}
            onMouseEnter={() => setHoveredColumn(column.name)}
            onMouseLeave={() => setHoveredColumn(null)}
          >
            {/* Connection Handles */}
            {column.isPrimaryKey && (
              <Handle
                type="source"
                position={Position.Right}
                id={`${nodeData.tableName}-${column.name}-source`}
                className="!w-3 !h-3 !bg-primary !border-2 !border-background hover:!scale-125 transition-transform"
                style={{ top: 46 + index * 33 + 16 }}
              />
            )}
            {column.isForeignKey && (
              <Handle
                type="target"
                position={Position.Left}
                id={`${nodeData.tableName}-${column.name}-target`}
                className="!w-3 !h-3 !bg-orange-500 !border-2 !border-background hover:!scale-125 transition-transform"
                style={{ top: 46 + index * 33 + 16 }}
              />
            )}

            <div className="flex items-center gap-2">
              {/* Column Icons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {column.isPrimaryKey && (
                  <Key className="h-3.5 w-3.5 text-primary" />
                )}
                {column.isForeignKey && (
                  <Link className="h-3.5 w-3.5 text-orange-500" />
                )}
              </div>

              {/* Column Name */}
              <span
                className={`font-mono flex-1 truncate ${
                  column.isPrimaryKey ? 'font-bold text-primary' : ''
                } ${
                  column.isForeignKey ? 'font-semibold text-orange-600' : ''
                }`}
                title={column.name}
              >
                {column.name}
              </span>

              {/* Data Type */}
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 font-mono flex-shrink-0 ${
                  column.isPrimaryKey ? 'border-primary text-primary' : ''
                } ${
                  column.isForeignKey ? 'border-orange-500 text-orange-600' : ''
                }`}
              >
                {column.type}
              </Badge>

              {/* Nullable Indicator */}
              {!column.isNullable && (
                <span className="text-[10px] text-muted-foreground flex-shrink-0 font-semibold">
                  NN
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
