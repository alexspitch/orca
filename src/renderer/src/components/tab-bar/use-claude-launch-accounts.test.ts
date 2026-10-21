import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

const { claudeLaunchAccountsOf } = await import('./use-claude-launch-accounts')

const account = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  email: `${id}@box.test`,
  authMethod: 'subscription-oauth' as const,
  createdAt: 0,
  updatedAt: 0,
  lastAuthenticatedAt: 0,
  ...over
})

describe('the Claude accounts a new tab offers', () => {
  it('lists every host account but the one a plain launch runs, by its label', () => {
    const offered = claudeLaunchAccountsOf({
      accounts: [
        account('a'),
        account('b', { label: 'Work' }),
        account('w', { managedAuthRuntime: 'wsl' })
      ],
      activeAccountId: 'a',
      activeAccountIdsByRuntime: { host: 'a', wsl: {} }
    })
    expect(offered).toEqual([{ id: 'b', label: 'Work' }])
  })

  it('lists them all while System default runs plain launches', () => {
    const offered = claudeLaunchAccountsOf({
      accounts: [account('a'), account('b')],
      activeAccountId: null
    })
    expect(offered.map((a) => a.label)).toEqual(['a@box.test', 'b@box.test'])
  })
})
