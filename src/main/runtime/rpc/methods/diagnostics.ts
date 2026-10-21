import type { HostLoad } from '../../../../shared/process-stats-types'
import { sampleHostCpuPercent } from '../../../memory/host-cpu-usage'
import { collectHostMemory } from '../../../memory/host-memory'
import { defineMethod } from '../core'

export const DIAGNOSTICS_METHODS = [
  defineMethod({
    name: 'diagnostics.memory',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => {
      return await runtime.getMemorySnapshot()
    }
  }),
  // Why apart from diagnostics.memory: the status bar polls every server, and that one sweeps
  // every process on the host to answer.
  defineMethod({
    name: 'diagnostics.host',
    permission: 'workspace',
    params: null,
    handler: async (): Promise<HostLoad> => {
      const [memory, cpuPercent] = await Promise.all([collectHostMemory(), sampleHostCpuPercent()])
      return { ...memory, cpuPercent, collectedAt: Date.now() }
    }
  })
]
