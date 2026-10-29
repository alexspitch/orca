import { useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import type { BuildWebIssueDetail } from '../../../../shared/build-web-types'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { joinSessionRows } from '../../../../shared/build-web-session-rows'
import { BuildWebSessionBadge } from './BuildWebSessionBadge'
import {
  BuildWebSessionList,
  BuildWebSessionRows,
  type SessionListRow
} from './BuildWebSessionList'
import { OverviewPanel } from './issue/IssueOverviewCards'
import { translate } from '@/i18n/i18n'
import { BuildWebSessionLogDialog, type SessionLog } from './BuildWebSessionLogDialog'
import { useBuildWebStore } from './build-web-store'
import { useSessionLogTargets } from './build-web-session-log-target'
import { revealBuildWebSession } from './build-web-session-worktree'

function openRow({ record, worktree }: SessionListRow): void {
  if (!worktree) {
    return
  }
  revealBuildWebSession(
    { worktreeId: worktree.id, ...(worktree.hostId ? { hostId: worktree.hostId } : {}) },
    record.ended_at ? null : record
  )
}

/**
 * The task's sessions, newest first, each with the worktree that held it when it is still here.
 * A console without session history names only the current one.
 */
export function BuildWebTaskSessions({
  target,
  detail,
  panel = false
}: {
  /** The host holding build-web's token, which the card was read through. */
  target: RuntimeClientTarget
  detail: Pick<BuildWebIssueDetail, 'id' | 'agent_session' | 'agent_sessions'>
  /** Drawn as a card of the overview's side column rather than in its own frame. */
  panel?: boolean
}): React.JSX.Element | null {
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const consoleHost = useBuildWebStore((s) => s.status?.baseUrl ?? '')
  const [log, setLog] = useState<SessionLog | null>(null)
  const records = detail.agent_sessions
  const rows = useMemo(
    () =>
      records
        ? joinSessionRows(
            records,
            Object.values(worktreesByRepo).flatMap((list) => list ?? []),
            detail.id,
            consoleHost
          )
        : [],
    [consoleHost, detail.id, records, worktreesByRepo]
  )
  const logTargets = useSessionLogTargets(rows, target)
  const sessionsTitle = translate('buildWeb.session.history', 'Sessions')
  if (!records) {
    if (!detail.agent_session) {
      return null
    }
    const badge = <BuildWebSessionBadge session={detail.agent_session} />
    return panel ? <OverviewPanel title={sessionsTitle}>{badge}</OverviewPanel> : badge
  }
  if (rows.length === 0) {
    return null
  }
  const logFor = (row: SessionListRow): (() => void) | null => {
    const logTarget = logTargets.get(row.record.id)
    return logTarget ? () => setLog({ row, target: logTarget }) : null
  }
  return (
    <>
      {panel ? (
        <OverviewPanel title={sessionsTitle}>
          <BuildWebSessionRows rows={rows} onOpen={openRow} logFor={logFor} />
        </OverviewPanel>
      ) : (
        <BuildWebSessionList rows={rows} onOpen={openRow} logFor={logFor} />
      )}
      <BuildWebSessionLogDialog log={log} onClose={() => setLog(null)} />
    </>
  )
}
