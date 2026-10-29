import type {
  BuildWebAgentSessionStatus,
  BuildWebSessionAttentionReason,
  WorktreeBuildWebSession
} from '../../shared/build-web-session-types'

// The watcher's half of a task worktree's state (IS-147): what the console says, under the rule that
// an attention the finisher wrote stays until the task leaves the closed states. With the owner's
// auto-remove off, a closed task's worktree waits for a person.

export type BuildWebSessionStateChange =
  | { kind: 'none' }
  | { kind: 'set'; session: Omit<WorktreeBuildWebSession, 'at'> }
  /** The run never started: the worktree keeps its task, without a state. */
  | { kind: 'clear-session' }
  /** Someone kept it elsewhere: the link to the task goes too. */
  | { kind: 'clear-task' }

// Why: these come from the console's answer, so a later answer may replace them.
const WATCHER_REASONS: readonly BuildWebSessionAttentionReason[] = [
  'replaced',
  'skill-unfinished',
  'cleanup-off'
]

const NONE: BuildWebSessionStateChange = { kind: 'none' }

export function sameBuildWebSessionState(
  a: Omit<WorktreeBuildWebSession, 'at'> | undefined,
  b: Omit<WorktreeBuildWebSession, 'at'> | undefined
): boolean {
  return a?.state === b?.state && a?.reason === b?.reason && a?.detail === b?.detail
}

function changeTo(
  current: WorktreeBuildWebSession | undefined,
  next: Omit<WorktreeBuildWebSession, 'at'>
): BuildWebSessionStateChange {
  return sameBuildWebSessionState(current, next) ? NONE : { kind: 'set', session: next }
}

export function isFinisherAttention(session: WorktreeBuildWebSession | undefined): boolean {
  return (
    session?.state === 'attention' &&
    (session.reason === undefined || !WATCHER_REASONS.includes(session.reason))
  )
}

// Why: these say only that a closed task's worktree waited too long; a later good look lifts them.
const WAIT_REASONS: readonly BuildWebSessionAttentionReason[] = [
  'agent-running',
  'terminal-busy',
  'state-unknown'
]

export function isWaitAttention(session: WorktreeBuildWebSession | undefined): boolean {
  return (
    session?.state === 'attention' &&
    session.reason !== undefined &&
    WAIT_REASONS.includes(session.reason)
  )
}

function liveChange(
  current: WorktreeBuildWebSession | undefined,
  state: 'active' | 'waiting' | 'closing',
  finishOverdue: boolean
): BuildWebSessionStateChange {
  return finishOverdue
    ? changeTo(current, { state: 'attention', reason: 'skill-unfinished' })
    : changeTo(current, { state })
}

/** Nothing will finish the worktree: what it waited on and the skill's lateness give way to this. */
function cleanupOffChange(
  current: WorktreeBuildWebSession | undefined
): BuildWebSessionStateChange {
  return isFinisherAttention(current) && !isWaitAttention(current)
    ? NONE
    : changeTo(current, { state: 'attention', reason: 'cleanup-off' })
}

/** `autoCleanup`: the owner's auto-remove setting from the same answer. */
export function watchedBuildWebSessionChange(
  current: WorktreeBuildWebSession | undefined,
  status: Pick<BuildWebAgentSessionStatus, 'state' | 'finish_overdue'>,
  autoCleanup = true
): BuildWebSessionStateChange {
  switch (status.state) {
    case 'kept':
      return { kind: 'clear-task' }
    case 'abandoned':
      return current ? { kind: 'clear-session' } : NONE
    case 'removed':
    case 'migrated':
      // Why: the console heard of a removal while this worktree still exists; it shows no state.
      return NONE
    case 'replaced':
      return changeTo(current, { state: 'attention', reason: 'replaced' })
    case 'closing':
      if (!autoCleanup) {
        return cleanupOffChange(current)
      }
      if (isFinisherAttention(current)) {
        return NONE
      }
      return liveChange(current, status.state, status.finish_overdue)
    case 'active':
    case 'waiting':
      return liveChange(current, status.state, status.finish_overdue)
  }
}
