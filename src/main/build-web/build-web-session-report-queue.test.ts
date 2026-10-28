import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BuildWebApiError, BuildWebUnreachableError } from './build-web-request'
import {
  createBuildWebSessionReportQueue,
  type BuildWebSessionReport,
  type BuildWebSessionReportQueueDeps
} from './build-web-session-report-queue'

// The host's reports to the console survive restarts and outages; only the console's own final
// answer (403, 404, a missing route) drops one.

const HOST = 'https://bw.test'
const REMOVED: BuildWebSessionReport = {
  kind: 'worktree-removed',
  sessionId: 's1',
  consoleHost: HOST
}

let filePath = ''
let clock = 1_000

beforeEach(() => {
  filePath = join(mkdtempSync(join(tmpdir(), 'orca-bw-reports-')), 'reports.json')
  clock = 1_000
})

function queue(over: Partial<BuildWebSessionReportQueueDeps> = {}) {
  const send = vi.fn<(report: BuildWebSessionReport) => Promise<unknown>>(async () => ({}))
  const q = createBuildWebSessionReportQueue({
    filePath,
    consoleHost: () => HOST,
    send,
    now: () => clock,
    retryBaseMs: 1_000,
    ...over
  })
  return { q, send: over.send ? vi.mocked(over.send) : send }
}

describe('build-web session report queue', () => {
  it('drops a report on a final refusal: 403, 404, or a route an older console lacks', async () => {
    for (const error of [
      new BuildWebApiError('forbidden', 403),
      new BuildWebApiError('no such session', 404),
      new BuildWebApiError('Not Found', 404, [], true)
    ]) {
      const { q } = queue({
        send: vi.fn(async () => {
          throw error
        })
      })
      q.enqueue(REMOVED)
      await q.drain()
      expect(q.pending()).toEqual([])
    }
  })

  it('retries anything else with growing pauses until the console confirms', async () => {
    const send = vi
      .fn<(report: BuildWebSessionReport) => Promise<unknown>>()
      .mockRejectedValueOnce(new BuildWebUnreachableError(HOST, new Error('ECONNREFUSED'), 't'))
      .mockRejectedValueOnce(new BuildWebApiError('busy', 503))
      .mockResolvedValue({})
    const { q } = queue({ send })
    q.enqueue(REMOVED)
    await q.drain()
    expect(send).toHaveBeenCalledTimes(1)

    await q.drain()
    expect(send).toHaveBeenCalledTimes(1)
    clock += 1_000
    await q.drain()
    expect(send).toHaveBeenCalledTimes(2)

    clock += 1_000
    await q.drain()
    expect(send).toHaveBeenCalledTimes(2)
    clock += 1_000
    await q.drain()
    expect(send).toHaveBeenCalledTimes(3)
    expect(q.pending()).toEqual([])
  })

  it('keeps a report across a restart and sends it from the next run', async () => {
    const offline = queue({ consoleHost: () => null })
    offline.q.enqueue({ ...REMOVED, external: true })
    offline.q.enqueue({ kind: 'keep', sessionId: 's2', consoleHost: HOST })
    await offline.q.drain()
    expect(offline.send).not.toHaveBeenCalled()

    const restarted = queue()
    expect(restarted.q.pending()).toHaveLength(2)
    await restarted.q.drain()
    expect(restarted.send).toHaveBeenCalledWith({ ...REMOVED, external: true })
    expect(restarted.send).toHaveBeenCalledWith({
      kind: 'keep',
      sessionId: 's2',
      consoleHost: HOST
    })
    expect(queue().q.pending()).toEqual([])
  })

  it('waits for the console the session belongs to, however its URL is spelled', async () => {
    const { q, send } = queue({ consoleHost: () => 'https://other.test' })
    q.enqueue(REMOVED)
    await q.drain()
    expect(send).not.toHaveBeenCalled()
    expect(q.pending()).toEqual([REMOVED])

    const same = queue({ consoleHost: () => 'https://BW.test:443/' })
    await same.q.drain()
    expect(same.send).toHaveBeenCalledWith(REMOVED)
  })

  it('holds a removal until the finisher names the branch it kept', async () => {
    const { q, send } = queue()
    q.hold('s1')
    q.enqueue(REMOVED)
    await q.drain()
    expect(send).not.toHaveBeenCalled()

    q.release('s1', 'branch kept: is-147')
    await q.drain()
    expect(send).toHaveBeenCalledWith({ ...REMOVED, note: 'branch kept: is-147' })
  })
})
