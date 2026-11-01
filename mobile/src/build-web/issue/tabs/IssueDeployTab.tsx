import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ChevronDown } from 'lucide-react-native'
import type { BuildWebDeployNotesJob } from '../../../../../src/shared/build-web-types'
import {
  failedSinceNote,
  isWritingDeployNotes
} from '../../../../../src/renderer/src/components/build-web/issue/plan/deploy-notes-job'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { MobileMarkdown } from '../../../components/MobileMarkdown'
import { PickerModal } from '../../../components/PickerModal'
import { colors, radii, spacing, typography } from '../../../theme/mobile-theme'
import type { BuildWebIssueTabProps } from '../../build-web-card-tabs'
import { loginOf } from '../../build-web-labels'
import { GuideButton } from './guide/GuideButton'
import type { IssueDeployNotes } from './plan/use-issue-deploy-notes'
import { useIssuePlan } from './plan/use-issue-plan'

const whenOf = (job: BuildWebDeployNotesJob) =>
  new Date(job.finished_at ?? job.created_at).toLocaleString()

/** What the last generation left, when it left no note. */
function JobState({
  job,
  error
}: {
  job: BuildWebDeployNotesJob | null | undefined
  error: string | null
}) {
  if (error) {
    return <Text style={styles.error}>{error}</Text>
  }
  if (job === undefined) {
    return <LoadingSpinner size={16} color={colors.textMuted} />
  }
  if (!job) {
    return (
      <Text style={styles.stateText}>
        No deploy note yet. build-web writes one when the task goes to “Deploying”.
      </Text>
    )
  }
  if (isWritingDeployNotes(job)) {
    return (
      <View style={styles.writingRow}>
        <LoadingSpinner size={14} color={colors.textMuted} />
        <Text style={styles.stateText}>
          The model reads the task’s commits and writes the note — up to twenty minutes. Started{' '}
          {new Date(job.created_at).toLocaleString()}.
        </Text>
      </View>
    )
  }
  if (job.status === 'failed') {
    return (
      <Text style={styles.error}>
        Could not write the note ({whenOf(job)}): {job.message ?? 'no reason recorded'}
      </Text>
    )
  }
  if (job.status === 'cancelled') {
    return <Text style={styles.stateText}>Writing the note was cancelled {whenOf(job)}.</Text>
  }
  // Why: a success without a reason wrote a note, and the note was taken out of the tab since.
  return (
    <Text style={styles.stateText}>
      {job.message
        ? `Checked ${whenOf(job)}: ${job.message}.`
        : `A note was written ${whenOf(job)} and taken out of the tab since.`}
    </Text>
  )
}

/**
 * The desktop's Deploy tab: the note for the deployment engineers (IS-341) that build-web writes
 * when the task goes out; a task that changes nothing for them gets none.
 */
export function IssueDeployTab({
  detail,
  notes
}: BuildWebIssueTabProps & { notes: IssueDeployNotes }) {
  const note = useIssuePlan(detail, 'deploy')
  const { plans: files, shown, text, error } = note
  const { job } = notes
  const [picking, setPicking] = useState(false)
  const writing = isWritingDeployNotes(job)
  const again = (
    <GuideButton
      label={job ? 'Write again' : 'Write'}
      compact
      busy={notes.starting}
      disabled={writing || notes.starting || job === undefined}
      onPress={notes.start}
    />
  )
  if (!shown) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.empty}>
          <JobState job={job} error={notes.error} />
          {again}
        </View>
      </ScrollView>
    )
  }
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.meta}>
        {files.length > 1 ? (
          <Pressable
            style={styles.picker}
            onPress={() => setPicking(true)}
            accessibilityRole="button"
            accessibilityLabel={`Note file: ${shown.name}`}
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
      <View style={styles.actions}>{again}</View>
      {writing ? (
        <View style={styles.writingRow}>
          <LoadingSpinner size={12} color={colors.textMuted} />
          <Text style={styles.metaText}>
            A new note is being written — this one will be replaced or removed.
          </Text>
        </View>
      ) : null}
      {failedSinceNote(job, shown.created_at) ? (
        <Text style={styles.warning}>
          {job.status === 'failed'
            ? `Could not write a new note (${whenOf(job)}): ${job.message ?? 'no reason recorded'}. The earlier one is below.`
            : `Writing a new note was cancelled ${whenOf(job)}. The earlier one is below.`}
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {text === null && !error ? <LoadingSpinner size={16} color={colors.textMuted} /> : null}
      {text !== null ? <MobileMarkdown content={text} /> : null}
      <PickerModal
        visible={picking}
        title="Note file"
        options={files.map((f) => ({
          value: f.id,
          label: f.name,
          subtitle: `${loginOf(f.created_by)} · ${new Date(f.created_at).toLocaleString()}`
        }))}
        selected={shown.id}
        onSelect={(id) => {
          note.choose(id)
          setPicking(false)
        }}
        onClose={() => setPicking(false)}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderSubtle,
    borderRadius: radii.row,
    paddingHorizontal: spacing.lg,
    paddingVertical: 40
  },
  stateText: { color: colors.textSecondary, fontSize: typography.bodySize, textAlign: 'center' },
  writingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row' },
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
  metaText: { color: colors.textSecondary, fontSize: typography.metaSize, flexShrink: 1 },
  warning: { color: colors.statusAmber, fontSize: typography.metaSize },
  error: { color: colors.statusRed, fontSize: typography.bodySize, textAlign: 'center' }
})
