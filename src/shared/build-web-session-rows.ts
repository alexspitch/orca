import type {
  BuildWebAgentSessionRecord,
  BuildWebLiveSessionState,
  WorktreeBuildWebSession,
  WorktreeBuildWebTask
} from './build-web-session-types'
import type { BuildWebIssueRow } from './build-web-types'
import { taskWorktreesOf } from './build-web-task-session-worktree'

// A task card's «Sessions» (IS-147): the console's history joined with the worktrees this client
// knows. The console says what happened; the worktree's own state says when it needs a person.

type TaskWorktree = {
  buildWebTask?: WorktreeBuildWebTask
  buildWebSession?: WorktreeBuildWebSession
}

export type BuildWebSessionRow<W> = {
  record: BuildWebAgentSessionRecord
  /** The worktree still holding the session here; null once removed or when it is elsewhere. */
  worktree: W | null
  /** Set when the worktree's host says it needs a person. */
  attention: WorktreeBuildWebSession | null
}

/**
 * Newest first, as the console lists them. A worktree joins the row its link names; one not
 * linked yet joins the newest session still open, the only one its link could still name.
 */
export function joinSessionRows<W extends TaskWorktree>(
  records: readonly BuildWebAgentSessionRecord[],
  worktrees: readonly W[],
  issueId: string,
  consoleHost: string
): BuildWebSessionRow<W>[] {
  const ours = taskWorktreesOf(issueId, worktrees, consoleHost)
  const newestOpen = records.find((r) => !r.ended_at)
  return records.map((record) => {
    const worktree = record.worktree_removed_at
      ? null
      : (ours.find((w) => w.buildWebTask?.sessionId === record.id) ??
        (record === newestOpen ? ours.find((w) => !w.buildWebTask?.sessionId) : undefined) ??
        null)
    const state = worktree?.buildWebSession
    return { record, worktree, attention: state?.state === 'attention' ? state : null }
  })
}

/** The task list's mark: the console's state, or «in progress» from a console that only says «held». */
export function taskSessionState(
  issue: Pick<BuildWebIssueRow, 'agent_session' | 'agent_session_state'>
): BuildWebLiveSessionState | null {
  if (issue.agent_session_state !== undefined) {
    return issue.agent_session_state
  }
  return issue.agent_session ? 'active' : null
}
