import { ScrollView, StyleSheet } from 'react-native'
import { spacing } from '../../theme/mobile-theme'
import { FilterPill } from '../list/list-controls'

/**
 * build-web's filter chips: a toggle per value with its count; none on means no filter. Without
 * `counts` every option shows, unnumbered.
 */
export function ImageFilterChips<T extends string>({
  options,
  counts,
  selected,
  label,
  onToggle
}: {
  options: readonly T[]
  counts?: Record<string, number>
  selected: readonly T[]
  label: (value: T) => string
  onToggle: (value: T) => void
}) {
  const shown = counts
    ? options.filter((value) => (counts[value] ?? 0) > 0 || selected.includes(value))
    : [...options, ...selected.filter((value) => !options.includes(value))]
  if (shown.length === 0) {
    return null
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {shown.map((value) => (
        <FilterPill
          key={value}
          label={counts ? `${label(value)} · ${counts[value] ?? 0}` : label(value)}
          pressed={selected.includes(value)}
          onPress={() => onToggle(value)}
        />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  // Why: a horizontal ScrollView in a column grows to fill it on web.
  scroll: { flexGrow: 0 },
  row: { gap: spacing.xs, paddingHorizontal: spacing.md }
})
