import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BUILD_WEB_ISSUE_ARCHIVE_RUNTIME_CAPABILITY,
  BUILD_WEB_ISSUE_FAVORITE_SORT_RUNTIME_CAPABILITY
} from '../../../../shared/build-web-capability'

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

  it('asks a server for the archive before archiving or listing it, which an older one drops', async () => {
    await expect(callBuildWeb(server, 'archiveIssue', { id: 'i1' })).rejects.toThrow(
      'cannot archive tasks'
    )
    await expect(
      callBuildWeb(server, 'listIssues', { view: 'all', archived: true })
    ).rejects.toThrow('cannot list the archive')
    expect(rpc.call).not.toHaveBeenCalled()

    rpc.supported.add(BUILD_WEB_ISSUE_ARCHIVE_RUNTIME_CAPABILITY)
    await callBuildWeb(server, 'restoreIssue', { id: 'i1' })
    expect(rpc.call).toHaveBeenLastCalledWith(
      server,
      'buildWeb.restoreIssue',
      { id: 'i1' },
      expect.anything()
    )
  })
})
