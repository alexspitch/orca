import React from 'react'
import { CircleAlert } from 'lucide-react'
import { useAppStore } from '@/store'
import { getAllWorktreesFromState } from '@/store/selectors'
import type { AppState } from '@/store/types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { isTaskSessionAttention } from '../../../../shared/sidebar-list/task-session-groups'
import { selectTaskSessionUiAvailable } from './task-session-capability'

function selectTaskAttentionCount(state: AppState): number {
  // Why the guard: header fixtures mount it over a partial store.
  return state.worktreesByRepo
    ? getAllWorktreesFromState(state).filter(isTaskSessionAttention).length
    : 0
}

/** IS-147: outside «By task» an attention row keeps its lane; this counts them and opens By task. */
export function SidebarTaskAttentionCounter(): React.JSX.Element | null {
  const count = useAppStore(selectTaskAttentionCount)
  const groupBy = useAppStore((s) => s.groupBy)
  const setGroupBy = useAppStore((s) => s.setGroupBy)
  const available = useAppStore(selectTaskSessionUiAvailable)
  if (count === 0 || groupBy === 'task' || !available) {
    return null
  }
  const label = translate(
    'buildWeb.session.attentionCounter',
    '{{count}} workspaces need attention. Group by task',
    { count }
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          type="button"
          className="h-6 gap-0.5 px-1 text-status-warning hover:text-status-warning"
          aria-label={label}
          data-workspace-board-preserve-open=""
          onClick={() => setGroupBy('task')}
        >
          <CircleAlert className="size-3.5" />
          <span className="text-[11px] font-semibold tabular-nums">{count}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
