import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SquareCheck, Square } from 'lucide-react-native'
import type { BuildWebRun } from '../../../../../../src/shared/build-web-run-types'
import { ConfirmModal } from '../../../../components/ConfirmModal'
import { openExternalLink } from '../../../../platform/external-link'
import { colors, radii, spacing } from '../../../../theme/mobile-theme'
import { GuideButton } from './GuideButton'
import { guideStyles } from './guide-tab-styles'

/** One place the guide goes, and whether it goes there. */
function PublishTarget({
  checked,
  title,
  note
}: {
  checked: boolean
  title: string
  note: string
}) {
  const Icon = checked ? SquareCheck : Square
  return (
    <View style={[styles.target, !checked && styles.targetOff]}>
      <Icon size={16} color={checked ? colors.textPrimary : colors.textMuted} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[guideStyles.body, { fontWeight: '500' }, !checked && styles.off]}>
          {title}
        </Text>
        <Text style={guideStyles.meta}>{note}</Text>
      </View>
    </View>
  )
}

/** «Куда публиковать»: the task's card always, its Jira issue on a confirmed press. */
export function GuidePublishCard({
  run,
  jiraKey,
  hasGuide,
  posting,
  result,
  onPublish
}: {
  run: BuildWebRun
  jiraKey: string | null
  hasGuide: boolean
  posting: boolean
  result: { action: string; url: string } | null
  onPublish: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  return (
    <View style={guideStyles.card}>
      <Text style={guideStyles.heading}>Where to publish</Text>
      {run.issue_id ? (
        <PublishTarget
          checked
          title="Comment on the task’s card"
          note="written by itself when the guide is saved, and updated rather than repeated"
        />
      ) : null}
      <PublishTarget
        checked={Boolean(jiraKey)}
        title={jiraKey ? `Comment in Jira · ${jiraKey}` : 'Comment in Jira'}
        note={
          jiraKey
            ? run.jira_action
              ? `last published: ${run.jira_action}`
              : 'not published yet'
            : 'the task has no Jira issue — nowhere to publish'
        }
      />
      <Text style={guideStyles.meta}>
        The «Where it lives in the code» section is cut before publishing.
      </Text>
      <GuideButton
        variant="primary"
        busy={posting}
        label={posting ? 'Publishing…' : run.jira_action ? 'Update the comment' : 'Publish'}
        disabled={posting || !hasGuide || !jiraKey}
        onPress={() => setConfirming(true)}
      />
      {result && jiraKey ? (
        <Text style={guideStyles.success}>
          {result.action === 'created' ? 'Comment created —' : 'Comment updated —'}{' '}
          <Text style={styles.underline} onPress={() => openExternalLink(result.url)}>
            open {jiraKey}
          </Text>
        </Text>
      ) : null}
      {run.jira_url && !result && jiraKey ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => run.jira_url && openExternalLink(run.jira_url)}
        >
          <Text style={guideStyles.link}>open the comment in {jiraKey}</Text>
        </Pressable>
      ) : null}
      <ConfirmModal
        visible={confirming && Boolean(jiraKey)}
        title="Publish the guide?"
        message={`Everyone who opens ${jiraKey ?? ''} in Jira will see the guide. Publish?`}
        confirmLabel="Publish"
        onConfirm={onPublish}
        onCancel={() => setConfirming(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  target: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
    borderRadius: radii.row,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2
  },
  targetOff: { backgroundColor: colors.bgRaised },
  off: { color: colors.textMuted },
  underline: { textDecorationLine: 'underline' }
})
