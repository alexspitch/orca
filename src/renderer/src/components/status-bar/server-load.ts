/** At or above this share of CPU or memory a server's bullet turns red. */
export const SERVER_LOAD_HIGH_PERCENT = 90

export type ServerLoad = {
  /** Busy share of all cores; from the load average (load ÷ cores) on a server too old to measure. */
  cpuPercent: number | null
  cpuSource: 'busy' | 'load-average'
  loadAverage1m: number
  cpuCoreCount: number
  memoryPercent: number
  usedMemory: number
  totalMemory: number
}

export type ServerLoadResult =
  | { status: 'sampled'; load: ServerLoad }
  // Why: a server that did not answer is unverifiable, so it is never shown as idle.
  | { status: 'unreachable' }
  | { status: 'update-required' }

export type ServerLoadCall = (environmentId: string, method: string) => Promise<unknown>

export function isServerLoadHigh(load: ServerLoad): boolean {
  return (
    (load.cpuPercent ?? 0) >= SERVER_LOAD_HIGH_PERCENT ||
    load.memoryPercent >= SERVER_LOAD_HIGH_PERCENT
  )
}

/**
 * One reading of a paired server. A server predating `diagnostics.host` is asked
 * `diagnostics.memory` instead, and remembered in `legacy` so later reads skip the refusal.
 */
export async function readServerLoad(
  environmentId: string,
  call: ServerLoadCall,
  legacy: Set<string>
): Promise<ServerLoadResult> {
  try {
    if (!legacy.has(environmentId)) {
      try {
        const load = parseHostLoad(await call(environmentId, 'diagnostics.host'), 'busy')
        return load ? { status: 'sampled', load } : { status: 'update-required' }
      } catch (error) {
        if (!hasErrorCode(error, 'method_not_found')) {
          throw error
        }
        legacy.add(environmentId)
      }
    }
    const snapshot = await call(environmentId, 'diagnostics.memory')
    const load = isRecord(snapshot) ? parseHostLoad(snapshot.host, 'load-average') : null
    return load ? { status: 'sampled', load } : { status: 'update-required' }
  } catch (error) {
    return hasErrorCode(error, 'method_not_found')
      ? { status: 'update-required' }
      : { status: 'unreachable' }
  }
}

// Why: servers ship independently; an answer of another shape reads as needing an update.
function parseHostLoad(value: unknown, cpuSource: ServerLoad['cpuSource']): ServerLoad | null {
  if (!isRecord(value)) {
    return null
  }
  const totalMemory = finiteNumber(value.totalMemory)
  const usedMemory = finiteNumber(value.usedMemory)
  const memoryPercent = finiteNumber(value.memoryUsagePercent)
  const cpuCoreCount = finiteNumber(value.cpuCoreCount)
  const loadAverage1m = finiteNumber(value.loadAverage1m)
  if (
    totalMemory === null ||
    usedMemory === null ||
    memoryPercent === null ||
    cpuCoreCount === null ||
    loadAverage1m === null
  ) {
    return null
  }
  const cpuPercent =
    cpuSource === 'busy'
      ? finiteNumber(value.cpuPercent)
      : cpuCoreCount > 0
        ? (loadAverage1m / cpuCoreCount) * 100
        : null
  return {
    cpuPercent,
    cpuSource,
    loadAverage1m,
    cpuCoreCount,
    memoryPercent,
    usedMemory,
    totalMemory
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
