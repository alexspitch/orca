import type { ExecutionHostId } from '../../../src/shared/execution-host'
import { parseExecutionHostId } from '../../../src/shared/execution-host'
import { isTaskSessionAttention } from '../../../src/shared/sidebar-list/task-session-groups'
import {
  filterWorkspaceRows,
  type WorkspaceRowFactReader
} from '../../../src/shared/workspace-view/workspace-row-filters'
import type { FilterState, Worktree } from './workspace-list-types'
import { resolveWorktreeHostId } from './worktree-host-context-labels'

/** IS-147: what the phone knows of its rows' tasks while it filters them. */
export type PhoneTaskSessionScope = {
  /** The connected host announces `build-web-worktree-task.v1`. */
  hostKnowsTasks: boolean
  /** «By task» lists a closed task's leftover even when it is archived. */
  keepArchivedAttention: boolean
}

export const NO_TASK_SESSION_SCOPE: PhoneTaskSessionScope = {
  hostKnowsTasks: false,
  keepArchivedAttention: false
}

// Idle prompts have no recent output; live terminals or unread output still count as active.
export function isWorktreeActive(w: Worktree): boolean {
  if (w.hasHostSidebarActivity !== undefined) {
    return w.hasHostSidebarActivity
  }
  if (w.unread) {
    return true
  }
  if (w.status) {
    return w.status !== 'inactive'
  }
  if (w.liveTerminalCount > 0) {
    return true
  }
  return false
}

// Older hosts omit the main-worktree flag; use the legacy branch heuristic.
function guessDefaultBranchWorkspace(w: Worktree): boolean {
  if (w.isMainWorktree !== undefined) {
    return w.isMainWorktree && w.branch.trim() !== ''
  }
  const branch = w.branch.replace(/^refs\/heads\//, '')
  return branch === 'main' || branch === 'master'
}

// Why a server row needs its own task: the phone does not know whether that server reports tasks.
function rowKnowsTasks(w: Worktree, hostId: ExecutionHostId | null, hostKnowsTasks: boolean) {
  return (
    Boolean(w.buildWebTask) || (hostKnowsTasks && parseExecutionHostId(hostId)?.kind !== 'runtime')
  )
}

function phoneRowFacts(
  repoHostIdByRepoId: ReadonlyMap<string, ExecutionHostId>,
  taskScope: PhoneTaskSessionScope
): WorkspaceRowFactReader<Worktree> {
  const hostIdOf = (w: Worktree) => resolveWorktreeHostId(w, repoHostIdByRepoId)
  return {
    isArchived: (w) =>
      w.isArchived === true && !(taskScope.keepArchivedAttention && isTaskSessionAttention(w)),
    isFolderWorkspace: (w) => w.workspaceKind === 'folder-workspace',
    repoId: (w) => w.repoId,
    hostId: hostIdOf,
    isOtherClient: (w) => w.desktopOtherClient === true,
    isDefaultBranch: (w) => w.defaultBranch ?? guessDefaultBranchWorkspace(w),
    isAutomationCreated: (w) => w.automationCreated === true,
    isCliCreated: (w) => w.cliCreated === true,
    isDetachedHead: (w) => w.detachedHead === true,
    // Why the guess: #8873's exemption must fail open on hosts that predate isMainWorktree.
    isMainWorktree: (w) => w.isMainWorktree ?? guessDefaultBranchWorkspace(w),
    isSleeping: (w) => !isWorktreeActive(w),
    taskSession: (w) => (rowKnowsTasks(w, hostIdOf(w), taskScope.hostKnowsTasks) ? w : null)
  }
}

export function filterWorktrees(
  worktrees: Worktree[],
  filters: FilterState,
  search: string,
  repoHostIdByRepoId: ReadonlyMap<string, ExecutionHostId> = new Map(),
  taskScope: PhoneTaskSessionScope = NO_TASK_SESSION_SCOPE
): Worktree[] {
  const result = filterWorkspaceRows(
    worktrees,
    filters,
    phoneRowFacts(repoHostIdByRepoId, taskScope)
  )
  const q = search.trim().toLowerCase()
  if (!q) {
    return result
  }
  return result.filter(
    (w) =>
      w.displayName.toLowerCase().includes(q) ||
      w.branch.toLowerCase().includes(q) ||
      w.repo.toLowerCase().includes(q)
  )
}
