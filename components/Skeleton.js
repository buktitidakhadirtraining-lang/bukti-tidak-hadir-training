// components/Skeleton.js
export function StatCardSkeleton() {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm animate-pulse flex items-center justify-between">
      <div className="space-y-3 flex-1">
        <div className="h-4 bg-gray-200 rounded-md w-24"></div>
        <div className="h-8 bg-gray-200 rounded-lg w-16"></div>
      </div>
      <div className="w-12 h-12 bg-gray-200 rounded-2xl shrink-0"></div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-10 bg-gray-200 rounded-xl"></div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-100 rounded-xl flex gap-4 px-4 items-center">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-4 bg-gray-200 rounded flex-1"></div>
          ))}
        </div>
      ))}
    </div>
  );
}
