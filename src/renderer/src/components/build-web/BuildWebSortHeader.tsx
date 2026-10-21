import { ArrowDown, ArrowUp } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** A table column header that sorts by its key; a second click flips the direction. */
export function BuildWebSortHeader<K extends string>({
  label,
  icon,
  sortKey,
  sort,
  dir,
  onSort,
  className
}: {
  label: string
  /** Shown in place of the label, which then names the button and its tooltip. */
  icon?: React.ReactNode
  sortKey: K
  sort: K | null
  dir: 'asc' | 'desc'
  onSort: (key: K) => void
  className?: string
}): React.JSX.Element {
  const active = sort === sortKey
  const button = (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={icon ? label : undefined}
      className={cn(
        'inline-flex items-center gap-1 uppercase hover:text-foreground focus-visible:underline focus-visible:outline-none',
        active && 'text-foreground'
      )}
    >
      {icon ?? label}
      {active ? (
        dir === 'asc' ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        )
      ) : null}
    </button>
  )
  return (
    <th
      className={cn('py-2', className)}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {icon ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
    </th>
  )
}
