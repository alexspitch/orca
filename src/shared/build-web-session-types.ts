// A «Take to work» task's session, end to end (IS-147): the worktree Orca made for one task, the
// console's history row of the agent that ran in it, and the state the host derives from both.

/** The task a «Take to work» worktree was made for. Written at create; cleared only by «Keep». */
export type WorktreeBuildWebTask = {
  issueId: string
  key: string
  /** The console's base URL: the card opens only against that console. */
  consoleHost: string
  /** The branch Orca created for this worktree — the only branch Orca may delete. */
  branch: string
  /** The console's session row id. Written by the host after the console stored the session. */
  sessionId?: string
}

/** What «Take to work» asks `worktree.create` to record; the host adds `branch`, later `sessionId`. */
export type WorktreeBuildWebTaskRequest = Pick<
  WorktreeBuildWebTask,
  'issueId' | 'key' | 'consoleHost'
>

/** What the console derives from the task's status; ended rows answer their `ended_state`. */
export const BUILD_WEB_AGENT_SESSION_STATES = [
  'active',
  'waiting',
  'closing',
  'replaced',
  'kept',
  'removed',
  'abandoned',
  /** A session from before the history, of a task already closed when the console was migrated. */
  'migrated'
] as const
export type BuildWebAgentSessionState = (typeof BUILD_WEB_AGENT_SESSION_STATES)[number]

export type BuildWebAgentSessionEndedState = Extract<
  BuildWebAgentSessionState,
  'replaced' | 'kept' | 'removed' | 'abandoned' | 'migrated'
>

/** The live states a task row and a worktree show; `null` when the task holds no session. */
export type BuildWebLiveSessionState = Extract<
  BuildWebAgentSessionState,
  'active' | 'waiting' | 'closing'
>

/** Why a closed task's worktree needs a person. Codes, worded by each client. */
export const BUILD_WEB_SESSION_ATTENTION_REASONS = [
  'commits',
  'dirty',
  'head-moved',
  'blocked',
  'remove-failed',
  'agent-running',
  'terminal-busy',
  'state-unknown',
  'skill-unfinished',
  'replaced',
  /** Closed while the owner's auto-remove is off: the worktree waits for a person. */
  'cleanup-off'
] as const
export type BuildWebSessionAttentionReason = (typeof BUILD_WEB_SESSION_ATTENTION_REASONS)[number]

/** The sidebar's states of a task worktree; written by the host only. */
export const WORKTREE_BUILD_WEB_SESSION_STATES = [
  'active',
  'waiting',
  'closing',
  'attention'
] as const
export type WorktreeBuildWebSessionState = (typeof WORKTREE_BUILD_WEB_SESSION_STATES)[number]

export type WorktreeBuildWebSession = {
  state: WorktreeBuildWebSessionState
  /** Set with `attention` only. */
  reason?: BuildWebSessionAttentionReason
  /** A short host detail for the attention, e.g. the blocker a scan found; never a path. */
  detail?: string
  /** Host clock, ms: when the state was written. Never compared across machines. */
  at: number
}

/** A row of the console's session history (`tms_agent_sessions`), as a task's card lists it. */
export type BuildWebAgentSessionRecord = {
  id: string
  issue_id: string | null
  issue_key: string
  by: string
  surface_id: string
  surface_kind: 'terminal' | 'structured' | 'unknown'
  agent: string
  execution_host_id: string
  worktree_name: string
  provider_session_id: string
  started_at: string
  agent_finished_at: string | null
  ended_at: string | null
  ended_state: BuildWebAgentSessionEndedState | null
  worktree_removed_at: string | null
  removal_note: string | null
  state: BuildWebAgentSessionState
}

export type BuildWebAgentSessionIssue = {
  key: string
  title: string
  status: string
  archived: boolean
  deleted: boolean
  parent: { key: string; status: string } | null
}

/** `GET /api/tms/agent-sessions?ids=` — one session as the host's watcher reads it. */
export type BuildWebAgentSessionStatus = BuildWebAgentSessionRecord & {
  issue: BuildWebAgentSessionIssue | null
  closed_since: string | null
  /** Closed for 10 minutes by the console's clock, the skill done (for `done`), not ended. */
  eligible: boolean
  /** Closed as done a day ago and the skill never said it finished. */
  finish_overdue: boolean
}

export type BuildWebAgentSessionSettings = {
  /** Remove a closed task's empty worktree on its own; on by default. */
  auto_cleanup: boolean
}

export type BuildWebAgentSessionLookup = {
  sessions: BuildWebAgentSessionStatus[]
  settings: BuildWebAgentSessionSettings
}

/** The console feature that serves the lifecycle above (`/api/tms/agent-sessions`). */
export const BUILD_WEB_AGENT_SESSION_LIFECYCLE_FEATURE = 'agent-session-lifecycle'
