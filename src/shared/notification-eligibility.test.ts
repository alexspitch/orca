import { describe, expect, it } from 'vitest'
import { getDefaultNotificationSettings } from './notification-settings-defaults'
import {
  isAgentNeedsInputState,
  isNotificationSourceAllowed,
  passesAgentNeedsInputOnly
} from './notification-eligibility'

describe('isAgentNeedsInputState', () => {
  it('is true only for a prompt or a question', () => {
    expect(isAgentNeedsInputState('blocked')).toBe(true)
    expect(isAgentNeedsInputState('waiting')).toBe(true)
    expect(isAgentNeedsInputState('working')).toBe(false)
    expect(isAgentNeedsInputState('done')).toBe(false)
    expect(isAgentNeedsInputState(undefined)).toBe(false)
  })
})

describe('passesAgentNeedsInputOnly', () => {
  it('lets everything through while the preference is off', () => {
    const settings = { agentNeedsInputOnly: false }
    expect(passesAgentNeedsInputOnly(settings, { source: 'agent-task-complete' })).toBe(true)
  })

  it('holds back an agent finish, stated or not, and nothing else', () => {
    const settings = { agentNeedsInputOnly: true }
    expect(
      passesAgentNeedsInputOnly(settings, { source: 'agent-task-complete', agentState: 'done' })
    ).toBe(false)
    expect(passesAgentNeedsInputOnly(settings, { source: 'agent-task-complete' })).toBe(false)
    expect(
      passesAgentNeedsInputOnly(settings, { source: 'agent-task-complete', agentState: 'blocked' })
    ).toBe(true)
    expect(passesAgentNeedsInputOnly(settings, { source: 'terminal-bell' })).toBe(true)
    expect(passesAgentNeedsInputOnly(settings, { source: 'test' })).toBe(true)
  })
})

describe('isNotificationSourceAllowed', () => {
  const defaults = getDefaultNotificationSettings()

  it('applies the master, per-source and needs-input switches together', () => {
    const waiting = { source: 'agent-task-complete', agentState: 'waiting' } as const
    expect(isNotificationSourceAllowed(defaults, waiting)).toBe(true)
    expect(isNotificationSourceAllowed({ ...defaults, enabled: false }, waiting)).toBe(false)
    expect(isNotificationSourceAllowed({ ...defaults, agentTaskComplete: false }, waiting)).toBe(
      false
    )
    expect(isNotificationSourceAllowed({ ...defaults, agentNeedsInputOnly: true }, waiting)).toBe(
      true
    )
    expect(
      isNotificationSourceAllowed(
        { ...defaults, agentNeedsInputOnly: true },
        { source: 'agent-task-complete', agentState: 'done' }
      )
    ).toBe(false)
    expect(isNotificationSourceAllowed(defaults, { source: 'terminal-bell' })).toBe(
      defaults.terminalBell
    )
  })
})
