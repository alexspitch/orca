import { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  BUILD_WEB_SUBTASK_STATUSES,
  type BuildWebIssueDetail,
  type BuildWebIssueRow
} from '../../../../src/shared/build-web-types'
import {
  createLiveReads,
  createLiveReplyGuard,
  sameReading
} from '../../../../src/shared/build-web-live-reads'
import { PickerModal } from '../../components/PickerModal'
import { chipTones, colors, spacing, typography } from '../../theme/mobile-theme'
import { statusLabel } from '../build-web-labels'
import { buildWebErrorMessage } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'
import { StatusChip } from '../BuildWebToneChip'
import { useCardTabActive } from '../build-web-card-tabs'
import { useIssueRowActions } from '../list/use-issue-row-actions'
import { useLiveRead } from '../use-live-read'
import { ErrorText, MutedText } from './issue-card-ui'

const childReads = createLiveReads<BuildWebIssueRow[]>()

/** What stops the task while subtasks are open; empty when none are. */
export function blockedBySubtasks(issue: Pick<BuildWebIssueRow, 'children_open'>): string {
  return issue.children_open > 0
    ? `Open subtasks: ${issue.children_open} — the task will not close or go out to deploy.`
    : ''
}

/**
 * A task's subtasks, as build-web's card lists them: number, title and status, moved right here.
 * A tap on the number opens the subtask; a move reads the task again, since it may hold it. Read
 * again every few seconds while the tab is shown.
 */
export function IssueSubtasksTab({
  detail,
  onChanged
}: {
  detail: BuildWebIssueDetail
  onChanged: () => void
}) {
  const { call, hostId, openIssue } = useBuildWebScreen()
  const active = useCardTabActive()
  const [children, setChildren] = useState<BuildWebIssueRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState<BuildWebIssueRow | null>(null)
  const [guard] = useState(createLiveReplyGuard)
  const patchChild = useCallback(
    (id: string, patch: Partial<BuildWebIssueRow>) => {
      guard.mark()
      setChildren(
        (rows) => rows?.map((row) => (row.id === id ? { ...row, ...patch } : row)) ?? null
      )
    },
    [guard]
  )
  const rows = useIssueRowActions({ patchIssue: patchChild })

  const load = useCallback(async () => {
    guard.mark()
    try {
      setChildren(await call('listIssueChildren', { id: detail.id }))
      setError(null)
    } catch (failure) {
      setError(buildWebErrorMessage(failure))
    }
  }, [call, detail.id, guard])
  useEffect(() => {
    void load()
  }, [load])
  const writing = rows.busy.size > 0
  useLiveRead(
    childReads,
    `${hostId}|${detail.id}`,
    active,
    () => call('listIssueChildren', { id: detail.id }),
    (next, issuedAt) => {
      // Why not while a move is out: its row shows the move before the console has it.
      if (!writing && guard.accepts(issuedAt)) {
        setChildren((shown) => (shown && sameReading(shown, next) ? shown : next))
        setError(null)
      }
    }
  )

  const blocked = blockedBySubtasks(detail)
  return (
    <View style={styles.list}>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {children === null && !error ? <MutedText>Loading…</MutedText> : null}
      {children?.map((child) => (
        <View key={child.id} style={styles.row}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${child.key}`}
            onPress={() => openIssue(child.id)}
            hitSlop={6}
          >
            <Text style={styles.key}>{child.key}</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={2}>
            {child.title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Change the status of ${child.key}`}
            disabled={rows.busy.has(child.id)}
            onPress={() => setPicking(child)}
            style={rows.busy.has(child.id) ? styles.busy : null}
          >
            <StatusChip status={child.status} />
          </Pressable>
        </View>
      ))}
      {children?.length === 0 ? (
        <MutedText>
          No subtasks. A problem found while checking the task is filed under it in build-web.
        </MutedText>
      ) : null}
      {blocked ? <Text style={styles.blocked}>{blocked}</Text> : null}
      <PickerModal<string>
        visible={picking !== null}
        title={`Status of ${picking?.key ?? ''}`}
        options={BUILD_WEB_SUBTASK_STATUSES.map((s) => ({
          value: s,
          label: statusLabel(s),
          disabled: s === picking?.status
        }))}
        selected={picking?.status ?? ''}
        onSelect={(value) => {
          const child = picking
          setPicking(null)
          const status = BUILD_WEB_SUBTASK_STATUSES.find((s) => s === value)
          if (child && status && status !== child.status) {
            void rows.patch(child, { status }).then(() => {
              void load()
              onChanged()
            })
          }
        }}
        onClose={() => setPicking(null)}
      />
      {rows.confirmElement}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  key: {
    color: colors.textMuted,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  title: { flex: 1, minWidth: 0, color: colors.textPrimary, fontSize: typography.bodySize },
  busy: { opacity: 0.5 },
  blocked: { color: chipTones.amber, fontSize: typography.metaSize }
})
