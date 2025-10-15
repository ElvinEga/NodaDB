import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

interface QueryResultSkeletonProps {
  message?: string;
  showSpinner?: boolean;
}

export function QueryResultSkeleton({
  message = 'Executing query...',
  showSpinner = true
}: QueryResultSkeletonProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
      {showSpinner && (
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      )}
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-4">{message}</p>

        {/* Result Preview Skeleton */}
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
      </div>
    </div>
  );
}
