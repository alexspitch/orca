import React from 'react'
import { CircleAlert, Hourglass, Timer } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import {
  BUILD_WEB_SESSION_REASON_LABELS,
  BUILD_WEB_SESSION_STATE_LABELS,
  type BuildWebSessionLabel
} from '../../../../shared/build-web-session-labels'
import type {
  BuildWebSessionAttentionReason,
  WorktreeBuildWebSessionState
} from '../../../../shared/build-web-session-types'
import { getWorktreeTaskSessionState } from '../../../../shared/sidebar-list/task-session-groups'
import type { Worktree } from '../../../../shared/worktree/types'
import { openWorktreeBuildWebTask } from './worktree-task-session-actions'

// IS-147: a task worktree's number before its title and its session state at the row's right.
// The agent lane on the left stays the agent's.

const say = (label: BuildWebSessionLabel): string => translate(label.key, label.text)

function reasonLabels(reason: BuildWebSessionAttentionReason | undefined) {
  return reason ? BUILD_WEB_SESSION_REASON_LABELS[reason] : undefined
}

/** The full sentence for a row's state, as its tooltip and the attention section's line say it. */
export function describeWorktreeTaskSession(worktree: Worktree): string | null {
  const state = getWorktreeTaskSessionState(worktree)
  if (!state || state === 'active') {
    return null
  }
  const reason = reasonLabels(worktree.buildWebSession?.reason)
  const base = reason ? say(reason.full) : say(BUILD_WEB_SESSION_STATE_LABELS[state].full)
  const detail = worktree.buildWebSession?.detail
  return detail ? `${base} (${detail})` : base
}

/** Compact rows: waiting is the icon alone, closing «soon», attention its short reason. */
function badgeText(
  state: Exclude<WorktreeBuildWebSessionState, 'active'>,
  reason: ReturnType<typeof reasonLabels>,
  short: boolean
): string | null {
  const labels = BUILD_WEB_SESSION_STATE_LABELS[state]
  if (state === 'attention') {
    // Why no text on a full row: the attention section's line or the tooltip says why.
    return short ? say(reason?.short ?? labels.short ?? labels.full) : null
  }
  if (!short) {
    return say(labels.full)
  }
  return labels.short ? say(labels.short) : null
}

/** The task number; it opens the task's card and keeps the click from activating the row. */
export function WorktreeTaskKey({ worktree }: { worktree: Worktree }): React.JSX.Element | null {
  const key = worktree.buildWebTask?.key
  if (!key) {
    return null
  }
  return (
    <button
      type="button"
      className="-ml-0.5 shrink-0 rounded-[4px] px-0.5 font-mono text-xs font-medium leading-5 text-foreground hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      aria-label={translate('buildWeb.session.openTaskAria', 'Open task {{key}}', { key })}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        void openWorktreeBuildWebTask(worktree)
      }}
    >
      {key}
    </button>
  )
}

/** The session state at the row's right; `short` is the one-line compact row's form. */
export function WorktreeTaskSessionBadge({
  worktree,
  short,
  className
}: {
  worktree: Worktree
  short: boolean
  className?: string
}): React.JSX.Element | null {
  const state = getWorktreeTaskSessionState(worktree)
  // Why: a failed delete already shows the existing «Delete failed» row.
  const failedDeleteShown =
    worktree.buildWebSession?.reason === 'remove-failed' && Boolean(worktree.removalError)
  if (!state || state === 'active' || failedDeleteShown) {
    return null
  }
  const text = badgeText(state, reasonLabels(worktree.buildWebSession?.reason), short)
  const Icon = state === 'attention' ? CircleAlert : state === 'waiting' ? Timer : Hourglass
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-[3px] whitespace-nowrap text-[11px] leading-4 text-muted-foreground',
            state === 'attention' && 'text-status-warning',
            className
          )}
          data-worktree-task-session={state}
        >
          <Icon className="size-3" aria-hidden />
          {text ? <span>{text}</span> : null}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="max-w-72">
        {describeWorktreeTaskSession(worktree)}
      </TooltipContent>
    </Tooltip>
  )
}

/** The reason under a row in Needs attention, where the row's badge would repeat it. */
export function WorktreeTaskAttentionReason({
  worktree
}: {
  worktree: Worktree
}): React.JSX.Element | null {
  const text = describeWorktreeTaskSession(worktree)
  if (!text || getWorktreeTaskSessionState(worktree) !== 'attention') {
    return null
  }
  return (
    <div
      className="flex items-start gap-1 text-xs leading-4 text-muted-foreground"
      data-worktree-task-attention-reason=""
    >
      <CircleAlert className="mt-0.5 size-3 shrink-0 text-status-warning" aria-hidden />
      <span className="min-w-0">{text}</span>
    </div>
  )
}
