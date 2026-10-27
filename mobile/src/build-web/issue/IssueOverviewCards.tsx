import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { BuildWebIssueDetail } from '../../../../src/shared/build-web-types'
import type { BuildWebRun } from '../../../../src/shared/build-web-run-types'
import { imageTally } from '../../../../src/renderer/src/components/build-web/issue/issue-card-facts'
import { runStatusTone } from '../../../../src/renderer/src/components/build-web/build-web-tones'
import { chipTones, colors, spacing } from '../../theme/mobile-theme'
import { BuildWebToneChip, JiraStatusLine } from '../BuildWebToneChip'
import { CardButton, MutedText, OverviewPanel, ui } from './issue-card-ui'
import { JiraDraftSheet } from './tabs/guide/JiraDraftSheet'

// The overview's cards that build-web shows beside «Properties»: the build at a glance, the work's
// branches, and the task's Jira issue — or the way to file one.

function tallyLine(t: { ok: number; failed: number; total: number }): string {
  if (!t.total) {
    return 'no images'
  }
  const head = `${t.ok} of ${t.total} images built`
  return t.failed ? `${head} · ${t.failed} failed` : head
}

export function BuildSummaryCard({
  run,
  onOpenBuild
}: {
  run: BuildWebRun | null | undefined
  onOpenBuild: () => void
}) {
  const tally = run ? imageTally(run) : null
  const rest = tally ? tally.total - tally.ok - tally.failed : 0
  return (
    <OverviewPanel
      title="Build"
      action={run ? <BuildWebToneChip label={run.status} tone={runStatusTone(run.status)} /> : null}
    >
      {run && tally ? (
        <>
          <View style={styles.bars}>
            {tally.ok > 0 ? (
              <View
                style={[styles.bar, { flexGrow: tally.ok, backgroundColor: chipTones.green }]}
              />
            ) : null}
            {tally.failed > 0 ? (
              <View
                style={[styles.bar, { flexGrow: tally.failed, backgroundColor: chipTones.red }]}
              />
            ) : null}
            {rest > 0 ? (
              <View
                style={[styles.bar, { flexGrow: rest, backgroundColor: colors.borderSubtle }]}
              />
            ) : null}
          </View>
          <MutedText>{tallyLine(tally)}</MutedText>
        </>
      ) : (
        <MutedText>{run === undefined ? 'Loading…' : 'No builds yet.'}</MutedText>
      )}
      <Text style={ui.link} onPress={onOpenBuild} accessibilityRole="link">
        {run ? 'Open the «Build» tab →' : 'Build →'}
      </Text>
    </OverviewPanel>
  )
}

export function WorkCard({ detail }: { detail: BuildWebIssueDetail }) {
  return (
    <OverviewPanel title="Work">
      {detail.branches.map((branch, n) => (
        <View key={branch} style={ui.row}>
          <BuildWebToneChip label={branch} tone={null} mono />
          {n === 0 ? <MutedText>— build</MutedText> : null}
        </View>
      ))}
      <MutedText>Commits prefixed {detail.key}</MutedText>
    </OverviewPanel>
  )
}

export function JiraCard({
  detail,
  onCreated
}: {
  detail: BuildWebIssueDetail
  onCreated: () => void
}) {
  const [drafting, setDrafting] = useState(false)
  return (
    <OverviewPanel
      title="Jira"
      action={
        detail.jira_key ? null : <CardButton label="Create" onPress={() => setDrafting(true)} />
      }
    >
      {detail.jira_key ? (
        <View style={styles.jira}>
          <JiraStatusLine jiraKey={detail.jira_key} status={detail.jira_status} />
          <MutedText>Fix versions {detail.jira_fix_version || '—'}</MutedText>
        </View>
      ) : (
        <MutedText>not linked — the draft can be edited before it is sent</MutedText>
      )}
      <JiraDraftSheet
        issueId={detail.id}
        visible={drafting}
        onClose={() => setDrafting(false)}
        onCreated={() => {
          setDrafting(false)
          onCreated()
        }}
      />
    </OverviewPanel>
  )
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', gap: spacing.xs },
  bar: { height: 6, borderRadius: 3 },
  jira: { gap: spacing.xs }
})
