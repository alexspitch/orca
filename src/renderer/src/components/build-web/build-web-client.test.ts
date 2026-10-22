import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BUILD_WEB_ISSUE_ARCHIVE_RUNTIME_CAPABILITY,
  BUILD_WEB_ISSUE_FAVORITE_SORT_RUNTIME_CAPABILITY,
  BUILD_WEB_PRODUCT_CP_RUNTIME_CAPABILITY
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

import { callBuildWeb, namesChatPlatform } from './build-web-client'

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

  it('asks a server for Chat Platform before naming product cp or its repository', async () => {
    await expect(
      callBuildWeb(server, 'listIssues', { view: 'all', product: ['cp'] })
    ).rejects.toThrow('does not know Chat Platform')
    await expect(callBuildWeb(server, 'branches', { repo: 'chat-platform' })).rejects.toThrow(
      'does not know Chat Platform'
    )
    expect(rpc.call).not.toHaveBeenCalled()
    await callBuildWeb(server, 'branches', {})
    expect(rpc.call).toHaveBeenCalledTimes(1)

    rpc.supported.add(BUILD_WEB_PRODUCT_CP_RUNTIME_CAPABILITY)
    await callBuildWeb(server, 'listIssues', { view: 'all', product: ['cp'] })
    expect(rpc.call).toHaveBeenCalledTimes(2)
  })
})

describe('namesChatPlatform', () => {
  it('sees cp as a product, a filter, a task’s new product, or the repository', () => {
    expect(namesChatPlatform({ product: 'cp' })).toBe(true)
    expect(namesChatPlatform({ product: ['sa', 'cp'] })).toBe(true)
    expect(namesChatPlatform({ id: 'i', patch: { product: 'cp' } })).toBe(true)
    expect(namesChatPlatform({ repo: 'chat-platform' })).toBe(true)
    expect(namesChatPlatform({ product: ['sa'], patch: { product: 'dc' } })).toBe(false)
    expect(namesChatPlatform(undefined)).toBe(false)
  })
})
