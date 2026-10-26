import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RequestModule from './build-web-request'

const mocks = vi.hoisted(() => ({
  request: vi.fn<(request: { path: string; body?: unknown }) => Promise<unknown>>()
}))

vi.mock('./build-web-connection', () => ({
  requireBuildWebCredential: () => ({ baseUrl: 'https://bw.test', token: 't', generation: 1 })
}))
vi.mock('./credential-store', () => ({
  getBuildWebCredentialGeneration: () => 1,
  getStoredBuildWebMetadata: () => ({ baseUrl: 'https://bw.test' })
}))
vi.mock('./build-web-request', async (importOriginal) => ({
  ...(await importOriginal<typeof RequestModule>()),
  buildWebRequest: mocks.request
}))

const { buildWebImageSummary } = await import('./build-web-images')
const { BuildWebApiError } = await import('./build-web-request')

beforeEach(() => mocks.request.mockReset())

describe('the Images badge', () => {
  it('reads the console’s own summary, not the whole catalog', async () => {
    mocks.request.mockResolvedValue({ running: 3, failed: 1 })
    expect(await buildWebImageSummary()).toEqual({ running: 3, failed: 1 })
    expect(mocks.request.mock.calls.map(([r]) => r.path)).toEqual(['/api/image-builds/summary'])
  })

  it('counts from the catalog on a console without the summary, and stops asking it', async () => {
    mocks.request.mockImplementation(async (request) => {
      if (request?.path === '/api/image-builds/summary') {
        throw new BuildWebApiError('Not Found', 404, [], true)
      }
      return { images: [], builds: [] }
    })
    expect(await buildWebImageSummary()).toEqual({ running: 0, failed: 0 })
    await buildWebImageSummary()
    expect(mocks.request.mock.calls.map(([r]) => r.path)).toEqual([
      '/api/image-builds/summary',
      '/api/image-builds'
    ])
  })
})

describe('whether a version’s images hold its latest changes', () => {
  const build = (branch: string, version: string, image = 'ap/ui') => ({
    image,
    dist: 'rhel',
    branch,
    number: 1,
    status: 'success',
    product: 'ap',
    product_version: version,
    run_id: 'r1'
  })

  it('takes the version’s release branch, never a task branch, and master only without one', async () => {
    const { versionBranchOf } = await import('./build-web-images')
    const builds = [
      build('AP-1234-fix', '1.16'),
      build('AP-1234-fix', '1.16'),
      build('origin/ap-release-1.16', '1.16'),
      build('master', '1.17')
    ]
    expect(versionBranchOf(builds, 'ap', '1.16')).toBe('ap-release-1.16')
    expect(versionBranchOf(builds, 'ap', '1.17')).toBe('master')
    expect(versionBranchOf(builds, 'ap', '1.15')).toBeNull()
  })

  it('scans that branch once for a while, again on force and after the catalog changes', async () => {
    const { scanBuildWebImageFreshness, invalidateBuildWebImageCatalog } =
      await import('./build-web-images')
    invalidateBuildWebImageCatalog()
    mocks.request.mockImplementation(async (request) =>
      request?.path === '/api/sync-scan'
        ? {
            images: ['ap/ui', 'constructor'],
            image_sources: { 'ap/ui': ['applications/ap-ui'] },
            up_to_date: ['ap/oauth'],
            never_built: ['ap/new']
          }
        : { images: [], builds: [build('ap-release-1.16', '1.16')] }
    )
    const args = { product: 'ap', version: '1.16', dist: 'rhel' as const }
    expect(await scanBuildWebImageFreshness(args)).toEqual({
      branch: 'ap-release-1.16',
      rebuild: { 'ap/ui': ['applications/ap-ui'], constructor: [] },
      current: ['ap/oauth'],
      neverBuilt: ['ap/new']
    })
    const scans = () =>
      mocks.request.mock.calls.filter(([r]) => r?.path === '/api/sync-scan').map(([r]) => r.body)
    await scanBuildWebImageFreshness(args)
    expect(scans()).toEqual([{ branch: 'ap-release-1.16', dist: 'rhel' }])
    await scanBuildWebImageFreshness({ ...args, force: true })
    invalidateBuildWebImageCatalog()
    await scanBuildWebImageFreshness(args)
    expect(scans()).toHaveLength(3)
  })
})
