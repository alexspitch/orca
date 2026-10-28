import { useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import type { BuildWebIssueDetail } from '../../../../shared/build-web-types'
import { joinSessionRows } from '../../../../shared/build-web-session-rows'
import { BuildWebSessionBadge } from './BuildWebSessionBadge'
import { BuildWebSessionList, type SessionListRow } from './BuildWebSessionList'
import { BuildWebSessionLogDialog } from './BuildWebSessionLogDialog'
import { useBuildWebStore } from './build-web-store'
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
  detail
}: {
  detail: Pick<BuildWebIssueDetail, 'id' | 'agent_session' | 'agent_sessions'>
}): React.JSX.Element | null {
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const consoleHost = useBuildWebStore((s) => s.status?.baseUrl ?? '')
  const [logOf, setLogOf] = useState<SessionListRow | null>(null)
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
  if (!records) {
    return detail.agent_session ? <BuildWebSessionBadge session={detail.agent_session} /> : null
  }
  if (rows.length === 0) {
    return null
  }
  return (
    <>
      <BuildWebSessionList rows={rows} onOpen={openRow} onLog={setLogOf} />
      <BuildWebSessionLogDialog row={logOf} onClose={() => setLogOf(null)} />
    </>
  )
}
