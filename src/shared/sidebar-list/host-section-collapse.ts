import type { ExecutionHostId } from '../execution-host'
import type { HostSectionRow } from './host-section-rows'
import { PINNED_GROUP_KEY } from './group-keys'
import { TASK_GROUP_KEY_PREFIX, TASK_RELEASE_GROUP_KEY } from './task-session-groups'
import {
  getStoredCollapseKey,
  isSidebarGroupCollapsed,
  withEveryDefaultCollapsedGroupOpen
} from './default-collapsed-groups'

export function isHostLaneSectionKey(key: string): boolean {
  return (
    key === PINNED_GROUP_KEY ||
    key === 'all' ||
    key.startsWith('pr:') ||
    key.startsWith('workspace-status:') ||
    key.startsWith(TASK_GROUP_KEY_PREFIX)
  )
}

export function getHostSectionCollapseKey(key: string, hostId: ExecutionHostId): string {
  return hostId === 'local' || !isHostLaneSectionKey(key) ? key : `${key}:host:${hostId}`
}

export function deferHostSectionCollapse(collapsedGroups: Set<string>): Set<string> {
  // Why the release marker stays and is added: each host section collapses its own copy afterwards.
  const deferred = (key: string): boolean =>
    isHostLaneSectionKey(key) && key !== getStoredCollapseKey(TASK_RELEASE_GROUP_KEY)
  if (![...collapsedGroups].some(deferred)) {
    return withEveryDefaultCollapsedGroupOpen(collapsedGroups)
  }
  return withEveryDefaultCollapsedGroupOpen(
    new Set([...collapsedGroups].filter((key) => !deferred(key)))
  )
}

export function scopeHostSectionCollapse(args: {
  rows: readonly HostSectionRow[]
  collapsedGroups: ReadonlySet<string>
}): HostSectionRow[] {
  let sectionCollapsed = false
  return args.rows.flatMap((row): HostSectionRow[] => {
    if (row.type === 'host-header') {
      sectionCollapsed = false
    }
    if (row.type === 'header') {
      sectionCollapsed = false
      if (!isHostLaneSectionKey(row.key)) {
        return [row]
      }
      const hostId =
        row.hostId ??
        (row.hostWorktreeCounts?.size === 1
          ? row.hostWorktreeCounts.keys().next().value
          : undefined)
      const collapseKey = hostId ? getHostSectionCollapseKey(row.key, hostId) : row.key
      sectionCollapsed = isSidebarGroupCollapsed(args.collapsedGroups, collapseKey)
      return [{ ...row, collapseKey }]
    }
    return sectionCollapsed ? [] : [row]
  })
}
