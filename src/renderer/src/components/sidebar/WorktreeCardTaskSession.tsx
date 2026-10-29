import React from 'react'
import { CircleAlert, Hourglass, Timer } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import {
  BUILD_WEB_SESSION_STATE_LABELS,
  sessionAttentionPhrases,
  type BuildWebSessionLabel,
  type BuildWebSessionPhrase
} from '../../../../shared/build-web-session-labels'
import type { WorktreeBuildWebSessionState } from '../../../../shared/build-web-session-types'
import { getWorktreeTaskSessionState } from '../../../../shared/sidebar-list/task-session-groups'
import type { Worktree } from '../../../../shared/worktree/types'
import { openWorktreeBuildWebTask } from './worktree-task-session-actions'

// IS-147: a task worktree's number before its title and its session state at the row's right.
// The agent lane on the left stays the agent's.

const say = (label: BuildWebSessionLabel): string => translate(label.key, label.text)
const sayPhrase = (words: BuildWebSessionPhrase): string =>
  translate(words.label.key, words.label.text, words.values)

function attentionPhrases(worktree: Worktree) {
  return sessionAttentionPhrases({
    reason: worktree.buildWebSession?.reason,
    detail: worktree.buildWebSession?.detail,
    baseRef: worktree.baseRef
  })
}

/** The full sentence for a row's state, as its tooltip and the attention section's line say it. */
export function describeWorktreeTaskSession(worktree: Worktree): string | null {
  const state = getWorktreeTaskSessionState(worktree)
  if (!state || state === 'active') {
    return null
  }
  const phrases = state === 'attention' ? attentionPhrases(worktree) : null
  return phrases ? sayPhrase(phrases.full) : say(BUILD_WEB_SESSION_STATE_LABELS[state].full)
}

/** Compact rows: waiting is the icon alone, closing «soon»; attention its short reason, an opened row its icon. */
function badgeText(
  state: Exclude<WorktreeBuildWebSessionState, 'active'>,
  worktree: Worktree,
  short: boolean,
  iconOnlyAttention: boolean
): string | null {
  const labels = BUILD_WEB_SESSION_STATE_LABELS[state]
  if (state === 'attention') {
    if (iconOnlyAttention) {
      return null
    }
    const phrases = attentionPhrases(worktree)
    return phrases ? sayPhrase(phrases.short) : say(labels.short ?? labels.full)
  }
  if (!short) {
    return say(labels.full)
  }
  return labels.short ? say(labels.short) : null
}

/**
 * The task number; it opens the task's card and keeps the click from activating the row. A compact
 * row leads its title with it in the title's font; a full card shows it in the meta row, where a
 * linked Jira issue sits. Hover cards wrap it through `asChild`, so it takes their props and ref.
 */
export function WorktreeTaskKey({
  worktree,
  placement = 'title',
  onOpen,
  className,
  ...triggerProps
}: Omit<React.ComponentProps<'button'>, 'children'> & {
  worktree: Worktree
  placement?: 'title' | 'meta'
  /** Runs before the task opens, e.g. to close the hover card the number carries. */
  onOpen?: () => void
}): React.JSX.Element | null {
  const key = worktree.buildWebTask?.key
  if (!key) {
    return null
  }
  return (
    <button
      type="button"
      {...triggerProps}
      className={cn(
        'shrink-0 rounded-[4px] px-0.5 hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        placement === 'title'
          ? '-ml-0.5 text-[13px] leading-[18px] text-foreground'
          : 'font-mono text-[11px] font-medium leading-none text-muted-foreground hover:text-foreground',
        className
      )}
      aria-label={translate('buildWeb.session.openTaskAria', 'Open task {{key}}', { key })}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onOpen?.()
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
  compact = false
}: {
  worktree: Worktree
  short: boolean
  /** A compact row's chip: no pill, and an opened row's attention as its icon alone (mockup). */
  compact?: boolean
}): React.JSX.Element | null {
  const state = getWorktreeTaskSessionState(worktree)
  // Why: a failed delete already shows the existing «Delete failed» row.
  const failedDeleteShown =
    worktree.buildWebSession?.reason === 'remove-failed' && Boolean(worktree.removalError)
  if (!state || state === 'active' || failedDeleteShown) {
    return null
  }
  const text = badgeText(state, worktree, short, compact && !short)
  const Icon = state === 'attention' ? CircleAlert : state === 'waiting' ? Timer : Hourglass
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-[3px] whitespace-nowrap text-[11px] leading-4 text-muted-foreground',
            state === 'attention' && 'text-status-warning',
            state === 'attention' && !compact && 'rounded-[4px] bg-status-warning-background px-1'
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

/**
 * The reason under a row in Needs attention, where the row's badge would repeat it. A failed
 * delete says what the host reported, under the «Delete failed» badge, in the muted tone.
 */
export function WorktreeTaskAttentionReason({
  worktree
}: {
  worktree: Worktree
}): React.JSX.Element | null {
  if (getWorktreeTaskSessionState(worktree) !== 'attention') {
    return null
  }
  const removalError =
    worktree.buildWebSession?.reason === 'remove-failed' ? worktree.removalError?.trim() : undefined
  const text = removalError || describeWorktreeTaskSession(worktree)
  if (!text) {
    return null
  }
  return (
    <div
      className="flex min-w-0 items-start gap-1 text-xs leading-4 text-muted-foreground"
      data-worktree-task-attention-reason=""
    >
      <CircleAlert
        className={cn('mt-0.5 size-3 shrink-0', !removalError && 'text-status-warning')}
        aria-hidden
      />
      <span className="min-w-0 truncate" title={text}>
        {text}
      </span>
    </div>
  )
}
