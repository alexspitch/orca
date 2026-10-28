import { describe, expect, it } from 'vitest'
import type {
  BuildWebAgentSessionRecord,
  WorktreeBuildWebSession,
  WorktreeBuildWebTask
} from './build-web-session-types'
import { joinSessionRows, taskSessionState } from './build-web-session-rows'

const CONSOLE = 'https://bw.example:8585'

const record = (id: string, over: Partial<BuildWebAgentSessionRecord> = {}) => ({
  id,
  issue_id: 'i1',
  issue_key: 'IS-1',
  by: 'alex',
  surface_id: `tab-${id}`,
  surface_kind: 'terminal' as const,
  agent: 'claude',
  execution_host_id: '',
  worktree_name: `wt-${id}`,
  provider_session_id: '',
  started_at: '2026-10-28T10:00:00Z',
  agent_finished_at: null,
  ended_at: null,
  ended_state: null,
  worktree_removed_at: null,
  removal_note: null,
  state: 'active' as const,
  ...over
})

const worktree = (
  id: string,
  task: Partial<WorktreeBuildWebTask>,
  session?: WorktreeBuildWebSession
) => ({
  id,
  buildWebTask: { issueId: 'i1', key: 'IS-1', consoleHost: CONSOLE, branch: id, ...task },
  ...(session ? { buildWebSession: session } : {})
})

describe('a task card’s sessions', () => {
  it('joins each session to the worktree its link names, attention from the worktree', () => {
    const attention = { state: 'attention' as const, reason: 'commits' as const, at: 1 }
    const rows = joinSessionRows(
      [
        record('s3'),
        record('s2', { ended_at: 'x', ended_state: 'replaced', state: 'replaced' }),
        record('s1', { worktree_removed_at: 'y', state: 'removed', removal_note: 'kept is-1' })
      ],
      [
        worktree('a', { sessionId: 's2' }, attention),
        worktree('b', { sessionId: 's3' }),
        worktree('c', { sessionId: 's1' })
      ],
      'i1',
      CONSOLE
    )
    expect(
      rows.map((r) => [r.record.id, r.worktree?.id ?? null, r.attention?.reason ?? null])
    ).toEqual([
      ['s3', 'b', null],
      ['s2', 'a', 'commits'],
      ['s1', null, null]
    ])
  })

  it('gives a worktree not linked yet only to the newest open session', () => {
    const rows = joinSessionRows(
      [record('s2'), record('s1', { ended_at: 'x', state: 'abandoned' })],
      [worktree('fresh', {}), worktree('elsewhere', { issueId: 'i2' })],
      'i1',
      CONSOLE
    )
    expect(rows.map((r) => r.worktree?.id ?? null)).toEqual(['fresh', null])
  })

  it('marks the list row from the console’s state, or «held» from an older console', () => {
    expect(taskSessionState({ agent_session: null, agent_session_state: 'waiting' })).toBe(
      'waiting'
    )
    expect(taskSessionState({ agent_session: null, agent_session_state: null })).toBeNull()
    expect(taskSessionState({ agent_session: { ...record('s1'), surface_kind: 'terminal' } })).toBe(
      'active'
    )
  })
})
