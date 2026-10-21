import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BUILD_WEB_ISSUE_FAVORITE_SORT_RUNTIME_CAPABILITY } from '../../../../shared/build-web-capability'

const rpc = vi.hoisted(() => ({
  supported: new Set<string>(),
  call: vi.fn(async () => ({ issues: [], total: 0 }))
}))
vi.mock('@/runtime/runtime-rpc-client', () => ({
  assertRuntimeEnvironmentCapability: async (_id: string, capability: string, message: string) => {
    if (!rpc.supported.has(capability)) {
      throw new Error(message)
    }
  },
  callRuntimeRpc: rpc.call
}))

import { callBuildWeb } from './build-web-client'

const server = { kind: 'environment', environmentId: 'srv' } as const

describe('callBuildWeb', () => {
  beforeEach(() => {
    rpc.supported = new Set(['build-web.v1'])
    rpc.call.mockClear()
  })

  it('asks a server for the favorites sort before sending it, which an older one refuses', async () => {
    await expect(
      callBuildWeb(server, 'listIssues', { view: 'all', sort: 'favorite', dir: 'asc' })
    ).rejects.toThrow('cannot sort tasks by favorites')
    expect(rpc.call).not.toHaveBeenCalled()

    await callBuildWeb(server, 'listIssues', { view: 'all', sort: 'updated_at', dir: 'desc' })
    expect(rpc.call).toHaveBeenCalledTimes(1)

    rpc.supported.add(BUILD_WEB_ISSUE_FAVORITE_SORT_RUNTIME_CAPABILITY)
    await callBuildWeb(server, 'listIssues', { view: 'all', sort: 'favorite', dir: 'asc' })
    expect(rpc.call).toHaveBeenLastCalledWith(
      server,
      'buildWeb.listIssues',
      { view: 'all', sort: 'favorite', dir: 'asc' },
      expect.anything()
    )
  })
})
