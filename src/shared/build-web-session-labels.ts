import {
  BUILD_WEB_AGENT_SESSION_STATES,
  BUILD_WEB_SESSION_ATTENTION_REASONS,
  type BuildWebAgentSessionState,
  type BuildWebSessionAttentionReason,
  type WorktreeBuildWebSessionState
} from './build-web-session-types'
import type { HideableTaskSessionGroup } from './sidebar-list/task-session-groups'

// The words for a task session's states (IS-147), one source for the sidebar, the task card and
// the phone. The desktop passes `key` and `text` to translate(); the phone shows `text`.

export type BuildWebSessionLabel = { key: string; text: string }

const label = (key: string, text: string): BuildWebSessionLabel => ({
  key: `buildWeb.session.${key}`,
  text
})

export const BUILD_WEB_SESSION_STATE_LABELS: Record<
  WorktreeBuildWebSessionState,
  { full: BuildWebSessionLabel; short: BuildWebSessionLabel | null }
> = {
  active: { full: label('state.active', 'In progress'), short: null },
  // Why no short form: the row shows the timer icon alone.
  waiting: { full: label('state.waiting', 'Awaiting release'), short: null },
  // Why no minutes: the client's clock may differ from the console's.
  closing: {
    full: label('state.closing', 'Closing soon'),
    short: label('state.closingShort', 'soon')
  },
  attention: {
    full: label('state.attention', 'Needs attention'),
    short: label('state.attentionShort', 'attention')
  }
}

export const BUILD_WEB_SESSION_REASON_LABELS: Record<
  BuildWebSessionAttentionReason,
  { full: BuildWebSessionLabel; short: BuildWebSessionLabel }
> = {
  commits: {
    full: label('reason.commits', 'Unmerged commits'),
    short: label('reason.commitsShort', 'Unmerged commits')
  },
  dirty: {
    full: label('reason.dirty', 'Uncommitted changes'),
    short: label('reason.dirtyShort', 'Uncommitted')
  },
  'head-moved': {
    full: label('reason.headMoved', 'Switched to another branch'),
    short: label('reason.headMovedShort', 'Other branch')
  },
  blocked: {
    full: label('reason.blocked', 'Cleanup is blocked'),
    short: label('reason.blockedShort', 'Blocked')
  },
  'remove-failed': {
    full: label('reason.removeFailed', 'Removing the workspace failed'),
    short: label('reason.removeFailedShort', 'Delete failed')
  },
  'agent-running': {
    full: label('reason.agentRunning', 'Agent still running 24 h after Done'),
    short: label('reason.agentRunningShort', 'Agent running')
  },
  'terminal-busy': {
    full: label('reason.terminalBusy', 'Terminal still busy 24 h after Done'),
    short: label('reason.terminalBusyShort', 'Terminal busy')
  },
  'state-unknown': {
    full: label('reason.stateUnknown', 'State unknown 24 h after Done'),
    short: label('reason.stateUnknownShort', 'State unknown')
  },
  'skill-unfinished': {
    full: label('reason.skillUnfinished', 'Skill not finished 24 h after Done'),
    short: label('reason.skillUnfinishedShort', 'Skill unfinished')
  },
  replaced: {
    full: label('reason.replaced', 'A newer session took this task'),
    short: label('reason.replacedShort', 'Replaced')
  },
  'cleanup-off': {
    full: label('reason.cleanupOff', 'Done, auto-remove is off'),
    short: label('reason.cleanupOffShort', 'Task closed')
  }
}

/** Words with the values they name: the desktop passes both to translate(), the phone to fillSessionLabel(). */
export type BuildWebSessionPhrase = { label: BuildWebSessionLabel; values: Record<string, string> }

const phrase = (
  labelOf: BuildWebSessionLabel,
  values: Record<string, string> = {}
): BuildWebSessionPhrase => ({ label: labelOf, values })

// Why separate words for one commit: the phone has no plural rules.
const COMMIT_COUNT_LABELS = {
  one: label('reason.commitsOne', '1 commit not in {{base}}'),
  many: label('reason.commitsMany', '{{count}} commits not in {{base}}'),
  oneNoBase: label('reason.commitsOneNoBase', '1 unmerged commit'),
  manyNoBase: label('reason.commitsManyNoBase', '{{count}} unmerged commits'),
  oneShort: label('reason.commitsOneShort', '1 commit'),
  manyShort: label('reason.commitsManyShort', '{{count}} commits')
} as const

const DETAIL_LABELS = {
  headMoved: label('reason.headMovedTo', 'Switched to {{branch}}'),
  blocked: label('reason.blockedBy', 'Cleanup is blocked ({{detail}})')
} as const

