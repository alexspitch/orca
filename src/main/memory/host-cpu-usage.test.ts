import os from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetHostCpuUsageForTests, sampleHostCpuPercent } from './host-cpu-usage'

let busy = 0
let idle = 0

/** One of two cores, each with half the totals. */
function core(): os.CpuInfo {
  return {
    model: 'test',
    speed: 1,
    times: { user: busy / 4, nice: 0, sys: busy / 4, irq: 0, idle: idle / 2 }
  }
}

beforeEach(() => {
  resetHostCpuUsageForTests()
  vi.useFakeTimers()
  busy = 0
  idle = 0
  vi.spyOn(os, 'cpus').mockImplementation(() => [core(), core()])
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** Advances the clock, with the cores having been busy for `share` of that time. */
function run(ms: number, share: number): void {
  busy += ms * 2 * share
  idle += ms * 2 * (1 - share)
  vi.advanceTimersByTime(ms)
}

describe('sampleHostCpuPercent', () => {
  it('measures a short window of its own on the first ask', async () => {
    const reading = sampleHostCpuPercent()
    run(250, 0.4)
    await expect(reading).resolves.toBeCloseTo(40)
  })

  it('reads the time since the previous ask, and shares one reading within a second', async () => {
    const first = sampleHostCpuPercent()
    run(250, 0.1)
    await first
    run(10_000, 0.95)
    await expect(sampleHostCpuPercent()).resolves.toBeCloseTo(95)
    run(500, 0)
    await expect(sampleHostCpuPercent()).resolves.toBeCloseTo(95)
  })

  it('measures afresh when the previous reading is over a minute old', async () => {
    const first = sampleHostCpuPercent()
    run(250, 0.1)
    await first
    run(120_000, 0.9)
    const fresh = sampleHostCpuPercent()
    run(250, 0.2)
    await expect(fresh).resolves.toBeCloseTo(20)
  })
})
