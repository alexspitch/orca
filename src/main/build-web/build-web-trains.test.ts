import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RequestModule from './build-web-request'

// The Trains item's number: the images of the train windows on their way to a stand.

const mocks = vi.hoisted(() => ({
  request: vi.fn<(request: { path: string }) => Promise<unknown>>()
}))

vi.mock('./build-web-connection', () => ({
  requireBuildWebCredential: () => ({ baseUrl: 'https://bw.test', token: 't', generation: 1 })
}))
vi.mock('./build-web-request', async (importOriginal) => ({
  ...(await importOriginal<typeof RequestModule>()),
  buildWebRequest: mocks.request
}))

const { countBuildWebRollingImages, listBuildWebTrains } = await import('./build-web-trains')

const image = (name: string) => ({ image: name, dist: 'rhel', why: [], tickets: [] })
const train = (id: string, runId: string | null, status: string) => ({
  id,
  name: id,
  last_run: runId ? { id: runId, status, window_at: '2026-10-19T10:00:00Z' } : null
})

beforeEach(() => {
  mocks.request.mockReset()
})

describe('the images trains roll out', () => {
  it('counts the windows building or deploying, not the ones scanning, reporting or done', async () => {
    const paths: Record<string, unknown> = {
      '/api/trains': {
        trains: [
          train('t-build', 'r1', 'building'),
          train('t-deploy', 'r2', 'deploying'),
          train('t-scan', 'r3', 'scanning'),
          train('t-report', 'r4', 'reporting'),
          train('t-done', 'r5', 'done'),
          train('t-new', null, 'building')
        ]
      },
      '/api/trains/t-build/runs?limit=3&offset=0&withActions=1': {
        runs: [
          { id: 'r1', status: 'building', images: [image('dc/a'), image('dc/b')] },
          { id: 'r0', status: 'done', images: [image('dc/old')] }
        ]
      },
      '/api/trains/t-deploy/runs?limit=3&offset=0&withActions=1': {
        runs: [{ id: 'r2', status: 'deploying', images: [image('sa/c')] }]
      }
    }
    mocks.request.mockImplementation(async ({ path }) => paths[path] ?? { runs: [] })
    expect(await countBuildWebRollingImages()).toEqual({ images: 3, trains: 2 })
    expect(mocks.request.mock.calls.map(([r]) => r.path)).not.toContain(
      '/api/trains/t-scan/runs?limit=3&offset=0&withActions=1'
    )
  })

  it('is zero when no train is on its way', async () => {
    mocks.request.mockResolvedValue({ trains: [train('t-done', 'r5', 'done')] })
    expect(await countBuildWebRollingImages()).toEqual({ images: 0, trains: 0 })
  })
})

describe('the trains list', () => {
  it('names the repository of a chat-platform train, and a train with no stand', async () => {
    mocks.request.mockImplementation(async ({ path }) =>
      path === '/api/stands'
        ? { stands: [{ id: 's1', name: 'DC 3.1' }] }
        : {
            trains: [
              { id: 't1', name: 'dc', branch: 'master', stand_id: 's1' },
              { id: 't2', name: 'cp', branch: 'master', repo: 'chat-platform', stand_id: null }
            ]
          }
    )
    const trains = await listBuildWebTrains()
    expect(trains.map((t) => [t.repo, t.stand_id, t.stand_name])).toEqual([
      ['products', 's1', 'DC 3.1'],
      ['chat-platform', null, '']
    ])
  })
})
