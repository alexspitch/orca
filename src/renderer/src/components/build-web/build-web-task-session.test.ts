import { describe, expect, it } from 'vitest'
import type { Tab } from '../../../../shared/tab-types'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { findNamedTaskSession, taskSessionName } from './build-web-task-session'

const terminal = (id: string, over: Partial<TerminalTab> = {}): TerminalTab =>
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the finder reads only id and the two name fields.
  ({ id, title: 'claude', customTitle: null, ...over }) as TerminalTab

const chat = (id: string, customLabel?: string): Tab =>
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the finder reads only id, contentType and customLabel.
  ({ id, contentType: 'agent-session', customLabel }) as Tab

describe('task session name', () => {
  it('is the task key', () => {
    expect(taskSessionName(['IS-12'])).toBe('IS-12')
  })

  it('lists up to three keys of a batch and counts the rest', () => {
    expect(taskSessionName(['IS-1', 'IS-2', 'IS-1'])).toBe('IS-1, IS-2')
    expect(taskSessionName(['IS-1', 'IS-2', 'IS-3', 'IS-4', 'IS-5'])).toBe('IS-1, IS-2, IS-3 +2')
  })
})

describe('finding the named session', () => {
  it('finds a terminal by its launch label or a rename, ignoring case', () => {
    const state = {
      activeWorktreeId: null,
      tabsByWorktree: {
        a: [terminal('t1', { title: 'IS-12' })],
        b: [terminal('t2', { quickCommandLabel: 'IS-12' })],
        c: [terminal('t3', { customTitle: 'is-7' })]
      },
      unifiedTabsByWorktree: {}
    }
    expect(findNamedTaskSession(state, 'IS-12')).toEqual({
      kind: 'terminal',
      worktreeId: 'b',
      tabId: 't2'
    })
    expect(findNamedTaskSession(state, 'IS-7')?.tabId).toBe('t3')
    expect(findNamedTaskSession(state, 'IS-8')).toBeNull()
  })

  it('finds a chat by its tab name', () => {
    const state = {
      activeWorktreeId: null,
      tabsByWorktree: {},
      unifiedTabsByWorktree: { a: [chat('u1'), chat('u2', 'IS-12')] }
    }
    expect(findNamedTaskSession(state, 'IS-12')).toEqual({
      kind: 'structured',
      worktreeId: 'a',
      tabId: 'u2'
    })
  })

  it('prefers the active worktree', () => {
    const state = {
      activeWorktreeId: 'b',
      tabsByWorktree: {
        a: [terminal('t1', { quickCommandLabel: 'IS-12' })],
        b: [terminal('t2', { quickCommandLabel: 'IS-12' })]
      },
      unifiedTabsByWorktree: {}
    }
    expect(findNamedTaskSession(state, 'IS-12')?.tabId).toBe('t2')
  })
})
