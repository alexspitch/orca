import { describe, expect, it } from 'vitest'
import type { BuildWebTrainRun } from '../../../../../shared/build-web-train-types'
import { failedWindowNear } from './train-window-lookup'

const run = (
  id: string,
  status: BuildWebTrainRun['status'],
  updated_at: string
): BuildWebTrainRun => ({
  id,
  build_run_id: null,
  window_at: updated_at,
  status,
  images: [],
  tickets: [],
  error: null,
  updated_at,
  built: 0,
  problems: 0,
  live_builds: []
})

describe('the train window a failure is about', () => {
  const runs = [
    run('w3', 'done', '2026-10-21T12:05:00Z'),
    run('w2', 'failed', '2026-10-21T10:04:00Z'),
    run('w1', 'failed', '2026-10-21T08:03:00Z')
  ]

  it('picks the failed window that ended nearest the notification', () => {
    expect(failedWindowNear(runs, '2026-10-21T08:03:30Z')?.id).toBe('w1')
    expect(failedWindowNear(runs, '2026-10-21T10:30:00Z')?.id).toBe('w2')
  })

  it('takes the newest failure without a time, and the newest window without a failure', () => {
    expect(failedWindowNear(runs, '')?.id).toBe('w2')
    expect(failedWindowNear([runs[0]], '2026-10-21T08:00:00Z')?.id).toBe('w3')
    expect(failedWindowNear([], '2026-10-21T08:00:00Z')).toBeNull()
  })
})
