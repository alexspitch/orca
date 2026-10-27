import { StyleSheet, Text, View } from 'react-native'
import type { BuildWebIssueRow } from '../../../../src/shared/build-web-types'
import { colors, radii, spacing, typography } from '../../theme/mobile-theme'
import { BuildWebToneChip, ProductChip } from '../BuildWebToneChip'
import { CardButton } from '../issue/issue-card-ui'
import { batchCheckMessage, validateBuildWebBatch } from '../take-to-work/build-web-take-to-work'

/** The picked tasks and «Take to work», refused for a mix of products or releases. */
export function IssueSelectionBar({
  picked,
  onClear,
  onTakeToWork
}: {
  picked: BuildWebIssueRow[]
  onClear: () => void
  onTakeToWork: (issues: BuildWebIssueRow[]) => void
}) {
  if (picked.length === 0) {
    return null
  }
  const check = validateBuildWebBatch(picked)
  const reason = batchCheckMessage(check)
  return (
    <View style={styles.bar}>
      <View style={styles.line}>
        <Text style={styles.count}>{picked.length} selected</Text>
        {check.ok ? (
          <>
            <ProductChip product={picked[0].product} />
            <BuildWebToneChip
              label={picked[0].version_name ?? 'No release'}
              tone={null}
              mono={Boolean(picked[0].version_name)}
            />
          </>
        ) : null}
        <View style={styles.grow} />
        <CardButton variant="ghost" label="Clear" onPress={onClear} />
        <CardButton
          variant="primary"
          label={`Take to work (${picked.length})`}
          disabled={!check.ok}
          onPress={() => onTakeToWork(picked)}
        />
      </View>
      {reason ? <Text style={styles.reason}>{reason}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    margin: spacing.md,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  count: { color: colors.textPrimary, fontSize: typography.bodySize, fontWeight: '600' },
  reason: { color: colors.statusRed, fontSize: typography.metaSize }
})
