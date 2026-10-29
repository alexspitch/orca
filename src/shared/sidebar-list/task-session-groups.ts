import type {
  WorktreeBuildWebSession,
  WorktreeBuildWebSessionState,
  WorktreeBuildWebTask
} from '../build-web-session-types'
import type { Worktree } from '../worktree/types'

// «By task» (IS-147): a workspace's lane follows its task's state; the live agent moves it only into
// Input required, while it waits on the user and that group is switched on.

/** Lane order; Pinned sits after Input required. Folders and plain workspaces land in `none`. */
export const TASK_GROUP_ORDER = ['attention', 'input', 'release', 'progress', 'none'] as const
export type SidebarTaskGroupKey = (typeof TASK_GROUP_ORDER)[number]

export const TASK_GROUP_KEY_PREFIX = 'task:'

export function getTaskLaneKey(group: SidebarTaskGroupKey): string {
  return `${TASK_GROUP_KEY_PREFIX}${group}`
}

export function getTaskGroupFromLaneKey(key: string): SidebarTaskGroupKey | null {
  const group = key.startsWith(TASK_GROUP_KEY_PREFIX) ? key.slice(TASK_GROUP_KEY_PREFIX.length) : ''
  return TASK_GROUP_ORDER.find((candidate) => candidate === group) ?? null
}

export const TASK_ATTENTION_GROUP_KEY = getTaskLaneKey('attention')
export const TASK_RELEASE_GROUP_KEY = getTaskLaneKey('release')

/** The lanes above Pinned, which claim a pinned row before Pinned does. */
export function isTaskLaneAbovePinned(group: SidebarTaskGroupKey): boolean {
  return group === 'attention' || group === 'input'
}

export function isTaskLaneAbovePinnedKey(key: string): boolean {
  const group = getTaskGroupFromLaneKey(key)
  return group !== null && isTaskLaneAbovePinned(group)
}

/**
 * Whether an agent in a workspace waits on the user (the status lane's «needs input») while the
 * Input required group is on. Each client reads it from its own agent state.
 */
export type InputRequiredReader = (workspace: Pick<Worktree, 'id' | 'hostId'>) => boolean

/** Absent means on: hosts and profiles before the switch show the group. */
export function isInputRequiredGroupShown(
  groupBy: string,
  showInputRequiredGroup: boolean | undefined
): boolean {
  return groupBy === 'task' && showInputRequiredGroup !== false
}

/** Wire rows from a phone's host are unchecked, so every field may be missing or malformed. */
export type TaskSessionFacts = {
  buildWebTask?: Pick<WorktreeBuildWebTask, 'key'> | null
  buildWebSession?: Pick<WorktreeBuildWebSession, 'state'> | null
}

/**
 * A worktree's first matching lane; `inputRequired` is the reader's answer for it. A task whose
 * session the host has not reported yet reads as in progress.
 */
export function getWorktreeTaskGroup(
  worktree: TaskSessionFacts,
  inputRequired = false
): SidebarTaskGroupKey {
  const state = worktree.buildWebTask ? worktree.buildWebSession?.state : undefined
  if (state === 'attention') {
    return 'attention'
  }
  if (inputRequired) {
    return 'input'
  }
  if (!worktree.buildWebTask) {
    return 'none'
  }
  return state === 'waiting' || state === 'closing' ? 'release' : 'progress'
}

/** «By task»'s `keepOutOfPinned`: the rows a lane above Pinned claims, even under a pinned parent. */
export function claimedAbovePinned(
  inputRequiredOf: InputRequiredReader | undefined
): (worktree: TaskSessionFacts & Pick<Worktree, 'id' | 'hostId'>) => boolean {
  return (worktree) =>
    isTaskLaneAbovePinned(getWorktreeTaskGroup(worktree, inputRequiredOf?.(worktree) === true))
}

/** The state a row's badge shows; null without a task or while the state is unknown. */
export function getWorktreeTaskSessionState(
  worktree: TaskSessionFacts
): WorktreeBuildWebSessionState | null {
  if (!worktree.buildWebTask) {
    return null
  }
  const state = worktree.buildWebSession?.state
  return state === 'active' || state === 'waiting' || state === 'closing' || state === 'attention'
    ? state
    : null
}

export function isTaskSessionAttention(worktree: TaskSessionFacts): boolean {
  return getWorktreeTaskSessionState(worktree) === 'attention'
}

/** Archived rows stay hidden, except a closed task's leftover in «By task». */
export function isHiddenArchivedRow(
  worktree: TaskSessionFacts & { isArchived: boolean },
  groupBy: string
): boolean {
  return worktree.isArchived && !(groupBy === 'task' && isTaskSessionAttention(worktree))
}

/** The lanes the session filter may hide. Attention, Input required and an unknown state never hide. */
export const HIDEABLE_TASK_SESSION_GROUPS = ['none', 'progress', 'release'] as const
export type HideableTaskSessionGroup = (typeof HIDEABLE_TASK_SESSION_GROUPS)[number]

export function normalizeHiddenTaskSessionGroups(value: unknown): HideableTaskSessionGroup[] {
  if (!Array.isArray(value)) {
    return []
  }
  return HIDEABLE_TASK_SESSION_GROUPS.filter((group) => value.includes(group))
}

/**
 * Whether the session filter hides a row. `knowsTasks` is false for a host without
 * `build-web-worktree-task.v1`: it never reports tasks, so its rows are unknown, not task-less.
 */
export function isHiddenByTaskSessionFilter(
  worktree: TaskSessionFacts,
  hidden: readonly HideableTaskSessionGroup[],
  knowsTasks: boolean,
  inputRequired = false
): boolean {
  if (hidden.length === 0 || !knowsTasks) {
    return false
  }
  if (worktree.buildWebTask && getWorktreeTaskSessionState(worktree) === null) {
    return false
  }
  const group = getWorktreeTaskGroup(worktree, inputRequired)
  return group !== 'attention' && group !== 'input' && hidden.includes(group)
}
