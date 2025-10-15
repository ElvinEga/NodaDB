import * as React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface KeyboardTooltipProps {
  children: React.ReactNode;
  description: string;
  keys?: string[];
  side?: 'top' | 'right' | 'bottom' | 'left';
  disabled?: boolean;
}

export function KeyboardTooltip({
  children,
  description,
  keys,
  side = 'bottom',
  disabled = false,
}: KeyboardTooltipProps) {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

  const modifierMap: Record<string, string> = isMac
    ? { Ctrl: '⌘', Alt: '⌥', Shift: '⇧', Enter: '⏎' }
    : { Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Enter: 'Enter' };

  const renderKeys = () => {
    if (!keys || keys.length === 0) return null;

    return (
      <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-border/50">
        {keys.map((key, i) => (
          <React.Fragment key={i}>
            <Badge
              variant="outline"
              className="px-1.5 py-0 text-[10px] font-mono font-semibold bg-background/50"
            >
              {modifierMap[key] || key}
            </Badge>
            {i < keys.length - 1 && (
              <span className="text-[10px] text-muted-foreground">+</span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <div className="text-sm">
            {description}
            {renderKeys()}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
