import { describe, expect, it } from 'vitest'
import type { Tab } from '../../../../shared/tab-types'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { tokenizeStartupCommand } from '../../../../shared/tui-agent-startup-shell'
import {
  claudeNameArgs,
  findNamedTaskSession,
  taskKeysLabel,
  taskSessionName,
  taskSessionNames
} from './build-web-task-session'

const terminal = (id: string, over: Partial<TerminalTab> = {}): TerminalTab =>
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the finder reads only id and the two name fields.
  ({ id, title: 'claude', customTitle: null, ...over }) as TerminalTab

const chat = (id: string, customLabel?: string): Tab =>
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the finder reads only id, contentType and customLabel.
  ({ id, contentType: 'agent-session', customLabel }) as Tab

const task = (key: string, title: string) => ({ key, title })

describe('task session name', () => {
  it('is the task key and its title', () => {
    expect(taskSessionName([task('SDAP-3931', '  Login   fails on SSO ')])).toBe(
      'SDAP-3931 Login fails on SSO'
    )
    expect(taskSessionName([task('IS-12', '')])).toBe('IS-12')
  })

  it('names up to three tasks of a batch and counts the rest', () => {
    expect(
      taskSessionName([task('IS-1', 'One'), task('IS-2', 'Two'), task('IS-1', 'One again')])
    ).toBe('IS-1 One again; IS-2 Two')
    const five = ['IS-1', 'IS-2', 'IS-3', 'IS-4', 'IS-5'].map((k) => task(k, `Fix ${k}`))
    expect(taskSessionName(five)).toBe('IS-1 Fix IS-1; IS-2 Fix IS-2; IS-3 Fix IS-3 +2')
  })

  it('cuts titles, never keys, to stay within 80 characters, giving short titles’ room to long ones', () => {
    const long = 'Export of the call recordings hangs when the archive holds more than a year'
    const one = taskSessionName([task('SDAP-4242', long)])
    expect(one.length).toBeLessThanOrEqual(80)
    expect(one.startsWith('SDAP-4242 Export of the call')).toBe(true)
    expect(one.endsWith('…')).toBe(true)
    const batch = taskSessionName([
      task('SDAP-1', 'Short'),
      task('SDAP-22', long),
      task('SDAP-333', long),
      task('SDAP-4', 'x')
    ])
    expect(batch.length).toBeLessThanOrEqual(80)
    expect(batch).toMatch(/^SDAP-1 Short; SDAP-22 Export.+…; SDAP-333 Export.+… \+1$/)
  })

  it('still knows the keys-only name sessions had before', () => {
    expect(taskKeysLabel(['IS-1', 'IS-2', 'IS-3', 'IS-4', 'IS-5'])).toBe('IS-1, IS-2, IS-3 +2')
    expect(taskSessionNames([task('IS-12', 'Login')])).toEqual(['IS-12 Login', 'IS-12'])
  })
})

describe('the Claude session name argument', () => {
  const nasty = 'IS-1 Can\'t "save" $(rm -rf ~) `id` %PATH% !x! ^c \\server\nnext'

  it.each(['posix', 'powershell', 'cmd'] as const)(
    'is one value after the user’s own args (%s)',
    (shell) => {
      const args = claudeNameArgs('--model opus --effort high', nasty)
      const tokens = tokenizeStartupCommand(args, shell)
      expect(tokens.ok && tokens.tokens).toEqual([
        '--model',
        'opus',
        '--effort',
        'high',
        '--name',
        'IS-1 Can’t ”save” (rm -rf ~) id PATH x c server next'
      ])
    }
  )

  it('is just the name without user args, and nothing without a name', () => {
    expect(claudeNameArgs('  ', 'IS-1 Login')).toBe('--name "IS-1 Login"')
    expect(claudeNameArgs('--model opus', ' $ ` ')).toBe('--model opus')
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
    expect(findNamedTaskSession(state, ['IS-12'])).toEqual({
      kind: 'terminal',
      worktreeId: 'b',
      tabId: 't2'
    })
    expect(findNamedTaskSession(state, ['IS-7'])?.tabId).toBe('t3')
    expect(findNamedTaskSession(state, ['IS-8'])).toBeNull()
  })

  it('finds a chat by its tab name', () => {
    const state = {
      activeWorktreeId: null,
      tabsByWorktree: {},
      unifiedTabsByWorktree: { a: [chat('u1'), chat('u2', 'IS-12')] }
    }
    expect(findNamedTaskSession(state, ['IS-12'])).toEqual({
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
    expect(findNamedTaskSession(state, ['IS-12'])?.tabId).toBe('t2')
  })

  it('finds a session by today’s name or by the keys-only name of before', () => {
    const state = {
      activeWorktreeId: null,
      tabsByWorktree: { a: [terminal('t1', { quickCommandLabel: 'IS-1, IS-2' })] },
      unifiedTabsByWorktree: { b: [chat('u1', 'IS-3 Login fails')] }
    }
    const names = (keys: string[], titles: string[]) =>
      taskSessionNames(keys.map((k, i) => task(k, titles[i])))
    expect(findNamedTaskSession(state, names(['IS-1', 'IS-2'], ['A', 'B']))?.tabId).toBe('t1')
    expect(findNamedTaskSession(state, names(['IS-3'], ['Login fails']))?.tabId).toBe('u1')
    expect(findNamedTaskSession(state, [])).toBeNull()
  })
})
