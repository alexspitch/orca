import { describe, expect, it } from 'vitest'
import type { BuildWebAgentSession } from './build-web-types'
import type { WorktreeBuildWebTask } from './build-web-session-types'
import { findTaskSessionWorktree } from './build-web-task-session-worktree'

const CONSOLE = 'https://bw.example:8585'

const session = (over: Partial<BuildWebAgentSession> = {}): BuildWebAgentSession => ({
  surface_kind: 'terminal',
  surface_id: 'tab-1',
  worktree_name: 'is-1',
  execution_host_id: '',
  agent: 'claude',
  started_at: '',
  provider_session_id: '',
  by: 'alex',
  ...over
})

const worktree = (id: string, task?: Partial<WorktreeBuildWebTask>) => ({
  id,
  ...(task
    ? {
        buildWebTask: {
          issueId: 'i1',
          key: 'IS-1',
          consoleHost: `${CONSOLE}/`,
          branch: id,
          ...task
        }
      }
    : {})
})

describe('the worktree «Take to work» opens again', () => {
  const rows = [
    worktree('old', { sessionId: 's1' }),
    worktree('current', { sessionId: 's2' }),
    worktree('other', { issueId: 'i2', sessionId: 's2' }),
    worktree('plain')
  ]

  it('is the one linked to the task’s current session', () => {
    const issue = { id: 'i1', agent_session: session({ id: 's2', state: 'active' }) }
    expect(findTaskSessionWorktree(issue, rows, CONSOLE)?.id).toBe('current')
  })

  it('is none once the task is closed, or when it holds no session', () => {
    const closing = { id: 'i1', agent_session: session({ id: 's2', state: 'closing' }) }
    expect(findTaskSessionWorktree(closing, rows, CONSOLE)).toBeNull()
    expect(findTaskSessionWorktree({ id: 'i1', agent_session: null }, rows, CONSOLE)).toBeNull()
  })

  it('never takes a worktree linked to an older session, but one not linked yet', () => {
    const issue = { id: 'i1', agent_session: session({ id: 's3' }) }
    expect(findTaskSessionWorktree(issue, rows, CONSOLE)).toBeNull()
    expect(findTaskSessionWorktree(issue, [...rows, worktree('fresh', {})], CONSOLE)?.id).toBe(
      'fresh'
    )
  })

  it('belongs to the same console', () => {
    const issue = { id: 'i1', agent_session: session({ id: 's2' }) }
    expect(findTaskSessionWorktree(issue, rows, 'https://other:8585')).toBeNull()
  })
})
