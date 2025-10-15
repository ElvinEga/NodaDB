import { Skeleton } from '@/components/ui/skeleton';

interface SidebarSkeletonProps {
  items?: number;
}

export function SidebarSkeleton({ items = 8 }: SidebarSkeletonProps) {
  return (
    <div className="space-y-2 p-4">
      {/* Search Skeleton */}
      <Skeleton className="h-9 w-full mb-4" />

      {/* Category Header */}
      <Skeleton className="h-4 w-20 mb-2" />

      {/* List Items */}
      <div className="space-y-1.5">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-2">
            <Skeleton className="h-4 w-4 flex-shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>

      {/* Another Category */}
      <div className="pt-4">
        <Skeleton className="h-4 w-24 mb-2" />
        <div className="space-y-1.5">
          {Array.from({ length: Math.floor(items / 2) }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-2">
              <Skeleton className="h-4 w-4 flex-shrink-0" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
