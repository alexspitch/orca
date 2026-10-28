import type {
  WorktreeBuildWebSession,
  WorktreeBuildWebSessionState,
  WorktreeBuildWebTask
} from '../build-web-session-types'

// «By task» (IS-147): a workspace's lane follows only its task's state; the live agent never moves it.

/** Lane order after Needs attention and Pinned; folders and plain workspaces land in `none`. */
export const TASK_GROUP_ORDER = ['attention', 'release', 'progress', 'none'] as const
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

/** Wire rows from a phone's host are unchecked, so every field may be missing or malformed. */
export type TaskSessionFacts = {
  buildWebTask?: Pick<WorktreeBuildWebTask, 'key'> | null
  buildWebSession?: Pick<WorktreeBuildWebSession, 'state'> | null
}

/** A worktree's lane; a task whose session the host has not reported yet reads as in progress. */
export function getWorktreeTaskGroup(worktree: TaskSessionFacts): SidebarTaskGroupKey {
  if (!worktree.buildWebTask) {
    return 'none'
  }
  switch (worktree.buildWebSession?.state) {
    case 'attention':
      return 'attention'
    case 'waiting':
    case 'closing':
      return 'release'
    default:
      return 'progress'
  }
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

/** A worktree's task lane, read by each client from its own worktree meta. */
export type SidebarTaskGroupReader = (worktree: TaskSessionFacts) => SidebarTaskGroupKey

/** The lanes the session filter may hide. Attention and an unknown state are never hidden. */
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
  knowsTasks: boolean
): boolean {
  if (hidden.length === 0 || !knowsTasks) {
    return false
  }
  if (worktree.buildWebTask && getWorktreeTaskSessionState(worktree) === null) {
    return false
  }
  const group = getWorktreeTaskGroup(worktree)
  return group !== 'attention' && hidden.includes(group)
}
