import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RequestModule from './build-web-request'

const mocks = vi.hoisted(() => ({
  request: vi.fn<(request: { path: string }) => Promise<unknown>>()
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
