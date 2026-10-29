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
import { toHostSessionTabId } from '../../../../shared/terminal-surface-id'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import {
  currentOpenSession,
  findTaskSessionWorktree
} from '../../../../shared/build-web-task-session-worktree'
import { recordBuildWebCardVisit } from './build-web-card-history'

export type BuildWebSessionWorktree = { worktreeId: string; hostId?: ExecutionHostId }

type SessionSurface = Pick<BuildWebAgentSession, 'surface_kind' | 'surface_id'>

/** The session's terminal tab here; a paired host's tab carries the host's id the session records. */
function sessionTerminalTab(
  tabs: readonly TerminalTab[] | undefined,
  surfaceId: string
): TerminalTab | undefined {
  return (tabs ?? []).find((tab) => toHostSessionTabId(tab.id) === surfaceId)
}

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
  const recorded = parseExecutionHostId(session.execution_host_id)?.id
  // Why this client's row: the record names the host as the build-web host does (`local` for itself).
  const found = (worktreeId: string): BuildWebSessionWorktree => {
    const hostId = (
      state.getKnownWorktreeById(worktreeId, recorded) ?? state.getKnownWorktreeById(worktreeId)
    )?.hostId
    return hostId ? { worktreeId, hostId } : { worktreeId }
  }
  if (session.surface_kind === 'terminal') {
    for (const [worktreeId, tabs] of Object.entries(state.tabsByWorktree)) {
      if (sessionTerminalTab(tabs, session.surface_id)) {
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
    const tab = sessionTerminalTab(state.tabsByWorktree[worktree.worktreeId], session.surface_id)
    if (tab) {
      activateTabAndFocusPane(tab.id, null)
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
