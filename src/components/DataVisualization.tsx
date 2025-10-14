import { useState, useRef } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { toPng } from 'html-to-image';
import { ChartConfig, QueryResult } from '@/types';
import { ChartConfigPanel } from '@/components/ChartConfigPanel';
import { Button } from '@/components/ui/button';
import { Download, Settings, Image } from 'lucide-react';
import { transformQueryResultToChartData, DEFAULT_CHART_COLORS } from '@/lib/chartDataTransformer';
import { toast } from 'sonner';

interface DataVisualizationProps {
  queryResult: QueryResult;
}

export function DataVisualization({ queryResult }: DataVisualizationProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [showConfig, setShowConfig] = useState(true);
  const [config, setConfig] = useState<ChartConfig>({
    chartType: 'bar',
    xAxis: queryResult.columns[0] || '',
    yAxis: queryResult.columns.slice(1, 2),
    colors: DEFAULT_CHART_COLORS,
  });

  const chartData = transformQueryResultToChartData(queryResult, config);

  const handleExportPNG = async () => {
    if (!chartRef.current) return;

    try {
      const dataUrl = await toPng(chartRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.download = `chart_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      toast.success('Chart exported as PNG');
    } catch (error) {
      console.error('Failed to export chart:', error);
      toast.error('Failed to export chart');
    }
  };

  const handleExportData = () => {
    const csv = [
      [chartData.xAxisKey, ...chartData.yAxisKeys].join(','),
      ...chartData.data.map((row) =>
        [row[chartData.xAxisKey], ...chartData.yAxisKeys.map((key) => row[key])].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chart_data_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Chart data exported as CSV');
  };

  const renderChart = () => {
    if (chartData.data.length === 0) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          <p>No data available to visualize</p>
        </div>
      );
    }

    const colors = config.colors || DEFAULT_CHART_COLORS;

    switch (config.chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chartData.xAxisKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {chartData.yAxisKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={colors[index % colors.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chartData.xAxisKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {chartData.yAxisKeys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chartData.xAxisKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {chartData.yAxisKeys.map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  fill={colors[index % colors.length]}
                  stroke={colors[index % colors.length]}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData.data}
                dataKey={chartData.yAxisKeys[0]}
                nameKey={chartData.xAxisKey}
                cx="50%"
                cy="50%"
                outerRadius={150}
                label
              >
                {chartData.data.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chartData.xAxisKey} />
              <YAxis />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Legend />
              {chartData.yAxisKeys.map((key, index) => (
                <Scatter
                  key={key}
                  name={key}
                  data={chartData.data}
                  fill={colors[index % colors.length]}
                  dataKey={key}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full flex bg-background">
      {/* Chart Area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-12 border-b border-border bg-secondary/50 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold">Data Visualization</h2>
            {config.title && (
              <span className="text-sm text-muted-foreground">• {config.title}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
            >
              <Settings className="h-4 w-4 mr-2" />
              {showConfig ? 'Hide' : 'Show'} Config
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPNG}>
              <Image className="h-4 w-4 mr-2" />
              Export PNG
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportData}>
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1 p-8" ref={chartRef}>
          {config.title && (
            <h3 className="text-xl font-semibold text-center mb-6">{config.title}</h3>
          )}
          <div className="h-full">{renderChart()}</div>
        </div>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <ChartConfigPanel
          queryResult={queryResult}
          config={config}
          onConfigChange={setConfig}
        />
      )}
    </div>
  );
}
