import React from 'react'
import type { SidebarHeaderIcon } from '../../../../../../shared/sidebar-list/row-types'
import type { SidebarTaskGroupKey } from '../../../../../../shared/sidebar-list/task-session-groups'
import { neverCollapses } from '../../../../../../shared/sidebar-list/default-collapsed-groups'

/** «By task» header facts (IS-147): Needs attention is a fixed section in the warning tone. */
export function getTaskHeaderChrome(
  icon: SidebarHeaderIcon,
  collapseKey: string,
  toggleGroup: (collapseKey: string) => void
): {
  taskGroup: SidebarTaskGroupKey | null
  fixed: boolean
  collapsible: boolean
  toggle: (collapseKey: string) => void
  toneClassName?: string
} {
  const taskGroup = icon.kind === 'task' ? icon.taskGroup : null
  const fixed = neverCollapses(collapseKey)
  return {
    taskGroup,
    fixed,
    collapsible: taskGroup !== null && !fixed,
    toggle: fixed ? () => {} : toggleGroup,
    // Why after cursor-pointer: cn() keeps the later cursor, and a fixed section has no toggle.
    toneClassName: fixed ? 'cursor-default text-status-warning' : undefined
  }
}

/** Why a count on task lanes only: they run long, so they say how many they hold. */
export function TaskHeaderCount({
  taskGroup,
  count
}: {
  taskGroup: SidebarTaskGroupKey | null
  count: number
}): React.JSX.Element | null {
  return taskGroup ? (
    <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">{count}</span>
  ) : null
}
