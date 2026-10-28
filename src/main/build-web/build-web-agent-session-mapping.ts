import {
  BUILD_WEB_AGENT_SESSION_STATES,
  type BuildWebAgentSessionEndedState,
  type BuildWebAgentSessionIssue,
  type BuildWebAgentSessionLookup,
  type BuildWebAgentSessionRecord,
  type BuildWebAgentSessionSettings,
  type BuildWebAgentSessionState,
  type BuildWebAgentSessionStatus,
  type BuildWebLiveSessionState
} from '../../shared/build-web-session-types'
import { recordOf, textOf, textOrNull } from './build-web-response-fields'

// The console's session history (IS-147) as Orca reads it: unknown states and kinds never pass.

const ENDED: readonly BuildWebAgentSessionEndedState[] = [
  'replaced',
  'kept',
  'removed',
  'abandoned'
]
const LIVE: readonly BuildWebLiveSessionState[] = ['active', 'waiting', 'closing']
const SURFACES = ['terminal', 'structured', 'unknown'] as const

export function agentSessionStateOf(value: unknown): BuildWebAgentSessionState | null {
  return BUILD_WEB_AGENT_SESSION_STATES.find((s) => s === value) ?? null
}

export function liveSessionStateOf(value: unknown): BuildWebLiveSessionState | null {
  return LIVE.find((s) => s === value) ?? null
}

export function agentSessionRecordOf(value: unknown): BuildWebAgentSessionRecord | null {
  const v = recordOf(value)
  const state = agentSessionStateOf(v?.state)
  if (!v || typeof v.id !== 'string' || !v.id || !state) {
    return null
  }
  return {
    id: v.id,
    issue_id: textOrNull(v.issue_id),
    issue_key: textOf(v.issue_key),
    by: textOf(v.by),
    surface_id: textOf(v.surface_id),
    surface_kind: SURFACES.find((k) => k === v.surface_kind) ?? 'unknown',
    agent: textOf(v.agent),
    execution_host_id: textOf(v.execution_host_id),
    worktree_name: textOf(v.worktree_name),
    provider_session_id: textOf(v.provider_session_id),
    started_at: textOf(v.started_at),
    agent_finished_at: textOrNull(v.agent_finished_at),
    ended_at: textOrNull(v.ended_at),
    ended_state: ENDED.find((s) => s === v.ended_state) ?? null,
    worktree_removed_at: textOrNull(v.worktree_removed_at),
    removal_note: textOrNull(v.removal_note),
    state
  }
}

export function agentSessionRecordsOf(value: unknown): BuildWebAgentSessionRecord[] | undefined {
  return Array.isArray(value)
    ? value.map(agentSessionRecordOf).filter((r): r is BuildWebAgentSessionRecord => r !== null)
    : undefined
}

function sessionIssueOf(value: unknown): BuildWebAgentSessionIssue | null {
  const v = recordOf(value)
  if (!v || typeof v.key !== 'string') {
    return null
  }
  const parent = recordOf(v.parent)
  return {
    key: v.key,
    title: textOf(v.title),
    status: textOf(v.status),
    archived: v.archived === true,
    deleted: v.deleted === true,
    parent:
      parent && typeof parent.key === 'string'
        ? { key: parent.key, status: textOf(parent.status) }
        : null
  }
}

export function agentSessionSettingsOf(value: unknown): BuildWebAgentSessionSettings {
  // Why default on: the plan's default, and a console that dropped the field must not stop cleanup silently.
  return { auto_cleanup: recordOf(value)?.auto_cleanup !== false }
}

export function agentSessionLookupOf(value: unknown): BuildWebAgentSessionLookup {
  const v = recordOf(value)
  const sessions = Array.isArray(v?.sessions) ? v.sessions : []
  return {
    sessions: sessions.flatMap((raw): BuildWebAgentSessionStatus[] => {
      const record = agentSessionRecordOf(raw)
      const extra = recordOf(raw)
      return record && extra
        ? [
            {
              ...record,
              issue: sessionIssueOf(extra.issue),
              closed_since: textOrNull(extra.closed_since),
              eligible: extra.eligible === true,
              finish_overdue: extra.finish_overdue === true
            }
          ]
        : []
    }),
    settings: agentSessionSettingsOf(v?.settings)
  }
}
