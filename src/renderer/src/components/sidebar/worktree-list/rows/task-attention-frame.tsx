import React from 'react'
import { cn } from '@/lib/utils'
import { TASK_ATTENTION_GROUP_KEY } from '../../../../../../shared/sidebar-list/task-session-groups'
import type { RenderRow } from '../listing/render-row'
import { getWorktreeSidebarRowGap } from '../viewport/virtual-rows'

// IS-147: «Needs attention» sits in an amber box. The list is virtualized row by row, so each row
// draws its own slice: the header the top, every row the sides, the last row the bottom.

export type TaskAttentionFramePiece = 'top' | 'closed' | 'middle' | 'bottom'

/** Space the box keeps under its last row, inside the gap to the next row. */
const FRAME_BOTTOM_PADDING = 4
/**
 * Compact rows have no gap, so the last row's slot carries the box's bottom padding and the
 * mockup's 2px under it (TASK_ATTENTION_COMPACT_LAST_ROW_CLASS_NAME, 6px).
 */
const COMPACT_FRAME_BOTTOM_MARGIN = 2
export const TASK_ATTENTION_COMPACT_LAST_ROW_CLASS_NAME = 'pb-1.5'

function inAttentionGroup(row: RenderRow | undefined): boolean {
  if (row?.type === 'item') {
    return row.sectionKey === TASK_ATTENTION_GROUP_KEY
  }
  return row?.type === 'lineage-group' && row.rows[0]?.sectionKey === TASK_ATTENTION_GROUP_KEY
}

/** The slice of the box a render row draws; null outside «Needs attention». */
export function getTaskAttentionFramePiece(
  rows: readonly RenderRow[],
  index: number
): TaskAttentionFramePiece | null {
  const row = rows[index]
  const continues = inAttentionGroup(rows[index + 1])
  if (row?.type === 'header') {
    const attention = row.icon.kind === 'task' && row.icon.taskGroup === 'attention'
    return attention ? (continues ? 'top' : 'closed') : null
  }
  if (!inAttentionGroup(row)) {
    return null
  }
  return continues ? 'middle' : 'bottom'
}

/**
 * The slice, behind the row's content. Rows reach up across the virtualizer's gap so the sides run
 * unbroken; it is inset 1px so the cards' 4px right padding (see item-row) keeps them off the border.
 */
export function TaskAttentionFrame({
  piece,
  topInset = 0,
  compact = false
}: {
  piece: TaskAttentionFramePiece
  /** The header's spacing above its title, which stays outside the box. */
  topInset?: number
  /** Compact rows: the mockup's box, 6px off the sidebar's edges with 8px corners. */
  compact?: boolean
}): React.JSX.Element {
  const opensTop = piece === 'top' || piece === 'closed'
  const closesBottom = piece === 'bottom' || piece === 'closed'
  return (
    <div
      aria-hidden
      data-task-attention-frame={piece}
      className={cn(
        'pointer-events-none absolute border-x border-status-warning-border bg-status-warning-background',
        // Why 2px: with the list's 4px inset and scrollbar gutter, the mockup's 6px from the edges.
        compact ? 'inset-x-0.5' : 'inset-x-px',
        opensTop && cn('border-t', compact ? 'rounded-t-lg' : 'rounded-t-md'),
        closesBottom && cn('border-b', compact ? 'rounded-b-lg' : 'rounded-b-md')
      )}
      style={{
        top: opensTop ? topInset : -getWorktreeSidebarRowGap(compact),
        bottom:
          piece === 'bottom' ? (compact ? COMPACT_FRAME_BOTTOM_MARGIN : -FRAME_BOTTOM_PADDING) : 0
      }}
    />
  )
}
