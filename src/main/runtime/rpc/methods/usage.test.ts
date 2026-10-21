import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { installUsageStores, type UsageHostStore } from '../../../usage/installed-usage-stores'
import { eraseRpcMethods, isStreamingMethod } from '../core'
import { USAGE_METHODS } from './usage'

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the usage handlers never read the runtime.
const runtime = {} as unknown as OrcaRuntimeService

function call(name: string, params: unknown): Promise<unknown> {
  const found = eraseRpcMethods(USAGE_METHODS).find((candidate) => candidate.name === name)
  if (!found || isStreamingMethod(found)) {
    throw new Error(`Missing request method ${name}`)
  }
  return Promise.resolve(found.handler(params, { runtime }))
}

function fakeStore(enabled: boolean) {
  const scanState = { enabled, isScanning: false }
  const store = {
    whenLoaded: vi.fn(async () => {}),
    getScanState: vi.fn(() => scanState),
    setEnabled: vi.fn(async (next: boolean) => {
      scanState.enabled = next
      return scanState
    }),
    refresh: vi.fn(async () => scanState),
    getSnapshot: vi.fn(() => ({ scanState, summary: { sessions: 3 } }))
  } satisfies UsageHostStore
  return store
}

function install(stores: Partial<Record<'claude' | 'codex', UsageHostStore>>): void {
  const idle = fakeStore(false)
  installUsageStores({ claude: idle, codex: idle, opencode: idle, muse: idle, ...stores })
}

afterEach(() => {
  installUsageStores(null)
})

describe('usage RPC methods', () => {
  it('answers null on a host without usage stores', async () => {
    await expect(
      call('usage.snapshot', { provider: 'claude', scope: 'all', range: '30d' })
    ).resolves.toBeNull()
    await expect(call('usage.refresh', { provider: 'claude' })).resolves.toBeNull()
  })

  it('reads the asked agent once its persisted state has loaded', async () => {
    const codex = fakeStore(true)
    install({ codex })

    await expect(
      call('usage.snapshot', { provider: 'codex', scope: 'orca', range: '7d', limit: 5 })
    ).resolves.toMatchObject({ summary: { sessions: 3 } })
    expect(codex.whenLoaded).toHaveBeenCalled()
    expect(codex.getSnapshot).toHaveBeenCalledWith('orca', '7d', 5)
  })

  it('turns tracking on before refreshing, as the asking client has it on', async () => {
    const claude = fakeStore(false)
    install({ claude })

    await expect(call('usage.refresh', { provider: 'claude', force: true })).resolves.toEqual({
      enabled: true,
      isScanning: false
    })
    expect(claude.setEnabled).toHaveBeenCalledWith(true)
    expect(claude.refresh).toHaveBeenCalledWith(true)
  })
})
