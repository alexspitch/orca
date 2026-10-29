import React from 'react'
import { CircleAlert } from 'lucide-react'
import { useAppStore } from '@/store'
import { getRepoMapFromState } from '@/store/selectors'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import type { AppState } from '@/store/types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { Worktree } from '../../../../shared/worktree/types'
import { isTaskSessionAttention } from '../../../../shared/sidebar-list/task-session-groups'
import { computeVisibleWorktreeIds } from './compute-visible-worktrees'
import { buildVisibleWorktreeOptionsFromState } from './visible-worktree-options-from-state'
import { selectTaskSessionUiAvailable } from './task-session-capability'

/** The rows «By task» would list in Needs attention under the sidebar's current filters. */
function selectTaskAttentionCount(state: AppState): number {
  const attentionByRepo: Record<string, Worktree[]> = {}
  const ids: string[] = []
  // Why the fallback: header fixtures mount it over a partial store.
  for (const [repoId, worktrees] of Object.entries(selectWorktreesByRepo(state) ?? {})) {
    const attention = worktrees.filter(isTaskSessionAttention)
    if (attention.length > 0) {
      attentionByRepo[repoId] = attention
      ids.push(...attention.map((worktree) => worktree.id))
    }
  }
  if (ids.length === 0) {
    return 0
  }
  // Why only the few attention rows: the filter runs on every store update.
  return computeVisibleWorktreeIds(attentionByRepo, ids, {
    ...buildVisibleWorktreeOptionsFromState(state, getRepoMapFromState(state)),
    keepArchivedTaskAttention: true,
    injectLineageAncestors: false
  }).length
}

function counterLabel(count: number): string {
  return count === 1
    ? translate(
        'buildWeb.session.attentionCounter_one',
        '{{count}} workspace needs attention. Group by task',
        { count }
      )
    : translate(
        'buildWeb.session.attentionCounter_other',
        '{{count}} workspaces need attention. Group by task',
        { count }
      )
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
  const label = counterLabel(count)
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
