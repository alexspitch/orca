import React from 'react'
import { cn } from '@/lib/utils'
import { TASK_ATTENTION_GROUP_KEY } from '../../../../../../shared/sidebar-list/task-session-groups'
import type { RenderRow } from '../listing/render-row'
import { WORKTREE_SIDEBAR_VIRTUAL_ROW_GAP } from '../viewport/virtual-rows'

// IS-147: «Needs attention» sits in an amber box. The list is virtualized row by row, so each row
// draws its own slice: the header the top, every row the sides, the last row the bottom.

export type TaskAttentionFramePiece = 'top' | 'closed' | 'middle' | 'bottom'

/** Space the box keeps under its last row, inside the gap to the next row. */
const FRAME_BOTTOM_PADDING = 4

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
  topInset = 0
}: {
  piece: TaskAttentionFramePiece
  /** The header's spacing above its title, which stays outside the box. */
  topInset?: number
}): React.JSX.Element {
  const opensTop = piece === 'top' || piece === 'closed'
  const closesBottom = piece === 'bottom' || piece === 'closed'
  return (
    <div
      aria-hidden
      data-task-attention-frame={piece}
      className={cn(
        'pointer-events-none absolute inset-x-px border-x border-status-warning-border bg-status-warning-background',
        opensTop && 'rounded-t-md border-t',
        closesBottom && 'rounded-b-md border-b'
      )}
      style={{
        top: opensTop ? topInset : -WORKTREE_SIDEBAR_VIRTUAL_ROW_GAP,
        bottom: piece === 'bottom' ? -FRAME_BOTTOM_PADDING : 0
      }}
    />
  )
}
