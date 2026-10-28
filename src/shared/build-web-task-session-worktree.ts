import type { BuildWebAgentSession, BuildWebIssueRow } from './build-web-types'
import type { WorktreeBuildWebTask } from './build-web-session-types'

// Which worktree holds a task's session (IS-147), as the desktop and the phone both find it:
// «Take to work» opens it again only while it holds the task's current, open session.

type SessionIssue = Pick<BuildWebIssueRow, 'id' | 'agent_session' | 'agent_session_state'>
type TaskWorktree = { buildWebTask?: WorktreeBuildWebTask }

const sameConsole = (a: string, b: string): boolean =>
  a.replace(/\/+$/, '').toLowerCase() === b.replace(/\/+$/, '').toLowerCase()

/** The session holding the task while its skill runs, unless the task is closed. */
export function currentOpenSession(issue: SessionIssue): BuildWebAgentSession | null {
  const session = issue.agent_session
  const state = session?.state ?? issue.agent_session_state ?? null
  // Why an unknown state passes: a console before `agent-session-lifecycle` says only «held».
  return session && (state === null || state === 'active' || state === 'waiting') ? session : null
}

/** The worktrees made for the task against this console. */
export function taskWorktreesOf<W extends TaskWorktree>(
  issueId: string,
  worktrees: readonly W[],
  consoleHost: string
): W[] {
  return worktrees.filter(
    (w) =>
      w.buildWebTask?.issueId === issueId && sameConsole(w.buildWebTask.consoleHost, consoleHost)
  )
}

/**
 * The worktree made for the task that holds `session`: by the console's session row first, then
 * one whose link is not written yet. A worktree linked to another row holds another session.
 */
export function findSessionWorktree<W extends TaskWorktree>(
  session: Pick<BuildWebAgentSession, 'id'>,
  issueId: string,
  worktrees: readonly W[],
  consoleHost: string
): W | null {
  const ours = taskWorktreesOf(issueId, worktrees, consoleHost)
  return (
    (session.id ? ours.find((w) => w.buildWebTask?.sessionId === session.id) : undefined) ??
    ours.find((w) => !w.buildWebTask?.sessionId) ??
    null
  )
}

/** The worktree holding the task's current session while that session is open, else null. */
export function findTaskSessionWorktree<W extends TaskWorktree>(
  issue: SessionIssue,
  worktrees: readonly W[],
  consoleHost: string
): W | null {
  const session = currentOpenSession(issue)
  return session ? findSessionWorktree(session, issue.id, worktrees, consoleHost) : null
}
