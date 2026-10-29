import type { AppState } from '@/store/types'
import { getIndexedAllWorktrees } from '@/store/worktree-repo-index'
import { selectFolderWorkspaces, selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { folderWorkspaceKey } from '../../../../shared/workspace-scope'
import {
  isInputRequiredGroupShown,
  type InputRequiredReader
} from '../../../../shared/sidebar-list/task-session-groups'
import { selectWorktreeActivityStatuses } from './worktree-activity-statuses'

// «Input required» (IS-147): the workspaces whose status lane shows an agent waiting on the user.

type InputRequiredState = Parameters<typeof selectWorktreeActivityStatuses>[0] &
  Pick<AppState, 'groupBy' | 'showInputRequiredGroup' | 'worktreesByRepo' | 'folderWorkspaces'>

const NO_WORKSPACES: ReadonlySet<string> = new Set()

let cached: { inputs: readonly unknown[]; ids: ReadonlySet<string> } | null = null

function statusInputs(state: InputRequiredState): readonly unknown[] {
  return [
    selectWorktreesByRepo(state),
    selectFolderWorkspaces(state),
    state.tabsByWorktree,
    state.browserTabsByWorktree,
    state.runtimePaneTitlesByTabId,
    state.ptyIdsByTabId,
    state.terminalLayoutsByTabId,
    state.agentStatusEpoch,
    state.agentStatusByPaneKey,
    state.migrationUnsupportedByPtyId,
    state.retainedAgentsByPaneKey,
    state.runtimeAgentOrchestrationByPaneKey
  ]
}

function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((id) => b.has(id))
}

/**
 * Workspace ids (a folder by its workspace key) whose status is «needs input»; empty unless «By
 * task» shows the group. Why cached on the status inputs: every store write runs this selector.
 */
export function selectInputRequiredWorkspaceIds(state: InputRequiredState): ReadonlySet<string> {
  if (!isInputRequiredGroupShown(state.groupBy, state.showInputRequiredGroup)) {
    return NO_WORKSPACES
  }
  const inputs = statusInputs(state)
  if (cached?.inputs.every((input, index) => input === inputs[index])) {
    return cached.ids
  }
  const workspaceIds = [
    ...getIndexedAllWorktrees(selectWorktreesByRepo(state)).map((worktree) => worktree.id),
    ...selectFolderWorkspaces(state).map((folder) => folderWorkspaceKey(folder.id))
  ]
  const statuses = selectWorktreeActivityStatuses(state, workspaceIds)
  const next = new Set(workspaceIds.filter((id) => statuses.get(id) === 'permission'))
  const ids = cached && sameIds(cached.ids, next) ? cached.ids : next
  cached = { inputs, ids }
  return ids
}

export function inputRequiredReaderOf(ids: ReadonlySet<string>): InputRequiredReader | undefined {
  return ids.size > 0 ? (workspace) => ids.has(workspace.id) : undefined
}
