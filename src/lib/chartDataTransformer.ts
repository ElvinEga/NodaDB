import { QueryResult, ChartConfig, ChartData, AggregationType } from '@/types';

export function transformQueryResultToChartData(
  result: QueryResult,
  config: ChartConfig
): ChartData {
  if (result.rows.length === 0) {
    return {
      data: [],
      xAxisKey: config.xAxis,
      yAxisKeys: config.yAxis,
    };
  }

  // If groupBy is specified, we need to aggregate
  if (config.groupBy && config.aggregation) {
    return transformWithAggregation(result, config);
  }

  // Otherwise, just transform the data directly
  return transformDirect(result, config);
}

function transformDirect(result: QueryResult, config: ChartConfig): ChartData {
  const data = result.rows.map((row) => {
    const point: Record<string, string | number> = {};
    
    // Add X axis value
    const xValue = row[config.xAxis];
    point[config.xAxis] = convertToChartValue(xValue);
    
    // Add Y axis values
    config.yAxis.forEach((yKey) => {
      const yValue = row[yKey];
      point[yKey] = convertToNumber(yValue);
    });
    
    return point;
  });

  return {
    data,
    xAxisKey: config.xAxis,
    yAxisKeys: config.yAxis,
  };
}

function transformWithAggregation(
  result: QueryResult,
  config: ChartConfig
): ChartData {
  const grouped = new Map<string, Record<string, number[]>>();

  // Group rows by the groupBy column
  result.rows.forEach((row) => {
    const groupKey = String(row[config.groupBy!] ?? 'null');
    
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {});
    }
    
    const group = grouped.get(groupKey)!;
    
    config.yAxis.forEach((yKey) => {
      if (!group[yKey]) {
        group[yKey] = [];
      }
      group[yKey].push(convertToNumber(row[yKey]));
    });
  });

  // Apply aggregation
  const data = Array.from(grouped.entries()).map(([groupKey, values]) => {
    const point: Record<string, string | number> = {};
    point[config.xAxis] = groupKey;
    
    config.yAxis.forEach((yKey) => {
      const nums = values[yKey] || [];
      point[yKey] = applyAggregation(nums, config.aggregation!);
    });
    
    return point;
  });

  return {
    data,
    xAxisKey: config.xAxis,
    yAxisKeys: config.yAxis,
  };
}

function applyAggregation(values: number[], aggregation: AggregationType): number {
  if (values.length === 0) return 0;
  
  switch (aggregation) {
    case 'count':
      return values.length;
    case 'sum':
      return values.reduce((sum, val) => sum + val, 0);
    case 'avg':
      return values.reduce((sum, val) => sum + val, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    default:
      return 0;
  }
}

function convertToChartValue(value: unknown): string | number {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function convertToNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return 0;
}

export function getNumericColumns(result: QueryResult): string[] {
  if (result.rows.length === 0) return [];
  
  const firstRow = result.rows[0];
  return result.columns.filter((col) => {
    const value = firstRow[col];
    return typeof value === 'number' || 
           (typeof value === 'string' && !isNaN(parseFloat(value)));
  });
}

export function getCategoricalColumns(result: QueryResult): string[] {
  if (result.rows.length === 0) return [];
  
  const firstRow = result.rows[0];
  return result.columns.filter((col) => {
    const value = firstRow[col];
    return typeof value === 'string' || 
           typeof value === 'boolean' ||
           value === null ||
           value === undefined;
  });
}

export const DEFAULT_CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];
