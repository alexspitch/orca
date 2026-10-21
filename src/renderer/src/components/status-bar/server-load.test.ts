import { describe, expect, it, vi } from 'vitest'
import { isServerLoadHigh, readServerLoad, type ServerLoadCall } from './server-load'

const HOST = {
  totalMemory: 16_000,
  freeMemory: 4_000,
  availableMemory: 6_000,
  availableMemorySource: 'proc-meminfo',
  usedMemory: 10_000,
  memoryUsagePercent: 62.5,
  cpuCoreCount: 8,
  loadAverage1m: 2
}

function refusal(): Error {
  return Object.assign(new Error('Unknown method'), { code: 'method_not_found' })
}

describe('readServerLoad', () => {
  it("reads a server's measured CPU and its memory", async () => {
    const call = vi.fn<ServerLoadCall>(async () => ({ ...HOST, cpuPercent: 37, collectedAt: 1 }))
    await expect(readServerLoad('dev', call, new Set())).resolves.toEqual({
      status: 'sampled',
      load: {
        cpuPercent: 37,
        cpuSource: 'busy',
        loadAverage1m: 2,
        cpuCoreCount: 8,
        memoryPercent: 62.5,
        usedMemory: 10_000,
        totalMemory: 16_000
      }
    })
    expect(call).toHaveBeenCalledWith('dev', 'diagnostics.host')
  })

  it('asks an older server its memory snapshot instead, and remembers to from then on', async () => {
    const legacy = new Set<string>()
    const call = vi.fn<ServerLoadCall>(async (_id, method) => {
      if (method === 'diagnostics.host') {
        throw refusal()
      }
      return { host: HOST, worktrees: [] }
    })
    const first = await readServerLoad('old', call, legacy)
    expect(first).toMatchObject({
      status: 'sampled',
      load: { cpuSource: 'load-average', cpuPercent: 25 }
    })
    await readServerLoad('old', call, legacy)
    expect(call.mock.calls.map(([, method]) => method)).toEqual([
      'diagnostics.host',
      'diagnostics.memory',
      'diagnostics.memory'
    ])
  })

  it('never shows a server that did not answer as idle', async () => {
    const down = vi.fn<ServerLoadCall>(async () => {
      throw new Error('timed out')
    })
    await expect(readServerLoad('dev', down, new Set())).resolves.toEqual({
      status: 'unreachable'
    })
    const odd = vi.fn<ServerLoadCall>(async () => ({ something: 'else' }))
    await expect(readServerLoad('dev', odd, new Set())).resolves.toEqual({
      status: 'update-required'
    })
  })
})

describe('isServerLoadHigh', () => {
  const load = {
    cpuPercent: 20,
    cpuSource: 'busy' as const,
    loadAverage1m: 1,
    cpuCoreCount: 8,
    memoryPercent: 40,
    usedMemory: 1,
    totalMemory: 2
  }

  it('is high when CPU or memory reaches 90%', () => {
    expect(isServerLoadHigh(load)).toBe(false)
    expect(isServerLoadHigh({ ...load, cpuPercent: 90 })).toBe(true)
    expect(isServerLoadHigh({ ...load, memoryPercent: 93 })).toBe(true)
    expect(isServerLoadHigh({ ...load, cpuPercent: null })).toBe(false)
  })
})
