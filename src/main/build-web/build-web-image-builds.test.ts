import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RequestModule from './build-web-request'

// Building one image from Images: a run on the chosen branch, then its builds at once.

const mocks = vi.hoisted(() => ({
  request:
    vi.fn<(request: { method?: string; path: string; body?: unknown }) => Promise<unknown>>(),
  invalidate: vi.fn()
}))

vi.mock('./build-web-connection', () => ({
  requireBuildWebCredential: () => ({ baseUrl: 'https://bw.test', token: 't', generation: 1 })
}))
vi.mock('./build-web-images', () => ({ invalidateBuildWebImageCatalog: mocks.invalidate }))
vi.mock('./build-web-request', async (importOriginal) => ({
  ...(await importOriginal<typeof RequestModule>()),
  buildWebRequest: mocks.request
}))

const {
  getBuildWebRun,
  listBuildWebVersionBranches,
  readBuildWebBuildLog,
  startBuildWebImageBuild
} = await import('./build-web-image-builds')

beforeEach(() => {
  mocks.request.mockReset()
  mocks.invalidate.mockReset()
})

describe('image builds', () => {
  it('offers the newest release first and master last; a product with no releases only master', async () => {
    mocks.request.mockResolvedValueOnce({
      branches: ['master', 'dc-release-3.1', 'dc-release-3.10', 'dc-release-3.2']
    })
    expect(await listBuildWebVersionBranches('dc')).toEqual([
      'dc-release-3.10',
      'dc-release-3.2',
      'dc-release-3.1',
      'master'
    ])
    expect(await listBuildWebVersionBranches('other')).toEqual(['master'])
    expect(mocks.request).toHaveBeenCalledTimes(1)
  })

  it('makes the run, starts one build per distribution, and drops the image catalog', async () => {
    mocks.request.mockResolvedValueOnce({ id: 'run-9' }).mockResolvedValueOnce({ ok: true })
    const result = await startBuildWebImageBuild({
      image: 'dc/ib-api-server',
      branch: 'dc-release-3.1',
      dist: 'both'
    })
    expect(result).toEqual({ ok: true, value: { runId: 'run-9' } })
    expect(mocks.request.mock.calls[0][0]).toMatchObject({
      method: 'POST',
      path: '/api/runs',
      body: {
        branch: 'dc-release-3.1',
        images: ['dc/ib-api-server'],
        distType: 'both',
        ticket: null
      }
    })
    expect(mocks.request.mock.calls[1][0]).toMatchObject({
      path: '/api/runs/run-9/builds',
      body: {
        combos: [
          { image: 'dc/ib-api-server', dist: 'rhel', branch: 'dc-release-3.1' },
          { image: 'dc/ib-api-server', dist: 'redos', branch: 'dc-release-3.1' }
        ]
      }
    })
    expect(mocks.invalidate).toHaveBeenCalled()
  })

  it('reads a run with log links on the console', async () => {
    mocks.request.mockResolvedValueOnce({
      id: 'run-9',
      builds: [
        {
          image: 'dc/x',
          dist_type: 'rhel',
          status: 'building',
          build_url: '/api/local-builds/7/log'
        }
      ]
    })
    const run = await getBuildWebRun('run-9')
    expect(run?.builds[0]).toMatchObject({
      status: 'building',
      url: 'https://bw.test/api/local-builds/7/log'
    })
  })

  it('reads a log from the offset, sending the console its own log path', async () => {
    mocks.request.mockResolvedValueOnce({ text: 'step 1\n', next: 7, done: false })
    const piece = await readBuildWebBuildLog('https://bw.test/api/local-builds/7/log', 0)
    expect(piece).toEqual({ text: 'step 1\n', next: 7, done: false })
    expect(mocks.request.mock.calls[0][0].path).toBe(
      '/api/build-log?url=%2Fapi%2Flocal-builds%2F7%2Flog&offset=0'
    )
    mocks.request.mockResolvedValueOnce({ text: '', next: 9, done: true })
    await readBuildWebBuildLog('https://jenkins.test/job/x/12/', 9)
    expect(mocks.request.mock.calls[1][0].path).toContain(
      encodeURIComponent('https://jenkins.test/job/x/12/')
    )
  })
})
