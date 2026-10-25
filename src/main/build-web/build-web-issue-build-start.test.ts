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

const {
  detectBuildWebImages,
  fetchBuildWebRepo,
  listBuildWebBranches,
  listBuildWebImageNames,
  listBuildWebIssueBuildBranches
} = await import('./build-web-issue-build-start')
const { BuildWebApiError } = await import('./build-web-request')

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

describe('the versions a task’s build reaches', () => {
  it('reads each branch as the console lists it', async () => {
    mocks.request.mockResolvedValue({
      branches: [
        {
          branch: 'dc-release-3.0',
          primary: true,
          has_commits: true,
          on_run: true,
          excluded: false
        },
        {
          branch: 'dc-release-3.1',
          primary: false,
          has_commits: true,
          on_run: false,
          excluded: true
        },
        { branch: '', primary: false }
      ]
    })
    expect(await listBuildWebIssueBuildBranches('i 1')).toEqual([
      { branch: 'dc-release-3.0', primary: true, has_commits: true, on_run: true, excluded: false },
      { branch: 'dc-release-3.1', primary: false, has_commits: true, on_run: false, excluded: true }
    ])
    expect(mocks.request.mock.calls[0][0].path).toBe('/api/tms/issues/i%201/build-branches')
  })

  it('is null from a console without the route, so the form keeps its old behaviour', async () => {
    mocks.request.mockRejectedValue(new BuildWebApiError('Not Found', 404, [], true))
    expect(await listBuildWebIssueBuildBranches('i1')).toBeNull()
  })
})
