import { useState } from 'react';
import { ChevronDown, ChevronRight, Database, Filter, Link, Layers, TrendingUp, AlertCircle } from 'lucide-react';
import { PlanStep } from '@/types';

interface ExecutionPlanNodeProps {
  step: PlanStep;
  level?: number;
}

export function ExecutionPlanNode({ step, level = 0 }: ExecutionPlanNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);

  const getStepIcon = (stepType: string) => {
    if (stepType.includes('Scan')) return <Database className="h-4 w-4" />;
    if (stepType.includes('Join')) return <Link className="h-4 w-4" />;
    if (stepType.includes('Filter')) return <Filter className="h-4 w-4" />;
    if (stepType.includes('Sort')) return <Layers className="h-4 w-4" />;
    if (stepType.includes('Aggregate')) return <TrendingUp className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  };

  const getCostColor = (cost?: number) => {
    if (!cost) return 'text-muted-foreground';
    if (cost > 1000) return 'text-destructive';
    if (cost > 100) return 'text-orange-500';
    return 'text-green-500';
  };

  const hasChildren = step.children && step.children.length > 0;

  return (
    <div className="text-sm">
      <div 
        className="flex items-center gap-2 py-2 px-3 hover:bg-secondary/50 rounded cursor-pointer"
        style={{ paddingLeft: `${level * 24 + 12}px` }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )
        ) : (
          <div className="w-4" />
        )}
        
        <div className="text-primary flex-shrink-0">
          {getStepIcon(step.stepType)}
        </div>
        
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className="font-medium truncate">{step.stepType}</span>
          
          {step.tableName && (
            <span className="text-muted-foreground truncate">
              on <span className="font-mono">{step.tableName}</span>
            </span>
          )}
          
          {step.indexUsed && (
            <span className="text-green-600 text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 rounded flex-shrink-0">
              Index: {step.indexUsed}
            </span>
          )}
          
          {step.rows !== undefined && (
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {step.rows.toLocaleString()} rows
            </span>
          )}
          
          {step.cost !== undefined && (
            <span className={`text-xs font-mono flex-shrink-0 ${getCostColor(step.cost)}`}>
              Cost: {step.cost.toFixed(2)}
            </span>
          )}
        </div>
      </div>
      
      {step.filterCondition && (
        <div 
          className="text-xs text-muted-foreground px-3 py-1 bg-secondary/30"
          style={{ paddingLeft: `${level * 24 + 36}px` }}
        >
          <Filter className="h-3 w-3 inline mr-1" />
          Filter: <span className="font-mono">{step.filterCondition}</span>
        </div>
      )}
      
      {isExpanded && hasChildren && (
        <div>
          {step.children.map((child, index) => (
            <ExecutionPlanNode key={index} step={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
