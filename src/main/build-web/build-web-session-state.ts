import type {
  BuildWebAgentSessionStatus,
  BuildWebSessionAttentionReason,
  WorktreeBuildWebSession
} from '../../shared/build-web-session-types'

// The watcher's half of a task worktree's state (IS-147): what the console says, under the rule that
// an attention the finisher wrote stays until the task leaves the closed states.

export type BuildWebSessionStateChange =
  | { kind: 'none' }
  | { kind: 'set'; session: Omit<WorktreeBuildWebSession, 'at'> }
  /** The run never started: the worktree keeps its task, without a state. */
  | { kind: 'clear-session' }
  /** Someone kept it elsewhere: the link to the task goes too. */
  | { kind: 'clear-task' }

// Why: these two come from the console's answer, so a later answer may replace them.
const WATCHER_REASONS: readonly BuildWebSessionAttentionReason[] = ['replaced', 'skill-unfinished']

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

function liveChange(
  current: WorktreeBuildWebSession | undefined,
  state: 'active' | 'waiting' | 'closing',
  finishOverdue: boolean
): BuildWebSessionStateChange {
  return finishOverdue
    ? changeTo(current, { state: 'attention', reason: 'skill-unfinished' })
    : changeTo(current, { state })
}

export function watchedBuildWebSessionChange(
  current: WorktreeBuildWebSession | undefined,
  status: Pick<BuildWebAgentSessionStatus, 'state' | 'finish_overdue'>
): BuildWebSessionStateChange {
  switch (status.state) {
    case 'kept':
      return { kind: 'clear-task' }
    case 'abandoned':
      return current ? { kind: 'clear-session' } : NONE
    case 'removed':
      // Why: the console heard of a removal while this worktree still exists; it shows no state.
      return NONE
    case 'replaced':
      return changeTo(current, { state: 'attention', reason: 'replaced' })
    case 'closing':
      if (isFinisherAttention(current)) {
        return NONE
      }
      return liveChange(current, status.state, status.finish_overdue)
    case 'active':
    case 'waiting':
      return liveChange(current, status.state, status.finish_overdue)
  }
}
