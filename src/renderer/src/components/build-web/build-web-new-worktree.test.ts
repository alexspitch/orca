import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getState } = vi.hoisted(() => ({ getState: vi.fn() }))

vi.mock('@/store', () => ({ useAppStore: { getState } }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('@/lib/ensure-hooks-confirmed', () => ({ ensureHooksConfirmed: vi.fn(async () => 'run') }))
vi.mock('@/lib/launch-work-item-direct-preflight', () => ({
  resolveDirectLaunchOwnerRow: () => ({
    repo: { id: 'repo-1' },
    executionHostId: 'runtime:station',
    target: { kind: 'environment', environmentId: 'station' }
  }),
  resolveDirectSetupDecision: async () => ({ kind: 'decided', decision: 'skip' })
}))

import { createBatchWorktree } from './build-web-new-worktree'

describe('createBatchWorktree', () => {
  beforeEach(() => getState.mockReset())

  it('returns the store record under the client host, not the server view of itself', async () => {
    const created = { id: 'repo-1::/srv/is-164', hostId: 'local', path: '/srv/is-164' }
    const known = { ...created, hostId: 'runtime:station' }
    getState.mockReturnValue({
      repos: [],
      createWorktree: vi.fn(async () => ({ worktree: created })),
      getKnownWorktreeById: (id: string, hostId?: string) =>
        id === created.id && hostId === 'runtime:station' ? known : undefined
    })

    const worktree = await createBatchWorktree({
      repoId: 'repo-1',
      name: 'is-164',
      baseBranch: 'origin/master'
    })

    expect(worktree?.hostId).toBe('runtime:station')
  })
})
