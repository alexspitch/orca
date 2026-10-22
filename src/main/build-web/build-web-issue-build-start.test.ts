import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RequestModule from './build-web-request'

const mocks = vi.hoisted(() => ({
  request: vi.fn<(request: { method?: string; path: string; body?: unknown }) => Promise<unknown>>()
}))

vi.mock('./build-web-connection', () => ({
  requireBuildWebCredential: () => ({ baseUrl: 'https://bw.test', token: 't', generation: 1 })
}))
vi.mock('./build-web-request', async (importOriginal) => ({
  ...(await importOriginal<typeof RequestModule>()),
  buildWebRequest: mocks.request
}))

const { detectBuildWebImages, fetchBuildWebRepo, listBuildWebBranches, listBuildWebImageNames } =
  await import('./build-web-issue-build-start')

beforeEach(() => {
  mocks.request.mockReset()
  mocks.request.mockResolvedValue({ images: [], branches: [] })
})

describe('a Chat Platform task’s build', () => {
  it('reads chat-platform’s images, branches and changes', async () => {
    await listBuildWebImageNames('chat-platform')
    await listBuildWebBranches('chat-platform')
    await detectBuildWebImages('master', 'CPDEV-12', 'chat-platform')
    await fetchBuildWebRepo('chat-platform')
    expect(mocks.request.mock.calls.map(([r]) => [r.path, r.body])).toEqual([
      ['/api/images?repo=chat-platform', undefined],
      ['/api/branches?repo=chat-platform', undefined],
      ['/api/detect', { branch: 'master', ticket: 'CPDEV-12', repo: 'chat-platform' }],
      ['/api/fetch', { repo: 'chat-platform' }]
    ])
  })

  it('asks the monorepo as before, naming no repository', async () => {
    await listBuildWebImageNames()
    await listBuildWebBranches()
    await detectBuildWebImages('master', 'IS-1')
    await fetchBuildWebRepo()
    expect(mocks.request.mock.calls.map(([r]) => [r.path, r.body])).toEqual([
      ['/api/images', undefined],
      ['/api/branches', undefined],
      ['/api/detect', { branch: 'master', ticket: 'IS-1' }],
      ['/api/fetch', undefined]
    ])
  })
})
