import { ChartConfig, ChartType, AggregationType, QueryResult } from '@/types';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { getNumericColumns, getCategoricalColumns } from '@/lib/chartDataTransformer';
import { Separator } from '@/components/ui/separator';

interface ChartConfigPanelProps {
  queryResult: QueryResult;
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
}

export function ChartConfigPanel({
  queryResult,
  config,
  onConfigChange,
}: ChartConfigPanelProps) {
  const numericColumns = getNumericColumns(queryResult);
  const categoricalColumns = getCategoricalColumns(queryResult);
  const allColumns = queryResult.columns;

  const updateConfig = (updates: Partial<ChartConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  const toggleYAxis = (column: string) => {
    const newYAxis = config.yAxis.includes(column)
      ? config.yAxis.filter((c) => c !== column)
      : [...config.yAxis, column];
    updateConfig({ yAxis: newYAxis });
  };

  const chartTypes: { value: ChartType; label: string }[] = [
    { value: 'bar', label: 'Bar Chart' },
    { value: 'line', label: 'Line Chart' },
    { value: 'area', label: 'Area Chart' },
    { value: 'pie', label: 'Pie Chart' },
    { value: 'scatter', label: 'Scatter Plot' },
  ];

  const aggregationTypes: { value: AggregationType; label: string }[] = [
    { value: 'count', label: 'Count' },
    { value: 'sum', label: 'Sum' },
    { value: 'avg', label: 'Average' },
    { value: 'min', label: 'Minimum' },
    { value: 'max', label: 'Maximum' },
  ];

  return (
    <div className="w-80 border-l border-border bg-secondary/20 flex flex-col">
      <div className="h-12 border-b border-border flex items-center px-4">
        <h3 className="font-semibold text-sm">Chart Configuration</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Chart Type */}
          <div className="space-y-2">
            <Label>Chart Type</Label>
            <Select
              value={config.chartType}
              onValueChange={(value) => updateConfig({ chartType: value as ChartType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chartTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* X Axis */}
          <div className="space-y-2">
            <Label>X-Axis Column</Label>
            <Select
              value={config.xAxis}
              onValueChange={(value) => updateConfig({ xAxis: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allColumns.map((col) => (
                  <SelectItem key={col} value={col}>
                    {col}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Y Axis - Multiple Selection */}
          {config.chartType !== 'pie' && (
            <div className="space-y-2">
              <Label>Y-Axis Columns</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                {numericColumns.length > 0 ? (
                  numericColumns.map((col) => (
                    <div key={col} className="flex items-center space-x-2">
                      <Checkbox
                        id={`y-${col}`}
                        checked={config.yAxis.includes(col)}
                        onCheckedChange={() => toggleYAxis(col)}
                      />
                      <label
                        htmlFor={`y-${col}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {col}
                      </label>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No numeric columns available
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Pie Chart Value Column */}
          {config.chartType === 'pie' && (
            <div className="space-y-2">
              <Label>Value Column</Label>
              <Select
                value={config.yAxis[0] || ''}
                onValueChange={(value) => updateConfig({ yAxis: [value] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select value column" />
                </SelectTrigger>
                <SelectContent>
                  {numericColumns.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Group By */}
          <div className="space-y-2">
            <Label>Group By (Optional)</Label>
            <Select
              value={config.groupBy || 'none'}
              onValueChange={(value) =>
                updateConfig({ groupBy: value === 'none' ? undefined : value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {categoricalColumns.map((col) => (
                  <SelectItem key={col} value={col}>
                    {col}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Aggregation */}
          {config.groupBy && (
            <div className="space-y-2">
              <Label>Aggregation</Label>
              <Select
                value={config.aggregation || 'sum'}
                onValueChange={(value) =>
                  updateConfig({ aggregation: value as AggregationType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aggregationTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Chart Title */}
          <div className="space-y-2">
            <Label>Chart Title (Optional)</Label>
            <Input
              value={config.title || ''}
              onChange={(e) => updateConfig({ title: e.target.value })}
              placeholder="Enter chart title"
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
