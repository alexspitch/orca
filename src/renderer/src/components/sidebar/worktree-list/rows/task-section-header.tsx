import React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
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

/** A section header's name, in the «By task» look when it has one, and the indicators after it. */
export function SectionHeaderTitle({
  label,
  count,
  taskLane,
  children
}: {
  label: string
  count: number
  taskLane: TaskLaneHeaderLook | null
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-1.5">
        <div
          className={cn(
            'min-w-0 truncate font-semibold leading-4',
            taskLane ? 'text-sm' : 'text-[13px]'
          )}
        >
          {label}
        </div>
        {/* Why a count on «By task» lanes only: they run long, so they say how many they hold. */}
        {taskLane ? (
          <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">
            {count}
          </span>
        ) : null}
        {children}
      </div>
    </div>
  )
}

// Why: past the list's 4px inset the lane's icon sits over the rows' status lane, 14px from the
// sidebar's edge; inside the attention box, past its border (IS-147 mockup).
const TASK_SECTION_HEADER_PADDING_LEFT = 10
const TASK_ATTENTION_HEADER_PADDING_LEFT = 11

/** How a «By task» header is drawn (IS-147 mockup): count and chevron always shown; null elsewhere. */
export type TaskLaneHeaderLook = {
  paddingLeft: number
  /** The fixed section's tone; 7px right so, past the scrollbar gutter, the chevron sits 11px in. */
  headerClassName: string
  iconSizeClassName: string
  /** Lanes take the muted icon tone; the fixed section and Input required keep their own. */
  mutedIcon: boolean
  /** Folding lanes show where they fold; the fixed section does not fold. */
  chevron: boolean
}

export function getTaskLaneHeaderLook(
  groupedByTask: boolean,
  isPinnedHeader: boolean,
  chrome: ReturnType<typeof getTaskHeaderChrome>
): TaskLaneHeaderLook | null {
  if (!groupedByTask || (chrome.taskGroup === null && !isPinnedHeader)) {
    return null
  }
  return {
    paddingLeft: chrome.fixed
      ? TASK_ATTENTION_HEADER_PADDING_LEFT
      : TASK_SECTION_HEADER_PADDING_LEFT,
    headerClassName: cn('pr-[7px]', chrome.toneClassName),
    iconSizeClassName: 'size-[13px]',
    mutedIcon: !chrome.fixed && chrome.taskGroup !== 'input',
    chevron: !chrome.fixed
  }
}

/** Down while a folding lane with rows is open, right while folded; always shown, as in the mockup. */
export function TaskHeaderChevron({
  lane,
  rows,
  collapsed
}: {
  lane: TaskLaneHeaderLook | null
  rows: number
  collapsed: boolean
}): React.JSX.Element | null {
  if (!lane?.chevron || rows === 0) {
    return null
  }
  const Chevron = collapsed ? ChevronRight : ChevronDown
  return (
    <span className="ml-auto flex shrink-0 text-muted-foreground" aria-hidden>
      <Chevron className="size-[13px]" />
    </span>
  )
}
