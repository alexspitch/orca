import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

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
  const shown = options.filter((value) => (counts[value] ?? 0) > 0 || selected.includes(value))
  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      size="xs"
      spacing={1}
      value={[...selected]}
      onValueChange={(next) => {
        // Why: one click changes one chip; the callers keep the toggle semantics.
        const changed = shown.find((value) => next.includes(value) !== selected.includes(value))
        if (changed) {
          onToggle(changed)
        }
      }}
    >
      {shown.map((value) => (
        <ToggleGroupItem key={value} value={value}>
          {label(value)} · {counts[value] ?? 0}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
