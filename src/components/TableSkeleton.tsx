import { Skeleton } from '@/components/ui/skeleton';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 10, columns = 6 }: TableSkeletonProps) {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header Skeleton */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="flex-1 overflow-hidden px-4 py-3">
        <div className="border border-border rounded-md overflow-hidden">
          {/* Table Header */}
          <div className="bg-muted/50 border-b border-border">
            <div className="flex items-center h-10 px-2 gap-2">
              {Array.from({ length: columns }).map((_, i) => (
                <Skeleton key={i} className="h-5 flex-1" />
              ))}
            </div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-border">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex items-center h-12 px-2 gap-2">
                {Array.from({ length: columns }).map((_, j) => (
                  <Skeleton key={j} className="h-5 flex-1" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Skeleton */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
      </div>
    </div>
  );
}
