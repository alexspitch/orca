import React from 'react'
import { CircleAlert } from 'lucide-react'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import type { AppState } from '@/store/types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { isTaskSessionAttention } from '../../../../shared/sidebar-list/task-session-groups'
import { selectTaskSessionUiAvailable } from './task-session-capability'

function selectTaskAttentionCount(state: AppState): number {
  let count = 0
  // Why the fallback: header fixtures mount it over a partial store.
  for (const worktrees of Object.values(selectWorktreesByRepo(state) ?? {})) {
    count += worktrees.filter(isTaskSessionAttention).length
  }
  return count
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
          aria-label={label}
          data-workspace-board-preserve-open=""
          onClick={() => setGroupBy('task')}
        >
          <span className="inline-flex items-center gap-0.5 text-status-warning">
            <CircleAlert className="size-3.5" />
            <span className="text-[11px] font-semibold tabular-nums">{count}</span>
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
