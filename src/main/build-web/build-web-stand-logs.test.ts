import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RequestModule from './build-web-request'

const mocks = vi.hoisted(() => ({
  stream: vi.fn<(request: { path: string }) => Promise<Response>>()
}))

vi.mock('./build-web-connection', () => ({
  requireBuildWebCredential: () => ({ baseUrl: 'https://bw.test', token: 't', generation: 1 })
}))
vi.mock('./build-web-request', async (importOriginal) => ({
  ...(await importOriginal<typeof RequestModule>()),
  buildWebStreamRequest: mocks.stream
}))

const { readBuildWebStandLogs, startBuildWebStandLogs, stopBuildWebStandLogs } =
  await import('./build-web-stand-logs')

beforeEach(() => mocks.stream.mockReset())

describe('a service log', () => {
  it('asks for the tail and the follow of that service, its names encoded', async () => {
    mocks.stream.mockResolvedValue(
      new Response('line\n', { headers: { 'content-type': 'text/plain; charset=utf-8' } })
    )
    const started = await startBuildWebStandLogs({
      standId: 'id 1',
      service: 'sa-backend',
      tail: 2000,
      follow: true
    })
    expect(mocks.stream.mock.calls[0][0].path).toBe(
      '/api/stands/id%201/services/sa-backend/logs?tail=2000&follow=1'
    )
    expect(started.ok).toBe(true)
    const streamId = started.ok ? started.value.streamId : ''
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(readBuildWebStandLogs({ streamId, offset: 0 })).toMatchObject({
      text: 'line\n',
      done: true
    })
    expect(stopBuildWebStandLogs({ streamId })).toBe(true)
    expect(() => readBuildWebStandLogs({ streamId, offset: 0 })).toThrow(/gone/)
  })

  it('takes a web page from an older build-web for a missing route', async () => {
    mocks.stream.mockResolvedValue(
      new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
    )
    const started = await startBuildWebStandLogs({
      standId: 's',
      service: 'x',
      tail: 2000,
      follow: false
    })
    expect(started).toMatchObject({ ok: false, routeMissing: true })
  })
})
