import type {
  BuildWebAgentSessionState,
  BuildWebSessionAttentionReason,
  WorktreeBuildWebSessionState
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
    full: label('reason.commits', 'Task closed, branch has unmerged commits'),
    short: label('reason.commitsShort', 'Unmerged commits')
  },
  dirty: {
    full: label('reason.dirty', 'Task closed, worktree has uncommitted changes'),
    short: label('reason.dirtyShort', 'Uncommitted')
  },
  'head-moved': {
    full: label('reason.headMoved', 'Task closed, worktree is on another branch'),
    short: label('reason.headMovedShort', 'Other branch')
  },
  blocked: {
    full: label('reason.blocked', 'Task closed, cleanup is blocked'),
    short: label('reason.blockedShort', 'Blocked')
  },
  'remove-failed': {
    full: label('reason.removeFailed', 'Task closed, removing the worktree failed'),
    short: label('reason.removeFailedShort', 'Delete failed')
  },
  'agent-running': {
    full: label('reason.agentRunning', 'Task closed a day ago, the agent is still running'),
    short: label('reason.agentRunningShort', 'Agent running')
  },
  'terminal-busy': {
    full: label('reason.terminalBusy', 'Task closed a day ago, a terminal is still busy'),
    short: label('reason.terminalBusyShort', 'Terminal busy')
  },
  'state-unknown': {
    full: label('reason.stateUnknown', 'Task closed a day ago, the worktree state is unknown'),
    short: label('reason.stateUnknownShort', 'State unknown')
  },
  'skill-unfinished': {
    full: label('reason.skillUnfinished', 'Task done a day ago, the skill never finished'),
    short: label('reason.skillUnfinishedShort', 'Skill unfinished')
  },
  replaced: {
    full: label('reason.replaced', 'A newer session took this task'),
    short: label('reason.replacedShort', 'Replaced')
  }
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
  abandoned: label('history.abandoned', 'Not started')
}

/** «By task» group headers. */
export const BUILD_WEB_TASK_GROUP_LABELS = {
  attention: label('group.attention', 'Needs attention'),
  pinned: label('group.pinned', 'Pinned'),
  release: label('group.release', 'Awaiting release'),
  progress: label('group.progress', 'In progress'),
  none: label('group.none', 'No task')
} as const

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
