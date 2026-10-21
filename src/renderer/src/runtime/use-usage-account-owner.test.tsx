// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StatusBarUsageHost } from '../../../shared/status-bar-usage-scope'

const state: {
  statusBarUsageScope: { host: StatusBarUsageHost; allAccounts: boolean }
  runtimeEnvironments: { id: string; orcadDeployment?: { kind: 'wsl'; distro: string } }[]
} = {
  statusBarUsageScope: { host: { kind: 'auto' }, allAccounts: false },
  runtimeEnvironments: [
    { id: 'env-dev' },
    { id: 'env-wsl', orcadDeployment: { kind: 'wsl', distro: 'Ubuntu' } }
  ]
}

vi.mock('@/store', () => ({
  useAppStore: (selector: (value: typeof state) => unknown) => selector(state)
}))
// The focused workspace lives on env-dev.
vi.mock('@/lib/resolved-worktree-execution-host', () => ({
  getActiveWorkspaceOwnerTarget: () => ({ kind: 'environment', environmentId: 'env-dev' })
}))

const { useUsageAccountOwner } = await import('./use-worktree-runtime-target')

function ownerFor(host: StatusBarUsageHost) {
  state.statusBarUsageScope = { host, allAccounts: false }
  return renderHook(() => useUsageAccountOwner({ kind: 'local' })).result.current
}

afterEach(() => {
  state.statusBarUsageScope = { host: { kind: 'auto' }, allAccounts: false }
})

describe('useUsageAccountOwner', () => {
  it('follows the focused workspace unless a host is chosen', () => {
    expect(ownerFor({ kind: 'auto' })).toEqual({
      target: { kind: 'environment', environmentId: 'env-dev' },
      wslHostDistro: null
    })
    expect(ownerFor({ kind: 'local' })).toEqual({ target: { kind: 'local' }, wslHostDistro: null })
  })

  it('reads a chosen server, this desktop for a WSL host, and the focused owner once unpaired', () => {
    expect(ownerFor({ kind: 'environment', environmentId: 'env-wsl' })).toEqual({
      target: { kind: 'local' },
      wslHostDistro: 'Ubuntu'
    })
    expect(ownerFor({ kind: 'environment', environmentId: 'env-gone' })).toEqual({
      target: { kind: 'environment', environmentId: 'env-dev' },
      wslHostDistro: null
    })
  })
})
