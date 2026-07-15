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
import { Checkbox } from '@/components/ui/checkbox';
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
    <div className="w-full px-4 py-3">
      <div className="flex flex-wrap items-start gap-4">
        {/* Chart Type */}
        <div className="flex flex-col gap-1 min-w-[140px]">
          <Label className="text-xs text-muted-foreground">Chart Type</Label>
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

        {/* X Axis */}
        <div className="flex flex-col gap-1 min-w-[140px]">
          <Label className="text-xs text-muted-foreground">X-Axis</Label>
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

        {/* Y Axis / Value Column */}
        {config.chartType === 'pie' ? (
          <div className="flex flex-col gap-1 min-w-[140px]">
            <Label className="text-xs text-muted-foreground">Value Column</Label>
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
        ) : (
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Y-Axis Columns</Label>
            <div className="flex flex-wrap gap-2 border rounded-md px-3 py-2 min-w-[160px] max-w-xs bg-background">
              {numericColumns.length > 0 ? (
                numericColumns.map((col) => (
                  <div key={col} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`y-${col}`}
                      checked={config.yAxis.includes(col)}
                      onCheckedChange={() => toggleYAxis(col)}
                      className="h-3 w-3"
                    />
                    <label
                      htmlFor={`y-${col}`}
                      className="text-xs font-medium cursor-pointer leading-none"
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

        {/* Group By */}
        <div className="flex flex-col gap-1 min-w-[140px]">
          <Label className="text-xs text-muted-foreground">Group By</Label>
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
          <div className="flex flex-col gap-1 min-w-[130px]">
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

        {/* Chart Title */}
        <div className="flex flex-col gap-1 min-w-[160px] flex-1">
          <Label className="text-xs text-muted-foreground">Chart Title</Label>
          <Input
            value={config.title || ''}
            onChange={(e) => updateConfig({ title: e.target.value })}
            placeholder="Optional title…"
            className="h-8 text-xs"
          />
        </div>
      </div>
    </div>
  );
}
