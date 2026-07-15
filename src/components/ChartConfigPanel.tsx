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
import { Separator } from '@/components/ui/separator';
import { getNumericColumns, getCategoricalColumns } from '@/lib/chartDataTransformer';

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
    <div className="w-64 shrink-0 border-r border-border bg-secondary/20 flex flex-col">
      <div className="h-11 border-b border-border flex items-center px-4">
        <h3 className="font-semibold text-sm">Chart Config</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Chart Type */}
          <div className="space-y-1.5">
            <Label className="!text-sm text-muted-foreground">Chart Type</Label>
            <Select
              value={config.chartType}
              onValueChange={(value) => updateConfig({ chartType: value as ChartType })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chartTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="text-xs">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* X Axis */}
          <div className="space-y-1.5">
            <Label className="!text-sm text-muted-foreground">X-Axis Column</Label>
            <Select
              value={config.xAxis}
              onValueChange={(value) => updateConfig({ xAxis: value })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allColumns.map((col) => (
                  <SelectItem key={col} value={col} className="text-xs">
                    {col}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Y Axis - Multiple Selection */}
          {config.chartType !== 'pie' && (
            <div className="space-y-1.5">
              <Label className="!text-sm text-muted-foreground">Y-Axis Columns</Label>
              <div className="border rounded-md p-2.5 space-y-2 max-h-40 overflow-y-auto bg-background">
                {numericColumns.length > 0 ? (
                  numericColumns.map((col) => (
                    <div key={col} className="flex items-center gap-2">
                      <Checkbox
                        id={`y-${col}`}
                        checked={config.yAxis.includes(col)}
                        onCheckedChange={() => toggleYAxis(col)}
                        className="h-3.5 w-3.5"
                      />
                      <label
                        htmlFor={`y-${col}`}
                        className="!text-sm font-medium leading-none cursor-pointer"
                      >
                        {col}
                      </label>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No numeric columns</p>
                )}
              </div>
            </div>
          )}

          {/* Pie Chart Value Column */}
          {config.chartType === 'pie' && (
            <div className="space-y-1.5">
              <Label className="!text-sm text-muted-foreground">Value Column</Label>
              <Select
                value={config.yAxis[0] || ''}
                onValueChange={(value) => updateConfig({ yAxis: [value] })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {numericColumns.map((col) => (
                    <SelectItem key={col} value={col} className="text-xs">
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Group By */}
          <div className="space-y-1.5">
            <Label className="!text-sm  text-muted-foreground">Group By</Label>
            <Select
              value={config.groupBy || 'none'}
              onValueChange={(value) =>
                updateConfig({ groupBy: value === 'none' ? undefined : value })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">None</SelectItem>
                {categoricalColumns.map((col) => (
                  <SelectItem key={col} value={col} className="text-xs">
                    {col}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Aggregation */}
          {config.groupBy && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Aggregation</Label>
              <Select
                value={config.aggregation || 'sum'}
                onValueChange={(value) =>
                  updateConfig({ aggregation: value as AggregationType })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aggregationTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-xs">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Chart Title */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Chart Title</Label>
            <Input
              value={config.title || ''}
              onChange={(e) => updateConfig({ title: e.target.value })}
              placeholder="Optional title…"
              className="h-8 text-xs"
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
