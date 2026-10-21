import os from 'node:os'

type CpuTimes = { busy: number; total: number }

// Why: a first ask has nothing to compare against, so it measures a short window of its own.
const FIRST_WINDOW_MS = 250
// Why: asks closer together than this share one reading instead of measuring a sliver of time.
const MIN_WINDOW_MS = 1_000
// Why: a reading older than this would average over minutes nobody asked about.
const MAX_WINDOW_MS = 60_000

let previous: { at: number; times: CpuTimes; percent: number | null } | null = null

function readCpuTimes(): CpuTimes {
  let busy = 0
  let total = 0
  for (const { times } of os.cpus()) {
    const working = times.user + times.nice + times.sys + times.irq
    busy += working
    total += working + times.idle
  }
  return { busy, total }
}

function busyPercent(from: CpuTimes, to: CpuTimes): number | null {
  const total = to.total - from.total
  if (total <= 0) {
    return null
  }
  return Math.min(100, Math.max(0, ((to.busy - from.busy) / total) * 100))
}

/** The host's CPU busy share since the last ask, all cores together being 100, as `top` reports it. */
export async function sampleHostCpuPercent(now: () => number = Date.now): Promise<number | null> {
  const age = previous ? now() - previous.at : Number.POSITIVE_INFINITY
  if (previous && age < MIN_WINDOW_MS) {
    return previous.percent
  }
  let start = previous?.times
  if (!start || age > MAX_WINDOW_MS) {
    start = readCpuTimes()
    await new Promise((resolve) => setTimeout(resolve, FIRST_WINDOW_MS))
  }
  const times = readCpuTimes()
  const percent = busyPercent(start, times)
  previous = { at: now(), times, percent }
  return percent
}

/** Tests start each case without an earlier reading. */
export function resetHostCpuUsageForTests(): void {
  previous = null
}
