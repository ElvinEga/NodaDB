import { ExecutionPlan } from '@/types';
import { ExecutionPlanNode } from '@/components/ExecutionPlanNode';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, TrendingUp, Lightbulb, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface QueryAnalyzerProps {
  executionPlan: ExecutionPlan;
}

export function QueryAnalyzer({ executionPlan }: QueryAnalyzerProps) {
  const hasWarnings = executionPlan.recommendations.some(
    rec => !rec.includes('well optimized')
  );

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Metrics Bar */}
      <div className="h-16 border-b border-border bg-secondary/30 flex items-center px-4 gap-6">
        {executionPlan.executionTimeMs !== undefined && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Execution Time</div>
              <div className="text-sm font-mono font-semibold">
                {executionPlan.executionTimeMs.toFixed(2)}ms
              </div>
            </div>
          </div>
        )}
        
        {executionPlan.totalCost !== undefined && (
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Total Cost</div>
              <div className="text-sm font-mono font-semibold">
                {executionPlan.totalCost.toFixed(2)}
              </div>
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          {hasWarnings ? (
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
          <div>
            <div className="text-xs text-muted-foreground">Status</div>
            <div className="text-sm font-semibold">
              {hasWarnings ? 'Needs Optimization' : 'Well Optimized'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="plan" className="flex-1 flex flex-col">
        <div className="border-b border-border">
          <TabsList className="h-12 bg-transparent">
            <TabsTrigger value="plan">Execution Plan</TabsTrigger>
            <TabsTrigger value="recommendations">
              Recommendations
              {hasWarnings && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-orange-500 text-white rounded">
                  {executionPlan.recommendations.filter(r => !r.includes('well optimized')).length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="plan" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {executionPlan.planSteps.length > 0 ? (
                <Card className="overflow-hidden">
                  {executionPlan.planSteps.map((step, index) => (
                    <ExecutionPlanNode key={index} step={step} />
                  ))}
                </Card>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  No execution plan data available
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="recommendations" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {executionPlan.recommendations.map((recommendation, index) => {
                const isOptimized = recommendation.includes('well optimized');
                return (
                  <Card 
                    key={index}
                    className={`p-4 ${
                      isOptimized 
                        ? 'border-green-500/30 bg-green-500/5' 
                        : 'border-orange-500/30 bg-orange-500/5'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {isOptimized ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Lightbulb className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm">{recommendation}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
              
              {executionPlan.recommendations.length === 0 && (
                <div className="text-center text-muted-foreground py-12">
                  No recommendations available
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
