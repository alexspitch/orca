import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClaudeUsageSnapshot } from '../../../../../shared/claude-usage-types'
import { CLAUDE_USAGE_MERGE_OPS } from './usage-provider-merge-ops'

const { callRuntimeRpc } = vi.hoisted(() => ({ callRuntimeRpc: vi.fn() }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc }))

import { resolveUsageHostApi, type UsageHostApi } from './usage-host-api'

const SCAN = {
  enabled: true,
  isScanning: false,
  lastScanStartedAt: null,
  lastScanCompletedAt: 1,
  lastScanError: null
}

function claudeSnapshot(sessions: number): ClaudeUsageSnapshot {
  const empty = CLAUDE_USAGE_MERGE_OPS.empty('all', '30d', SCAN)
  return { ...empty, summary: { ...empty.summary, sessions } }
}

function localApi(): UsageHostApi<ClaudeUsageSnapshot> {
  return {
    getScanState: vi.fn(async () => ({ ...SCAN, hasAnyClaudeData: true })),
    setEnabled: vi.fn(async () => ({ ...SCAN, hasAnyClaudeData: true })),
    refresh: vi.fn(async () => ({ ...SCAN, hasAnyClaudeData: true })),
    getSnapshot: vi.fn(async () => claudeSnapshot(1))
  }
}

const SERVERS = [
  { id: 'env-dev', label: 'dev' },
  { id: 'env-srv', label: 'srv-10-99' }
]
const ARGS = { scope: 'all', range: '30d' } as const

beforeEach(() => {
  callRuntimeRpc.mockReset()
})

describe('resolveUsageHostApi', () => {
  it('reads this machine alone through its own IPC', () => {
    const local = localApi()
    expect(
      resolveUsageHostApi('claude', local, CLAUDE_USAGE_MERGE_OPS, { kind: 'local' }, SERVERS)
    ).toBe(local)
  })

  it('reads one server over its runtime and keeps this machine’s switch', async () => {
    callRuntimeRpc.mockResolvedValue(claudeSnapshot(4))
    const local = localApi()
    const api = resolveUsageHostApi(
      'claude',
      local,
      CLAUDE_USAGE_MERGE_OPS,
      { kind: 'server', environmentId: 'env-dev', label: 'dev' },
      SERVERS
    )

    const snapshot = await api.getSnapshot(ARGS)
    expect(snapshot.summary.sessions).toBe(4)
    expect(local.getSnapshot).not.toHaveBeenCalled()
    expect(callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-dev' },
      'usage.snapshot',
      { provider: 'claude', scope: 'all', range: '30d', limit: 10 },
      expect.objectContaining({ reuseRecentCompatibilityFailure: true })
    )

    await api.refresh({ force: true })
    expect(local.refresh).not.toHaveBeenCalled()
    expect(callRuntimeRpc).toHaveBeenLastCalledWith(
      { kind: 'environment', environmentId: 'env-dev' },
      'usage.refresh',
      { provider: 'claude', force: true },
      expect.anything()
    )
  })

  it('adds this machine and every server up, naming a server too old to answer', async () => {
    callRuntimeRpc.mockImplementation(async (target: { environmentId: string }) => {
      if (target.environmentId === 'env-srv') {
        throw Object.assign(new Error('Unknown method'), { code: 'method_not_found' })
      }
      return claudeSnapshot(4)
    })
    const local = localApi()
    const api = resolveUsageHostApi(
      'claude',
      local,
      CLAUDE_USAGE_MERGE_OPS,
      { kind: 'all' },
      SERVERS
    )

    const snapshot = await api.getSnapshot(ARGS)
    expect(snapshot.summary.sessions).toBe(5)
    expect(snapshot.scanState.lastScanError).toBe('srv-10-99: update Orca there to see its usage')

    await api.refresh()
    expect(local.refresh).toHaveBeenCalled()
  })
})
