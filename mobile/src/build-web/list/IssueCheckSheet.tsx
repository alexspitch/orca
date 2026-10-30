import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { BottomDrawer } from '../../components/BottomDrawer'
import { colors, spacing, typography } from '../../theme/mobile-theme'

export type IssueCheckOption = {
  value: string
  label: string
  /** Drawn in place of the label, which stays the accessible name. */
  chip?: ReactNode
  subtitle?: string
}

/** Several values at once, as the status sheet; it stays open while ticking, the reset closes it. */
export function IssueCheckSheet({
  visible,
  title,
  resetLabel,
  options,
  selected,
  onToggle,
  onReset,
  onClose
}: {
  visible: boolean
  title: string
  resetLabel: string
  options: readonly IssueCheckOption[]
  selected: ReadonlySet<string>
  onToggle: (value: string) => void
  onReset: () => void
  onClose: () => void
}) {
  return (
    <BottomDrawer visible={visible} onClose={onClose}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.presets}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.preset, pressed ? styles.pressed : null]}
          onPress={() => {
            onReset()
            onClose()
          }}
        >
          <Text style={styles.presetText}>{resetLabel}</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.list}>
        {options.map((option) => {
          const on = selected.has(option.value)
          return (
            <Pressable
              key={option.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={option.label}
              onPress={() => onToggle(option.value)}
              style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
            >
              <View style={styles.check}>
                {on ? <Check size={16} color={colors.textPrimary} /> : null}
              </View>
              {option.chip ?? <Text style={styles.label}>{option.label}</Text>}
              {option.subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {option.subtitle}
                </Text>
              ) : null}
            </Pressable>
          )
        })}
      </ScrollView>
    </BottomDrawer>
  )
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm
  },
  presets: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm
  },
  preset: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  presetText: { color: colors.textSecondary, fontSize: typography.metaSize },
  list: { maxHeight: 420 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.lg
  },
  check: { width: 18, alignItems: 'center' },
  label: { color: colors.textPrimary, fontSize: typography.bodySize },
  subtitle: { flexShrink: 1, color: colors.textMuted, fontSize: typography.metaSize },
  pressed: { backgroundColor: colors.bgRaised }
})
