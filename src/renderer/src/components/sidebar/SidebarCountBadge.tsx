import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * A sidebar item's number, with what it counts on hover — the number alone says nothing. Hidden
 * from assistive tech: the item's own label says the count in words.
 */
export function SidebarCountBadge({
  count,
  tone,
  hint
}: {
  count: string | number
  tone: 'red' | 'neutral'
  hint: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-hidden="true"
          className={cn(
            'min-w-5 rounded-full px-1.5 text-center text-2xs leading-5 tabular-nums',
            tone === 'red'
              ? 'bg-chip-tone-red/15 text-chip-tone-red'
              : 'bg-worktree-sidebar-foreground/10'
          )}
        >
          {count}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="max-w-72">
        {hint}
      </TooltipContent>
    </Tooltip>
  )
}
