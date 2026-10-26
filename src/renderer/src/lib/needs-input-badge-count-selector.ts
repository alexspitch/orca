import type { AppState } from '@/store/types'
import { getIndexedAllWorktrees } from '@/store/worktree-repo-index'
import { selectFolderWorkspaces, selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { buildAttentionByWorktree } from '../../../shared/sidebar-list/smart-attention'
import { folderWorkspaceKey } from '../../../shared/workspace-scope'
import { getUnreadBadgeCount } from './unread-badge-count'
import {
  readUnreadBadgeCountSources,
  type UnreadBadgeCountState
} from './unread-badge-count-selector'

/** How often a quiet store is recounted: a waiting row ages into "not reporting" without a write. */
export const NEEDS_INPUT_BADGE_RECOUNT_MS = 60_000

export type NeedsInputBadgeCountState = UnreadBadgeCountState &
  Pick<
    AppState,
    | 'agentStatusByPaneKey'
    | 'runtimePaneTitlesByTabId'
    | 'ptyIdsByTabId'
    | 'migrationUnsupportedByPtyId'
    | 'terminalLayoutsByTabId'
  >

// Why reads, not a key list: string keys of layout fields read as layout writes to the ratchet.
function countInputs(state: NeedsInputBadgeCountState): readonly unknown[] {
  return [
    selectWorktreesByRepo(state),
    selectFolderWorkspaces(state),
    state.projectGroups,
    state.repos,
    state.settings,
    state.workspaceHostScope,
    state.visibleWorkspaceHostIds,
    state.hideWorkspacesFromOtherDevices,
    state.runtimeEnvironments,
    state.runtimeStatusByEnvironmentId,
    state.tabsByWorktree,
    state.agentStatusByPaneKey,
    state.runtimePaneTitlesByTabId,
    state.ptyIdsByTabId,
    state.migrationUnsupportedByPtyId,
    state.terminalLayoutsByTabId
  ]
}

function sameCountInputs(
  previous: NeedsInputBadgeCountState,
  next: NeedsInputBadgeCountState
): boolean {
  const nextInputs = countInputs(next)
  return countInputs(previous).every((value, index) => value === nextInputs[index])
}

/** Workspaces the sidebar's Smart order puts in "Needs you"; a folder is listed by its workspace key. */
export function getNeedsInputWorkspaceIds(
  state: NeedsInputBadgeCountState,
  now: number
): Set<string> {
  const workspaces = [
    ...getIndexedAllWorktrees(selectWorktreesByRepo(state)),
    ...selectFolderWorkspaces(state).map((folder) => ({
      id: folderWorkspaceKey(folder.id),
      lastActivityAt: folder.lastActivityAt
    })),
    { id: FLOATING_TERMINAL_WORKTREE_ID, lastActivityAt: 0 }
  ]
  const attention = buildAttentionByWorktree(
    workspaces,
    state.tabsByWorktree,
    state.agentStatusByPaneKey,
    state.runtimePaneTitlesByTabId,
    state.ptyIdsByTabId,
    now,
    state.migrationUnsupportedByPtyId,
    state.terminalLayoutsByTabId
  )
  const ids = new Set<string>()
  for (const [id, { cls }] of attention) {
    if (cls === 1) {
      ids.add(id)
    }
  }
  return ids
}

/** The app-icon number while notifications are needs-input only: workspaces with an agent waiting on the user. */
export function createNeedsInputBadgeCountSelector(): (
  state: NeedsInputBadgeCountState,
  now: number,
  floatingTerminalOpen: boolean
) => number {
  let previousState: NeedsInputBadgeCountState | undefined
  let previousBucket = -1
  let workspaceCount = 0
  let floatingNeedsInput = false

  return (state, now, floatingTerminalOpen) => {
    const bucket = Math.floor(now / NEEDS_INPUT_BADGE_RECOUNT_MS)
    if (!previousState || bucket !== previousBucket || !sameCountInputs(previousState, state)) {
      const ids = getNeedsInputWorkspaceIds(state, now)
      workspaceCount = getUnreadBadgeCount({
        ...readUnreadBadgeCountSources(state),
        needsInputWorkspaceIds: ids
      })
      floatingNeedsInput = ids.has(FLOATING_TERMINAL_WORKTREE_ID)
      previousBucket = bucket
    }
    previousState = state
    // Why: like its unread dot, the floating terminal counts only while its panel is closed.
    const floating =
      floatingNeedsInput &&
      state.settings?.floatingTerminalEnabled === true &&
      !floatingTerminalOpen
    return workspaceCount + (floating ? 1 : 0)
  }
}
