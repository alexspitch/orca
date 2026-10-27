import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ChevronDown } from 'lucide-react-native'
import { planProgress } from '../../../../../src/renderer/src/components/build-web/issue/plan/issue-file-roles'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { MobileMarkdown } from '../../../components/MobileMarkdown'
import { PickerModal } from '../../../components/PickerModal'
import { colors, radii, spacing, typography } from '../../../theme/mobile-theme'
import type { BuildWebIssueTabProps } from '../../build-web-card-tabs'
import { loginOf } from '../../build-web-labels'
import { IssueAttachHint } from './plan/IssueAttachHint'
import { useIssuePlan } from './plan/use-issue-plan'

/**
 * The task's plan, drawn from its markdown. Read only, as in build-web: the plan lives in the
 * agent's `.claude/plans/` and is attached again after each change.
 */
export function IssuePlanTab({ detail }: BuildWebIssueTabProps) {
  const plan = useIssuePlan(detail)
  const { plans, shown, text, error } = plan
  const [picking, setPicking] = useState(false)
  if (!shown) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <IssueAttachHint
          text="The task has no plan. Attach one with"
          command={`bw.sh attach ${detail.key} <plan.md> --plan`}
        />
      </ScrollView>
    )
  }
  const progress = text ? planProgress(text) : null
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.meta}>
        {plans.length > 1 ? (
          <Pressable
            style={styles.picker}
            onPress={() => setPicking(true)}
            accessibilityRole="button"
            accessibilityLabel={`Plan file: ${shown.name}`}
          >
            <Text style={styles.pickerText} numberOfLines={1}>
              {shown.name}
            </Text>
            <ChevronDown size={14} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <Text style={styles.fileName}>{shown.name}</Text>
        )}
        <Text style={styles.metaText}>
          · {loginOf(shown.created_by)} · {new Date(shown.created_at).toLocaleString()}
        </Text>
      </View>
      {progress && progress.total > 0 ? (
        <View style={styles.progressRow}>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityLabel="Plan progress"
            accessibilityValue={{ min: 0, max: progress.total, now: progress.done }}
          >
            <View style={[styles.fill, { width: `${(progress.done / progress.total) * 100}%` }]} />
          </View>
          <Text style={styles.metaText}>
            {progress.done} of {progress.total} done
          </Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {text === null && !error ? <LoadingSpinner size={16} color={colors.textMuted} /> : null}
      {text !== null ? <MobileMarkdown content={text} /> : null}
      <PickerModal
        visible={picking}
        title="Plan file"
        options={plans.map((p) => ({
          value: p.id,
          label: p.name,
          subtitle: `${loginOf(p.created_by)} · ${new Date(p.created_at).toLocaleString()}`
        }))}
        selected={shown.id}
        onSelect={(id) => {
          plan.choose(id)
          setPicking(false)
        }}
        onClose={() => setPicking(false)}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '100%',
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised
  },
  pickerText: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  fileName: {
    color: colors.textSecondary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  metaText: { color: colors.textSecondary, fontSize: typography.metaSize },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.bgRaised
  },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.accentBlue },
  error: { color: colors.statusRed, fontSize: typography.bodySize }
})
