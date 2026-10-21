import { describe, expect, it, vi } from 'vitest'
import type { ClaudeManagedAccountSummary } from '../../../../shared/managed-account-types'
import type { InactiveAccountUsage, ProviderRateLimits } from '../../../../shared/rate-limit-types'
import type { UsageChipAccounts } from './status-bar-account-chips'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

const { buildUsageChips } = await import('./status-bar-account-chips')

function limits(provider: ProviderRateLimits['provider'], used: number): ProviderRateLimits {
  return {
    provider,
    session: { usedPercent: used, windowMinutes: 300, resetsAt: null, resetDescription: null },
    weekly: null,
    updatedAt: 1,
    error: null,
    status: 'ok'
  }
}

function inactive(accountId: string, rateLimits: ProviderRateLimits | null): InactiveAccountUsage {
  return { accountId, rateLimits, updatedAt: 1, isFetching: rateLimits === null }
}

function claudeAccount(id: string, email: string, label?: string): ClaudeManagedAccountSummary {
  return {
    id,
    email,
    label,
    authMethod: 'subscription-oauth',
    createdAt: 0,
    updatedAt: 0,
    lastAuthenticatedAt: 0
  }
}

const ACCOUNTS: UsageChipAccounts = {
  claude: {
    accounts: [
      claudeAccount('work', 'me@work.example', 'Work'),
      claudeAccount('home', 'me.home@example.com'),
      claudeAccount('pending', 'new@example.com')
    ],
    activeAccountId: 'work',
    activeAccountIdsByRuntime: { host: 'work', wsl: {} }
  },
  codex: { accounts: [], activeAccountId: null }
}
const RATE_LIMITS = {
  claudeTarget: { runtime: 'host' as const, wslDistro: null },
  codexTarget: { runtime: 'host' as const, wslDistro: null },
  inactiveClaudeAccounts: [
    inactive('home', limits('claude', 40)),
    inactive('pending', null),
    inactive('removed', limits('claude', 10))
  ],
  inactiveCodexAccounts: []
}
const ROSTER = [limits('claude', 70), limits('codex', 20), limits('gemini', 5)]

describe('buildUsageChips', () => {
  it('keeps one chip per provider unless every account is asked for', () => {
    const chips = buildUsageChips(ROSTER, {
      allAccounts: false,
      accounts: ACCOUNTS,
      rateLimits: RATE_LIMITS,
      stale: false
    })
    expect(chips.map((chip) => [chip.key, chip.accountLabel])).toEqual([
      ['claude', null],
      ['codex', null],
      ['gemini', null]
    ])
  })

  it('gives every account on the host its own named chip, the active one first', () => {
    const chips = buildUsageChips(ROSTER, {
      allAccounts: true,
      accounts: ACCOUNTS,
      rateLimits: RATE_LIMITS,
      stale: false
    })
    expect(chips.map((chip) => [chip.key, chip.accountLabel, chip.p.status])).toEqual([
      ['claude', 'Work', 'ok'],
      ['claude:home', 'me.home', 'ok'],
      ['claude:pending', 'new', 'fetching'],
      // System default holds Codex here, and no Codex account is saved.
      ['codex', 'default', 'ok'],
      ['gemini', null, 'ok']
    ])
  })

  it('marks an unreachable host’s accounts stale and drops ones it never read', () => {
    const chips = buildUsageChips(ROSTER.slice(0, 1), {
      allAccounts: true,
      accounts: ACCOUNTS,
      rateLimits: RATE_LIMITS,
      stale: true
    })
    expect(chips.map((chip) => [chip.key, chip.p.status])).toEqual([
      ['claude', 'ok'],
      ['claude:home', 'error']
    ])
  })

  it('names no accounts while a server’s rosters have not arrived', () => {
    const chips = buildUsageChips(ROSTER.slice(0, 1), {
      allAccounts: true,
      accounts: null,
      rateLimits: RATE_LIMITS,
      stale: false
    })
    expect(chips).toEqual([{ key: 'claude', p: ROSTER[0], accountLabel: null }])
  })
})
