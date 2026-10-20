import { findStructuredAgentSessionTab } from '@/lib/structured-agent-session-tab-activation'
import { useAppStore } from '@/store'
import type { BuildWebAgentSession } from '../../../../shared/build-web-types'

export type BuildWebSessionWorktree = { worktreeId: string }

/** The worktree this client shows the session in, or null when it is not here. */
export function findBuildWebSessionWorktree(
  session: BuildWebAgentSession
): BuildWebSessionWorktree | null {
  const state = useAppStore.getState()
  if (!session.surface_id) {
    return null
  }
  if (session.surface_kind === 'terminal') {
    for (const [worktreeId, tabs] of Object.entries(state.tabsByWorktree)) {
      if ((tabs ?? []).some((tab) => tab.id === session.surface_id)) {
        return { worktreeId }
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
      return { worktreeId }
    }
  }
  return null
}
