import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STATUS_BAR_USAGE_SCOPE,
  normalizeStatusBarUsageScope
} from './status-bar-usage-scope'

describe('normalizeStatusBarUsageScope', () => {
  it('keeps a valid choice', () => {
    expect(
      normalizeStatusBarUsageScope({
        host: { kind: 'environment', environmentId: 'env-dev' },
        allAccounts: true
      })
    ).toEqual({ host: { kind: 'environment', environmentId: 'env-dev' }, allAccounts: true })
    expect(normalizeStatusBarUsageScope({ host: { kind: 'local' } })).toEqual({
      host: { kind: 'local' },
      allAccounts: false
    })
  })

  it('reads anything else as automatic with one chip per provider', () => {
    for (const value of [
      undefined,
      null,
      'local',
      { host: { kind: 'environment', environmentId: ' ' }, allAccounts: 'yes' },
      { host: { kind: 'server' } }
    ]) {
      expect(normalizeStatusBarUsageScope(value)).toEqual(DEFAULT_STATUS_BAR_USAGE_SCOPE)
    }
  })
})
