import { TASK_ATTENTION_GROUP_KEY, TASK_RELEASE_GROUP_KEY } from './task-session-groups'

// «Awaiting release» starts collapsed (IS-147). Its stored key records an expansion instead of a
// collapse, so clearing collapsed groups on a grouping switch collapses it again.

const EXPANDED_SUFFIX = ':expanded'

function isLaneKey(collapseKey: string, laneKey: string): boolean {
  return collapseKey === laneKey || collapseKey.startsWith(`${laneKey}:host:`)
}

/** Needs attention is a section, not a lane: it never collapses. */
export function neverCollapses(collapseKey: string): boolean {
  return isLaneKey(collapseKey, TASK_ATTENTION_GROUP_KEY)
}

/** A lane collapsed until opened: the plain key, or its host-scoped `…:host:<id>` form. */
export function startsCollapsed(collapseKey: string): boolean {
  return isLaneKey(collapseKey, TASK_RELEASE_GROUP_KEY)
}

/** The key a toggle adds or removes for a header's collapse key. */
export function getStoredCollapseKey(collapseKey: string): string {
  return startsCollapsed(collapseKey) ? `${collapseKey}${EXPANDED_SUFFIX}` : collapseKey
}

export function isSidebarGroupCollapsed(
  collapsedGroups: ReadonlySet<string>,
  collapseKey: string
): boolean {
  if (neverCollapses(collapseKey)) {
    return false
  }
  const collapsed = collapsedGroups.has(getStoredCollapseKey(collapseKey))
  return startsCollapsed(collapseKey) ? !collapsed : collapsed
}

/** Opens a lane in a draft set; a no-op when it is already open. */
export function expandSidebarGroup(draft: Set<string>, collapseKey: string): void {
  if (startsCollapsed(collapseKey)) {
    draft.add(getStoredCollapseKey(collapseKey))
  } else {
    draft.delete(collapseKey)
  }
}

/** Every lane open: what the planner renders before host sections apply their own collapse. */
export function withEveryDefaultCollapsedGroupOpen(collapsedGroups: Set<string>): Set<string> {
  if (!isSidebarGroupCollapsed(collapsedGroups, TASK_RELEASE_GROUP_KEY)) {
    return collapsedGroups
  }
  const next = new Set(collapsedGroups)
  expandSidebarGroup(next, TASK_RELEASE_GROUP_KEY)
  return next
}
