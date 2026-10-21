import { cn } from '@/lib/utils'

/** The number on a titlebar icon (the trigger must be `relative`); the trigger's label says it. */
export function ActivityCountBadge({
  count,
  tone
}: {
  count: number
  tone: 'red' | 'primary'
}): React.JSX.Element | null {
  if (count <= 0) {
    return null
  }
  return (
    <span
      aria-hidden
      className={cn(
        'absolute -top-0.5 -right-0.5 flex h-3 min-w-3 items-center justify-center rounded-full px-0.5 text-[9px] font-medium leading-none tabular-nums',
        tone === 'red' ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground'
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
