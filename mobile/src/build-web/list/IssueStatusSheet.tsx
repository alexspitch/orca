import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { BUILD_WEB_STATUSES, type BuildWebStatus } from '../../../../src/shared/build-web-types'
import { BottomDrawer } from '../../components/BottomDrawer'
import { colors, spacing, typography } from '../../theme/mobile-theme'
import { statusLabel } from '../build-web-labels'
import { StatusChip } from '../BuildWebToneChip'
import { OPEN_STATUSES, sameStatuses, TO_WORK_STATUSES } from './issue-list-query'

/** What the status button says: a preset's name, the one status, or how many. */
export function statusSummaryOf(statuses: ReadonlySet<BuildWebStatus>): string {
  if (statuses.size === 0) {
    return 'Any status'
  }
  if (sameStatuses(statuses, OPEN_STATUSES)) {
    return 'Open'
  }
  if (sameStatuses(statuses, TO_WORK_STATUSES)) {
    return 'To work'
  }
  const only = BUILD_WEB_STATUSES.find((s) => statuses.has(s))
  return statuses.size === 1 && only ? statusLabel(only) : `${statuses.size} statuses`
}

/** Several statuses at once, with the console's presets one tap away; it stays open while ticking. */
export function IssueStatusSheet({
  visible,
  statuses,
  onToggle,
  onSet,
  onClose
}: {
  visible: boolean
  statuses: ReadonlySet<BuildWebStatus>
  onToggle: (status: BuildWebStatus) => void
  onSet: (statuses: readonly BuildWebStatus[]) => void
  onClose: () => void
}) {
  const preset = (label: string, list: readonly BuildWebStatus[]) => (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.preset, pressed ? styles.pressed : null]}
      onPress={() => {
        onSet(list)
        onClose()
      }}
    >
      <Text style={styles.presetText}>{label}</Text>
    </Pressable>
  )
  return (
    <BottomDrawer visible={visible} onClose={onClose}>
      <Text style={styles.title}>Status</Text>
      <View style={styles.presets}>
        {preset('Open', OPEN_STATUSES)}
        {preset('To work', TO_WORK_STATUSES)}
        {preset('Any status', [])}
      </View>
      <ScrollView style={styles.list}>
        {BUILD_WEB_STATUSES.map((status) => {
          const on = statuses.has(status)
          return (
            <Pressable
              key={status}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={statusLabel(status)}
              onPress={() => onToggle(status)}
              style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
            >
              <View style={styles.check}>
                {on ? <Check size={16} color={colors.textPrimary} /> : null}
              </View>
              <StatusChip status={status} />
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
  pressed: { backgroundColor: colors.bgRaised }
})