/** `origin/master` and `refs/remotes/origin/master` both name `master`. */
function baseBranchName(baseRef: string | null | undefined): string | null {
  const name = baseRef
    ?.trim()
    .replace(/^refs\/(heads|remotes)\//, '')
    .replace(/^[^/]+\/(?=.)/, '')
  return name ? name : null
}

function commitPhrases(
  detail: string,
  baseRef: string | null | undefined
): { full: BuildWebSessionPhrase; short: BuildWebSessionPhrase } | null {
  const count = /^\d+$/.test(detail) ? Number(detail) : 0
  if (count < 1) {
    return null
  }
  const base = baseBranchName(baseRef)
  const one = count === 1
  const values = { count: String(count) }
  const full = base
    ? phrase(one ? COMMIT_COUNT_LABELS.one : COMMIT_COUNT_LABELS.many, { ...values, base })
    : phrase(one ? COMMIT_COUNT_LABELS.oneNoBase : COMMIT_COUNT_LABELS.manyNoBase, values)
  const short = phrase(one ? COMMIT_COUNT_LABELS.oneShort : COMMIT_COUNT_LABELS.manyShort, values)
  return { full, short }
}

/**
 * An attention reason as a row says it, with the host's detail (the commit count, the branch the
 * worktree moved to, the blockers) and the worktree's base branch; null for a reason this client
 * does not know.
 */
export function sessionAttentionPhrases(args: {
  reason: string | null | undefined
  detail?: string | null
  baseRef?: string | null
}): { full: BuildWebSessionPhrase; short: BuildWebSessionPhrase } | null {
  const labels = sessionReasonLabels(args.reason)
  if (!labels) {
    return null
  }
  const detail = typeof args.detail === 'string' && args.detail !== '' ? args.detail : undefined
  const plain = { full: phrase(labels.full), short: phrase(labels.short) }
  if (!detail) {
    return plain
  }
  if (args.reason === 'commits') {
    return commitPhrases(detail, args.baseRef) ?? plain
  }
  if (args.reason === 'head-moved') {
    return { ...plain, full: phrase(DETAIL_LABELS.headMoved, { branch: detail }) }
  }
  if (args.reason === 'blocked') {
    return { ...plain, full: phrase(DETAIL_LABELS.blocked, { detail }) }
  }
  return plain
}

/** A phrase's text with its values filled in, for the phone, which shows `text` as is. */
export function fillSessionLabel(words: BuildWebSessionPhrase): string {
  return words.label.text.replace(/{{(\w+)}}/g, (match, name: string) => {
    const value = Object.hasOwn(words.values, name) ? words.values[name] : undefined
    return value ?? match
  })
}

/** A reason's words; null for one this client does not know (a newer host's) or none. */
export function sessionReasonLabels(
  reason: string | null | undefined
): (typeof BUILD_WEB_SESSION_REASON_LABELS)[BuildWebSessionAttentionReason] | null {
  const known = BUILD_WEB_SESSION_ATTENTION_REASONS.find((r) => r === reason)
  return known ? BUILD_WEB_SESSION_REASON_LABELS[known] : null
}

/** The console's history states, as the task card's «Sessions» lists them. */
export const BUILD_WEB_AGENT_SESSION_STATE_LABELS: Record<
  BuildWebAgentSessionState,
  BuildWebSessionLabel
> = {
  active: label('history.active', 'In progress'),
  waiting: label('history.waiting', 'Awaiting release'),
  closing: label('history.closing', 'Closing'),
  replaced: label('history.replaced', 'Replaced'),
  kept: label('history.kept', 'Kept'),
  removed: label('history.removed', 'Worktree removed'),
  abandoned: label('history.abandoned', 'Not started'),
  migrated: label('history.migrated', 'Before history')
}

/** A history state's words; for a state a newer console added, the console's own word. */
export function sessionHistoryLabel(state: string): BuildWebSessionLabel {
  const known = BUILD_WEB_AGENT_SESSION_STATES.find((s) => s === state)
  return known ? BUILD_WEB_AGENT_SESSION_STATE_LABELS[known] : label(`history.${state}`, state)
}

/** «By task» group headers. */
export const BUILD_WEB_TASK_GROUP_LABELS = {
  attention: label('group.attention', 'Needs attention'),
  input: label('group.input', 'Input required'),
  pinned: label('group.pinned', 'Pinned'),
  release: label('group.release', 'Awaiting release'),
  progress: label('group.progress', 'In progress'),
  none: label('group.none', 'No task')
} as const

/** The Workspace options switch for the Input required group. */
export const BUILD_WEB_TASK_INPUT_GROUP_SWITCH_LABEL = label(
  'groupSwitch.input',
  'Input required group'
)

/** The session filter's switches in Workspace options. */
export const BUILD_WEB_TASK_FILTER_LABELS: Record<HideableTaskSessionGroup, BuildWebSessionLabel> =
  {
    none: label('filter.none', 'Hide workspaces without a task'),
    progress: label('filter.progress', 'Hide in progress'),
    release: label('filter.release', 'Hide awaiting release')
  }

/** What a closed task's leftover offers from its row's menu. */
export const BUILD_WEB_SESSION_ACTION_LABELS = {
  open: label('action.open', 'Open'),
  removeAnyway: label('action.removeAnyway', 'Remove anyway…'),
  keep: label('action.keep', 'Keep, unlink from task'),
  backToWork: label('action.backToWork', 'Back to work'),
  removeRule: label(
    'remove.rule',
    'Uncommitted, untracked and ignored files are lost. The branch is deleted only when merged; an unmerged branch is kept.'
  )
} as const
