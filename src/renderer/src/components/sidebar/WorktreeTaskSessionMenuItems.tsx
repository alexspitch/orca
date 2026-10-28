import React from 'react'
import { ExternalLink, RotateCcw, SquareArrowOutUpRight, Trash2, Unlink } from 'lucide-react'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { isTaskSessionAttention } from '../../../../shared/sidebar-list/task-session-groups'
import type { Worktree } from '../../../../shared/worktree/types'
import { useRemoveTaskWorktreeAnyway } from './use-remove-task-worktree-anyway'
import {
  keepWorktreeTaskSession,
  openWorktreeBuildWebTask,
  reopenWorktreeTask
} from './worktree-task-session-actions'

/** IS-147: «Open task» for a task worktree, and the actions a closed task's leftover needs. */
export function WorktreeTaskSessionMenuItems({
  worktree,
  disabled
}: {
  worktree: Worktree
  disabled: boolean
}): React.JSX.Element | null {
  if (!worktree.buildWebTask) {
    return null
  }
  const attention = isTaskSessionAttention(worktree)
  return (
    <>
      {attention ? (
        <DropdownMenuItem
          onSelect={() =>
            activateAndRevealWorktree(
              worktree.id,
              worktree.hostId ? { executionHostId: worktree.hostId } : undefined
            )
          }
          disabled={disabled}
        >
          <SquareArrowOutUpRight className="size-3.5" />
          {translate('buildWeb.session.action.open', 'Open')}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem onSelect={() => void openWorktreeBuildWebTask(worktree)}>
        <ExternalLink className="size-3.5" />
        {translate('buildWeb.session.action.openTask', 'Open task {{key}}', {
          key: worktree.buildWebTask.key
        })}
      </DropdownMenuItem>
      {attention ? <AttentionMenuItems worktree={worktree} disabled={disabled} /> : null}
      <DropdownMenuSeparator />
    </>
  )
}

/** Why a component of its own: only a leftover's menu needs the confirmation dialog. */
function AttentionMenuItems({
  worktree,
  disabled
}: {
  worktree: Worktree
  disabled: boolean
}): React.JSX.Element {
  const removeAnyway = useRemoveTaskWorktreeAnyway()
  return (
    <>
      <DropdownMenuItem
        variant="destructive"
        onSelect={() => void removeAnyway(worktree)}
        disabled={disabled}
      >
        <Trash2 className="size-3.5" />
        {translate('buildWeb.session.action.removeAnyway', 'Remove anyway…')}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void keepWorktreeTaskSession(worktree)} disabled={disabled}>
        <Unlink className="size-3.5" />
        {translate('buildWeb.session.action.keep', 'Keep, unlink from task')}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void reopenWorktreeTask(worktree)} disabled={disabled}>
        <RotateCcw className="size-3.5" />
        {translate('buildWeb.session.action.backToWork', 'Back to work')}
      </DropdownMenuItem>
    </>
  )
}
