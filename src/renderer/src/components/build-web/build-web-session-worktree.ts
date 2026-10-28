import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import {
  activateStructuredAgentSessionById,
  findStructuredAgentSessionTab
} from '@/lib/agent-session/structured-agent-session-tab-activation'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import type { BuildWebAgentSession, BuildWebIssueRow } from '../../../../shared/build-web-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { parseExecutionHostId, type ExecutionHostId } from '../../../../shared/execution-host'
import {
  currentOpenSession,
  findTaskSessionWorktree
} from '../../../../shared/build-web-task-session-worktree'
import { recordBuildWebCardVisit } from './build-web-card-history'

export type BuildWebSessionWorktree = { worktreeId: string; hostId?: ExecutionHostId }

type SessionSurface = Pick<BuildWebAgentSession, 'surface_kind' | 'surface_id'>

/** Every worktree this client knows, of every repo and host. */
export function knownWorktrees(): Worktree[] {
  return Object.values(selectWorktreesByRepo(useAppStore.getState())).flatMap((list) => list ?? [])
}

/** The worktree this client shows the session's tab in, or null when it is not here. */
export function findBuildWebSessionWorktree(
  session: SessionSurface & Pick<BuildWebAgentSession, 'execution_host_id'>
): BuildWebSessionWorktree | null {
  const state = useAppStore.getState()
  if (!session.surface_id) {
    return null
  }
  const hostId = parseExecutionHostId(session.execution_host_id)?.id
  const found = (worktreeId: string): BuildWebSessionWorktree =>
    hostId ? { worktreeId, hostId } : { worktreeId }
  if (session.surface_kind === 'terminal') {
    for (const [worktreeId, tabs] of Object.entries(state.tabsByWorktree)) {
      if ((tabs ?? []).some((tab) => tab.id === session.surface_id)) {
        return found(worktreeId)
      }
    }
    return null
  }
  for (const worktreeId of Object.keys(state.unifiedTabsByWorktree)) {
    const tab = findStructuredAgentSessionTab(state.unifiedTabsByWorktree, {
      workspaceId: worktreeId,
      sessionId: session.surface_id
    })
    if (tab) {
      return found(worktreeId)
    }
  }
  return null
}

/** Bring the worktree forward from a task card, and the session's tab in it when it is here. */
export function revealBuildWebSession(
  worktree: BuildWebSessionWorktree,
  session?: SessionSurface | null
): boolean {
  recordBuildWebCardVisit()
  const opts = worktree.hostId ? { executionHostId: worktree.hostId } : undefined
  if (activateAndRevealWorktree(worktree.worktreeId, opts) === false) {
    return false
  }
  if (!session?.surface_id) {
    return true
  }
  const state = useAppStore.getState()
  if (session.surface_kind === 'terminal') {
    if (
      (state.tabsByWorktree[worktree.worktreeId] ?? []).some((t) => t.id === session.surface_id)
    ) {
      activateTabAndFocusPane(session.surface_id, null)
    }
    return true
  }
  activateStructuredAgentSessionById({
    worktreeId: worktree.worktreeId,
    sessionId: session.surface_id
  })
  return true
}

/**
 * «Take to work» on a task whose current session is still open: its worktree, found by the task's
 * link or, for a session started before tasks had one, by its tab. A console that names no session
 * row links nothing, so there the tab comes first. False when there is none here.
 */
export function openTaskSessionWorktree(
  issue: Pick<BuildWebIssueRow, 'id' | 'agent_session' | 'agent_session_state'>,
  consoleHost: string
): boolean {
  const session = currentOpenSession(issue)
  if (!session) {
    return false
  }
  const byLink = (): BuildWebSessionWorktree | null => {
    const linked = findTaskSessionWorktree(issue, knownWorktrees(), consoleHost)
    return linked
      ? { worktreeId: linked.id, ...(linked.hostId ? { hostId: linked.hostId } : {}) }
      : null
  }
  const worktree = session.id
    ? (byLink() ?? findBuildWebSessionWorktree(session))
    : (findBuildWebSessionWorktree(session) ?? byLink())
  return worktree ? revealBuildWebSession(worktree, session) : false
}
