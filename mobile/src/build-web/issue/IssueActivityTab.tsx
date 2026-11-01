import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import type { BuildWebIssueEvent } from '../../../../src/shared/build-web-types'
import {
  ISSUE_ACTIVITY_GROUPS,
  activityActorOf,
  activityResultOf,
  activityRowsOf,
  type IssueActivityGroup
} from '../../../../src/renderer/src/components/build-web/issue/issue-activity'
import { isJiraLogin } from '../../../../src/renderer/src/components/build-web/issue/issue-tester'
import { chipTones, colors, spacing, typography } from '../../theme/mobile-theme'
import { personLabel } from '../build-web-labels'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { FilterPill } from '../list/list-controls'
import { MutedText, OverviewPanel } from './issue-card-ui'
import { useBuildWebTesters } from './IssueTester'

const GROUP_LABEL: Record<IssueActivityGroup, string> = {
  all: 'All',
  changes: 'Changes',
  talk: 'Comments & files',
  notify: 'Notifications',
  build: 'Builds',
  guide: 'Guide & Jira'
}

const RESULT_WORDS = {
  delivered: 'delivered',
  success: 'success',
  notDelivered: 'not delivered',
  failed: 'failed',
  cancelled: 'cancelled'
}

const ACTOR_WORDS = { train: (name: string) => `train ${name}`, watch: 'watcher', ai: 'AI' }

function ActivityRow({ event: e, author }: { event: BuildWebIssueEvent; author: string }) {
  const result = activityResultOf(e, RESULT_WORDS)
  const at = new Date(e.created_at)
  const when = Number.isNaN(at.getTime()) ? '' : at.toLocaleString()
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <View style={styles.meta}>
          <MutedText>{[author, when].filter(Boolean).join(' · ')}</MutedText>
        </View>
        {result ? <BuildWebToneChip label={result.label} tone={result.tone} /> : null}
      </View>
      <Text style={styles.text}>{e.text}</Text>
      {/* Why spelled out: the phone has no hover for the console's reason. */}
      {result?.hint ? <Text style={styles.reason}>{result.hint}</Text> : null}
    </View>
  )
}

/** The desktop's IssueActivityTab (IS-354): the task's changes and operations, newest first, as a list. */
export function IssueActivityTab({ events }: { events: readonly BuildWebIssueEvent[] }) {
  const [group, setGroup] = useState<IssueActivityGroup>('all')
  const rows = useMemo(() => activityRowsOf(events, group), [events, group])
  // Why only then: the console's people are needed only to name somebody known from Jira.
  const { people } = useBuildWebTesters(events.some((e) => isJiraLogin(e.author)))
  return (
    <OverviewPanel title="Activity" action={<MutedText>{String(rows.length)}</MutedText>}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filters}
        contentContainerStyle={styles.filterRow}
      >
        {ISSUE_ACTIVITY_GROUPS.map((g) => (
          <FilterPill
            key={g}
            label={GROUP_LABEL[g]}
            pressed={g === group}
            onPress={() => setGroup(g)}
          />
        ))}
      </ScrollView>
      {rows.length ? (
        <View style={styles.list}>
          {rows.map((e) => (
            <ActivityRow
              key={e.id}
              event={e}
              author={activityActorOf(e.author, ACTOR_WORDS, (who) => personLabel(who, people))}
            />
          ))}
        </View>
      ) : (
        <MutedText>Nothing here yet.</MutedText>
      )}
    </OverviewPanel>
  )
}

const styles = StyleSheet.create({
  // Why: a horizontal ScrollView in a column grows to fill it on web.
  filters: { flexGrow: 0 },
  filterRow: { gap: spacing.xs },
  list: { gap: spacing.md },
  row: { gap: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { flex: 1, minWidth: 0 },
  text: { color: colors.textPrimary, fontSize: typography.bodySize },
  reason: { color: chipTones.red, fontSize: typography.metaSize }
})
