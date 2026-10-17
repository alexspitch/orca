import { cn } from '@/lib/utils'

/** build-web's filter chips: a toggle per value with its count; none on means no filter. */
export function FilterChips<T extends string>({
  options,
  counts,
  selected,
  label,
  onToggle
}: {
  options: readonly T[]
  counts: Record<string, number>
  selected: readonly T[]
  label: (value: T) => string
  onToggle: (value: T) => void
}): React.JSX.Element {
  return (
    <>
      {options
        .filter((value) => (counts[value] ?? 0) > 0 || selected.includes(value))
        .map((value) => {
          const on = selected.includes(value)
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(value)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                on
                  ? 'border-ring bg-accent text-accent-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {label(value)} · {counts[value] ?? 0}
            </button>
          )
        })}
    </>
  )
}
