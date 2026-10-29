import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * A sidebar item's number, with what it counts on hover — the number alone says nothing. Hidden
 * from assistive tech: the item's own label says the count in words.
 */
export function SidebarCountBadge({
  count,
  tone,
  hint,
  wideHint,
  small
}: {
  count: string | number
  tone: 'red' | 'amber' | 'neutral'
  hint: React.ReactNode
  /** For a hint that lists lines too long for the usual width. */
  wideHint?: boolean
  /** Sized for a workspace row's title line rather than a sidebar item. */
  small?: boolean
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-hidden="true"
          className={cn(
            'rounded-full text-center tabular-nums',
            small ? 'min-w-4 px-1 text-[10px] leading-4' : 'min-w-5 px-1.5 text-2xs leading-5',
            tone === 'red' && 'bg-chip-tone-red/15 text-chip-tone-red',
            tone === 'amber' && 'bg-chip-tone-amber/15 text-chip-tone-amber',
            tone === 'neutral' && 'bg-worktree-sidebar-foreground/10'
          )}
        >
          {count}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={8}
        className={cn('max-w-72', wideHint && 'max-w-[28rem]')}
      >
        {hint}
      </TooltipContent>
    </Tooltip>
  )
}
