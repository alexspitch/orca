import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Bot, SquareTerminal } from 'lucide-react-native'
import type { BuildWebIssueDetail } from '../../../../src/shared/build-web-types'
import type { BuildWebAgentSessionRecord } from '../../../../src/shared/build-web-session-types'
import {
  BUILD_WEB_SESSION_STATE_LABELS,
  sessionHistoryLabel,
  sessionReasonLabels
} from '../../../../src/shared/build-web-session-labels'
import {
  joinSessionRows,
  type BuildWebSessionRow
} from '../../../../src/shared/build-web-session-rows'
import { sessionStateTone } from '../../../../src/renderer/src/components/build-web/build-web-tones'
import { chipTones, colors, radii, spacing, typography } from '../../theme/mobile-theme'
import type { RpcClient } from '../../transport/rpc-client'
import type { Worktree } from '../../worktree/workspace-list-types'
import { loginOf } from '../build-web-labels'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { useBuildWebScreen } from '../build-web-screen-context'
import { useOpenBuildWebSession } from '../list/use-open-build-web-session'
import { ui } from './issue-card-ui'
import { SessionTranscriptSheet } from './SessionTranscriptSheet'
import { useSessionLogClients, useSessionWorktrees } from './use-session-hosts'

const when = (iso: string | null): string => (iso ? new Date(iso).toLocaleString() : '')

function SessionRow({
  row,
  onOpen,
  onLog
}: {
  row: BuildWebSessionRow<Worktree>
  onOpen: (worktree: Worktree) => void
  /** Absent when the host cannot hand out the log, or the agent's own session id is unknown. */
  onLog?: () => void
}) {
  const { record, worktree, attention } = row
  const state = attention
    ? BUILD_WEB_SESSION_STATE_LABELS.attention.full.text
    : sessionHistoryLabel(record.state).text
  const note = attention?.reason
    ? (sessionReasonLabels(attention.reason)?.full ?? BUILD_WEB_SESSION_STATE_LABELS.attention.full)
        .text
    : record.removal_note
  const ended = record.ended_at ?? record.agent_finished_at
  return (
    <View style={styles.row}>
      <View style={ui.wrapRow}>
        <BuildWebToneChip
          label={state}
          tone={sessionStateTone(attention ? 'attention' : record.state)}
        />
        {worktree ? (
          <Text
            style={[styles.worktree, styles.link]}
            accessibilityRole="link"
            onPress={() => onOpen(worktree)}
          >
            {worktree.displayName || record.worktree_name}
          </Text>
        ) : (
          <Text style={styles.worktree}>{record.worktree_name || '—'}</Text>
        )}
        {onLog ? (
          <Text style={[styles.worktree, styles.link]} accessibilityRole="button" onPress={onLog}>
            Log
          </Text>
        ) : null}
      </View>
      <Text style={ui.muted}>
        {[record.agent, record.by ? loginOf(record.by) : ''].filter(Boolean).join(' · ')} ·{' '}
        {ended ? `${when(record.started_at)} – ${when(ended)}` : when(record.started_at)}
      </Text>
      {note ? <Text style={attention ? styles.attention : ui.muted}>{note}</Text> : null}
    </View>
  )
}

/**
 * The task's sessions, newest first, each with its workspace when the host still has it. A
 * console without session history names only the current one, as a chip that opens it.
 */
export function IssueSessions({
  detail
}: {
  detail: Pick<
    BuildWebIssueDetail,
    'id' | 'agent_session' | 'agent_session_state' | 'agent_sessions'
  >
}) {
  const { client, status, hostCapabilities } = useBuildWebScreen()
  const session = useOpenBuildWebSession()
  const [logOf, setLogOf] = useState<{
    record: BuildWebAgentSessionRecord
    client: RpcClient
  } | null>(null)
  const records = detail.agent_sessions
  const worktrees = useSessionWorktrees(client, session.listWorktrees, Boolean(records?.length))
  const rows = useMemo(
    () => (records ? joinSessionRows(records, worktrees, detail.id, status.baseUrl ?? '') : []),
    [detail.id, records, status.baseUrl, worktrees]
  )
  const logClients = useSessionLogClients(client, hostCapabilities, rows)
  if (!records) {
    const current = detail.agent_session
    return current ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open the agent session"
        disabled={session.opening}
        onPress={() => void session.open(detail)}
        style={({ pressed }) => [styles.chip, pressed ? styles.pressed : null]}
      >
        <SquareTerminal size={14} color={chipTones.blue} />
        <Text style={styles.chipText} numberOfLines={1}>
          {current.agent} · {current.worktree_name}
          {current.by ? ` · ${loginOf(current.by)}` : ''}
        </Text>
      </Pressable>
    ) : null
  }
  if (rows.length === 0) {
    return null
  }
  return (
    <View style={styles.panel}>
      <View style={ui.row}>
        <Bot size={14} color={chipTones.purple} />
        <Text style={ui.sectionTitle}>Sessions</Text>
      </View>
      {rows.map((row) => {
        const logClient = row.record.provider_session_id ? logClients.get(row.record.id) : undefined
        return (
          <SessionRow
            key={row.record.id}
            row={row}
            onOpen={(worktree) => session.openWorktree(worktree)}
            {...(logClient
              ? { onLog: () => setLogOf({ record: row.record, client: logClient }) }
              : {})}
          />
        )
      })}
      <SessionTranscriptSheet open={logOf} onClose={() => setLogOf(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  row: { gap: 2 },
  worktree: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  link: { color: colors.accentBlue },
  attention: { color: colors.statusAmber, fontSize: typography.metaSize, lineHeight: 17 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  chipText: { color: chipTones.blue, fontSize: typography.metaSize, flexShrink: 1 },
  pressed: { opacity: 0.7 }
})
