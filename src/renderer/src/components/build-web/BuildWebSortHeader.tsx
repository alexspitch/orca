import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/** A table column header that sorts by its key; a second click flips the direction. */
export function BuildWebSortHeader<K extends string>({
  label,
  sortKey,
  sort,
  dir,
  onSort,
  className
}: {
  label: string
  sortKey: K
  sort: K | null
  dir: 'asc' | 'desc'
  onSort: (key: K) => void
  className?: string
}): React.JSX.Element {
  const active = sort === sortKey
  return (
    <th
      className={cn('py-2', className)}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 uppercase hover:text-foreground focus-visible:underline focus-visible:outline-none',
          active && 'text-foreground'
        )}
      >
        {label}
        {active ? (
          dir === 'asc' ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : null}
      </button>
    </th>
  )
}
