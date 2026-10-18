import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A push's progress is read off the run's event stream: each image's OK or FAIL line, and the end.

const mocks = vi.hoisted(() => ({
  fetch: vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(),
  invalidate: vi.fn()
}))
vi.mock('./build-web-connection', () => ({
  requireBuildWebCredential: () => ({ baseUrl: 'https://bw.test', token: 't', generation: 1 })
}))
vi.mock('./build-web-images', () => ({ invalidateBuildWebImageCatalog: mocks.invalidate }))
vi.mock('../network/http-client', () => ({ getMainHttpClient: () => ({ fetch: mocks.fetch }) }))

const { buildWebPushProgress, followBuildWebPush, _resetBuildWebPushProgress } =
  await import('./build-web-push-progress')

function stream(events: { type: string; data: unknown }[]): Response {
  const text = events.map((e, seq) => `data: ${JSON.stringify({ seq, ...e })}\n\n`).join('')
  const bytes = new TextEncoder().encode(`retry: 3000\n\n${text}`)
  return new Response(
    new ReadableStream({
      start(controller) {
        // Why two pieces: an event cut across reads must still be read whole.
        controller.enqueue(bytes.slice(0, 40))
        controller.enqueue(bytes.slice(40))
        controller.close()
      }
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } }
  )
}

const settled = async () => {
  await vi.waitFor(() => expect(buildWebPushProgress(['run-1'])[0].state).not.toBe('pushing'))
  return buildWebPushProgress(['run-1'])[0]
}

beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.invalidate.mockReset()
})
afterEach(() => _resetBuildWebPushProgress())

describe('push progress', () => {
  it('records each image as it lands and the end of the push', async () => {
    mocks.fetch.mockResolvedValueOnce(
      stream([
        { type: 'push-status', data: { pushing: true } },
        { type: 'log', data: { line: '[push] pushing 2 image(s), build tag only, via ci@b …' } },
        { type: 'log', data: { line: 'layer 1: Pushed', stderr: true } },
        { type: 'log', data: { line: '[push] OK   dc/ib-api-server (rhel)' } },
        { type: 'log', data: { line: '[push] FAIL dc/ib-api-server (redos)', stderr: true } },
        { type: 'push-status', data: { pushing: false } },
        { type: 'done', data: {} }
      ])
    )
    followBuildWebPush('run-1')
    const progress = await settled()
    expect(progress).toMatchObject({
      state: 'done',
      ok: ['dc/ib-api-server|rhel'],
      failed: ['dc/ib-api-server|redos'],
      error: null
    })
    expect(progress.lines).toContain('· layer 1: Pushed')
    expect(mocks.fetch.mock.calls[0][0]).toBe('https://bw.test/api/runs/run-1/stream')
    expect(mocks.invalidate).toHaveBeenCalled()
  })

  it('says it does not know when the console reports nothing about the push', async () => {
    mocks.fetch.mockResolvedValueOnce(stream([]))
    followBuildWebPush('run-1')
    expect(await settled()).toMatchObject({ state: 'unknown', ok: [], failed: [] })
  })

  it('reads a run nobody follows as unknown', () => {
    expect(buildWebPushProgress(['run-x'])[0]).toMatchObject({ runId: 'run-x', state: 'unknown' })
  })
})
