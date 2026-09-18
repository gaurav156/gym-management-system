// Generic pulsing placeholder bar - the building block for skeleton rows/cards below.
export function SkeletonBar({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />
}

// One placeholder row matching the shape of the data tables used across the manager/
// owner dashboards (an avatar-ish cell, then a few text cells, then an action slot).
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-3 pr-4">
          <SkeletonBar className={i === 0 ? 'h-4 w-32' : 'h-4 w-20'} />
        </td>
      ))}
    </tr>
  )
}

// Drop-in replacement for a table body while a page is loading - renders `rows` skeleton
// rows so the table doesn't jump/collapse once real data arrives.
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </>
  )
}

// For card-grid layouts (e.g. the plan cards on OwnerDashboard/MemberDashboard).
export function CardSkeleton() {
  return (
    <div className="rounded-md border border-gray-200 p-4">
      <SkeletonBar className="h-4 w-2/3" />
      <SkeletonBar className="mt-3 h-6 w-1/3" />
      <SkeletonBar className="mt-2 h-3 w-1/2" />
    </div>
  )
}