import { BUILD_WEB_TASK_GROUP_LABELS } from '../../../src/shared/build-web-session-labels'
import {
  TASK_ATTENTION_GROUP_KEY,
  TASK_GROUP_ORDER,
  getTaskLaneKey,
  getWorktreeTaskGroup,
  type SidebarTaskGroupKey
} from '../../../src/shared/sidebar-list/task-session-groups'
import type { Section, Worktree } from './workspace-list-types'

/** «By task» lanes in the desktop's order, each row in its first matching lane; empty lanes drop. */
export function buildTaskLaneSections(rows: readonly Worktree[]): Section[] {
  const byLane = new Map<SidebarTaskGroupKey, Worktree[]>()
  for (const row of rows) {
    const lane = getWorktreeTaskGroup(row)
    const list = byLane.get(lane)
    if (list) {
      list.push(row)
    } else {
      byLane.set(lane, [row])
    }
  }
  return TASK_GROUP_ORDER.flatMap((lane) => {
    const data = byLane.get(lane)
    return data
      ? [{ key: getTaskLaneKey(lane), title: BUILD_WEB_TASK_GROUP_LABELS[lane].text, data }]
      : []
  })
}

/** Needs attention, or its host-scoped form a feed-built list names it by. */
export function isTaskAttentionSectionKey(key: string): boolean {
  return key === TASK_ATTENTION_GROUP_KEY || key.startsWith(`${TASK_ATTENTION_GROUP_KEY}:`)
}
