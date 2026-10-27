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
  startBuildWebImageBuild,
  startBuildWebImageGroupBuild
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

  it('asks for the distribution chosen, passes the console’s note, and drops the catalog', async () => {
    const note = 'собирается только rhel: redos выводится из него при публикации (просили «both»)'
    mocks.request.mockResolvedValueOnce({ id: 'run-9', note }).mockResolvedValueOnce({ ok: true })
    const result = await startBuildWebImageBuild({
      image: 'dc/ib-api-server',
      branch: 'dc-release-3.1',
      dist: 'both'
    })
    expect(result).toEqual({ ok: true, value: { runId: 'run-9', note } })
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
    // Why both: the console itself folds the monorepo's redos into rhel and says so in `note`.
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

  it('builds a Chat Platform image from chat-platform’s branch, and lists its version branches', async () => {
    mocks.request.mockResolvedValueOnce({ id: 'run-3' }).mockResolvedValueOnce({ ok: true })
    await startBuildWebImageBuild({
      image: 'chatplatform/agent-manager',
      branch: 'master',
      dist: 'rhel'
    })
    expect(mocks.request.mock.calls[0][0].body).toMatchObject({ repo: 'chat-platform' })
    mocks.request.mockResolvedValueOnce({ id: 'run-4' }).mockResolvedValueOnce({ ok: true })
    await startBuildWebImageBuild({ image: 'dc/x', branch: 'master', dist: 'rhel' })
    expect(mocks.request.mock.calls[2][0].body).not.toHaveProperty('repo')

    mocks.request.mockResolvedValueOnce({ branches: ['master', 'version-2.5', 'version-2.6'] })
    expect(await listBuildWebVersionBranches('cp')).toEqual([
      'version-2.6',
      'version-2.5',
      'master'
    ])
    expect(mocks.request.mock.calls[4][0].path).toBe('/api/tms/versions/branches?product=cp')
  })

  it('asks for a build without tests only when told to', async () => {
    mocks.request.mockResolvedValueOnce({ id: 'run-1' }).mockResolvedValueOnce({ ok: true })
    await startBuildWebImageBuild({
      image: 'sa/api',
      branch: 'master',
      dist: 'rhel',
      skipTests: true
    })
    expect(mocks.request.mock.calls[1][0].body).toEqual({
      combos: [{ image: 'sa/api', dist: 'rhel', branch: 'master' }],
      skipTests: true
    })
    mocks.request.mockResolvedValueOnce({ id: 'run-2' }).mockResolvedValueOnce({ ok: true })
    await startBuildWebImageBuild({ image: 'sa/api', branch: 'master', dist: 'rhel' })
    expect(mocks.request.mock.calls[3][0].body).not.toHaveProperty('skipTests')
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

  it('reads a test job log from its own route, piece after piece to its size', async () => {
    const url = 'https://bw.test/api/tests/runs/r1/jobs/j1/log'
    mocks.request.mockResolvedValueOnce({ offset: 1024, size: 1500, text: 'a'.repeat(1024) })
    expect(await readBuildWebBuildLog(url, 0)).toMatchObject({ next: 1024, done: false })
    expect(mocks.request.mock.calls[0][0].path).toBe('/api/tests/runs/r1/jobs/j1/log?offset=0')
    mocks.request.mockResolvedValueOnce({ offset: 1500, size: 1500, text: 'end' })
    expect(await readBuildWebBuildLog(url, 1024)).toEqual({ text: 'end', next: 1500, done: true })
  })
})

describe('a group build from Images', () => {
  it('builds the picked images as one run on the chosen version, each for both dists', async () => {
    mocks.request.mockResolvedValueOnce({ id: 'run-1' }).mockResolvedValueOnce({})
    const result = await startBuildWebImageGroupBuild({
      images: ['ap/ui', 'ap/oauth', 'ap/ui'],
      branch: 'ap-release-1.16',
      dist: 'both'
    })
    expect(result).toEqual({ ok: true, value: { runId: 'run-1' } })
    const [made, started] = mocks.request.mock.calls.map(([r]) => r)
    expect(made).toMatchObject({
      path: '/api/runs',
      body: { branch: 'ap-release-1.16', images: ['ap/ui', 'ap/oauth'], distType: 'both' }
    })
    expect(started).toMatchObject({
      path: '/api/runs/run-1/builds',
      body: {
        combos: [
          { image: 'ap/ui', dist: 'rhel', branch: 'ap-release-1.16' },
          { image: 'ap/ui', dist: 'redos', branch: 'ap-release-1.16' },
          { image: 'ap/oauth', dist: 'rhel', branch: 'ap-release-1.16' },
          { image: 'ap/oauth', dist: 'redos', branch: 'ap-release-1.16' }
        ]
      }
    })
    expect(mocks.invalidate).toHaveBeenCalledOnce()
  })

  it('refuses the monorepo’s and Chat Platform’s images together, asking nothing', async () => {
    const result = await startBuildWebImageGroupBuild({
      images: ['ap/ui', 'chatplatform/gateway'],
      branch: 'master',
      dist: 'rhel'
    })
    expect(result.ok).toBe(false)
    expect(mocks.request).not.toHaveBeenCalled()
  })
})
