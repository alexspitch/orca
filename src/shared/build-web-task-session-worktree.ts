import type { BuildWebAgentSession, BuildWebIssueRow } from './build-web-types'
import type { WorktreeBuildWebTask } from './build-web-session-types'

// Which worktree holds a task's session (IS-147), as the desktop and the phone both find it:
// «Take to work» opens it again only while it holds the task's current, open session.

type SessionIssue = Pick<BuildWebIssueRow, 'id' | 'agent_session' | 'agent_session_state'>
type TaskWorktree = { buildWebTask?: WorktreeBuildWebTask; path?: string }

const sameConsole = (a: string, b: string): boolean =>
  a.replace(/\/+$/, '').toLowerCase() === b.replace(/\/+$/, '').toLowerCase()

/** A worktree's folder: what the console keeps as a task session's `worktree_name`. */
export function worktreeFolderName(path: string | undefined): string {
  return path?.split(/[\\/]/).findLast((part) => part !== '') ?? ''
}

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
 * Among the task's worktrees whose link is not written yet, the session's: by its folder name,
 * else the only one. With several and no name to tell them apart, none — a stale one must not open.
 */
export function unlinkedSessionWorktree<W extends TaskWorktree>(
  session: Pick<BuildWebAgentSession, 'worktree_name'>,
  ours: readonly W[]
): W | null {
  const unlinked = ours.filter((w) => !w.buildWebTask?.sessionId)
  const named = session.worktree_name
    ? unlinked.find((w) => worktreeFolderName(w.path) === session.worktree_name)
    : undefined
  return named ?? (unlinked.length === 1 ? (unlinked[0] ?? null) : null)
}

/**
 * The worktree made for the task that holds `session`: by the console's session row first, then
 * one whose link is not written yet. A worktree linked to another row holds another session.
 */
export function findSessionWorktree<W extends TaskWorktree>(
  session: Pick<BuildWebAgentSession, 'id' | 'worktree_name'>,
  issueId: string,
  worktrees: readonly W[],
  consoleHost: string
): W | null {
  const ours = taskWorktreesOf(issueId, worktrees, consoleHost)
  const linked = session.id ? ours.find((w) => w.buildWebTask?.sessionId === session.id) : undefined
  return linked ?? unlinkedSessionWorktree(session, ours)
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
