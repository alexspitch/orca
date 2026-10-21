import type { UsageServer } from './usage-host-types'

export type UsageScope = 'orca' | 'all'
export type UsageRange = '7d' | '30d' | '90d' | 'all'

export type MergeableScanState = {
  enabled: boolean
  isScanning: boolean
  lastScanStartedAt: number | null
  lastScanCompletedAt: number | null
  lastScanError: string | null
}

type BreakdownRow = { key: string; label: string }
type SessionRow = { sessionId: string; lastActiveAt: string; projectLabel: string }

export type MergeableSnapshot = {
  scanState: MergeableScanState
  summary: { topModel: string | null; topProject: string | null }
  daily: { day: string }[]
  modelBreakdown: BreakdownRow[]
  projectBreakdown: BreakdownRow[]
  recentSessions: SessionRow[]
}

type Daily<S extends MergeableSnapshot> = S['daily'][number]
type Breakdown<S extends MergeableSnapshot> = S['modelBreakdown'][number]

/** What differs per agent: which counters a row carries and how a summary derives the rest. */
export type UsageMergeOps<S extends MergeableSnapshot> = {
  empty: (scope: UsageScope, range: UsageRange, scanState: MergeableScanState) => S
  addSummary: (left: S['summary'], right: S['summary']) => S['summary']
  addDaily: (left: Daily<S>, right: Daily<S>) => Daily<S>
  addBreakdown: (left: Breakdown<S>, right: Breakdown<S>) => Breakdown<S>
  /** The tokens the hosts' own summaries rank models and projects by. */
  weight: (row: Breakdown<S>) => number
  /** Ratios the summary derives from its sums, recomputed once the hosts are added up. */
  finishSummary: (summary: S['summary']) => S['summary']
  mergeScanState: (states: readonly S['scanState'][], common: MergeableScanState) => S['scanState']
}

/** One host's snapshot; `server` is null for this machine, whose rows keep their own labels. */
export type UsageHostPart<S extends MergeableSnapshot> = {
  server: UsageServer | null
  snapshot: S
}

export function sumNullable(left: number | null, right: number | null): number | null {
  return left === null && right === null ? null : (left ?? 0) + (right ?? 0)
}

function mergeByKey<T>(rows: readonly T[], keyOf: (row: T) => string, add: (a: T, b: T) => T): T[] {
  const merged = new Map<string, T>()
  for (const row of rows) {
    const key = keyOf(row)
    const previous = merged.get(key)
    merged.set(key, previous === undefined ? row : add(previous, row))
  }
  return [...merged.values()]
}

// Why prefixed: one project name on two hosts is two projects, and a session id is only unique per host.
function labelServerRows<S extends MergeableSnapshot>(part: UsageHostPart<S>): S {
  const { server, snapshot } = part
  if (!server) {
    return snapshot
  }
  return {
    ...snapshot,
    projectBreakdown: snapshot.projectBreakdown.map((row) => ({
      ...row,
      key: `${server.id}:${row.key}`,
      label: `${server.label} · ${row.label}`
    })),
    recentSessions: snapshot.recentSessions.map((row) => ({
      ...row,
      sessionId: `${server.id}:${row.sessionId}`,
      projectLabel: `${server.label} · ${row.projectLabel}`
    }))
  }
}

function topLabel<Row extends BreakdownRow>(rows: readonly Row[]): string | null {
  return rows[0]?.label ?? null
}

/**
 * Adds several hosts' snapshots up into the one shape the usage panes already render.
 * `errors` are hosts that could not answer; they show as the scan error.
 */
export function mergeUsageSnapshots<S extends MergeableSnapshot>(
  parts: readonly UsageHostPart<S>[],
  errors: readonly string[],
  ops: UsageMergeOps<S>,
  request: { scope: UsageScope; range: UsageRange; limit: number; enabled: boolean }
): S {
  const states = parts.map((part) => part.snapshot.scanState)
  const hostErrors = parts.flatMap((part) => {
    const error = part.snapshot.scanState.lastScanError
    return error ? [part.server ? `${part.server.label}: ${error}` : error] : []
  })
  const completed = states.flatMap((state) =>
    state.lastScanCompletedAt === null ? [] : [state.lastScanCompletedAt]
  )
  const started = states.flatMap((state) =>
    state.lastScanStartedAt === null ? [] : [state.lastScanStartedAt]
  )
  const common: MergeableScanState = {
    enabled: request.enabled,
    isScanning: states.some((state) => state.isScanning),
    lastScanStartedAt: started.length > 0 ? Math.max(...started) : null,
    // Why the oldest: "updated" must not claim a freshness the slowest host has not reached.
    lastScanCompletedAt: completed.length > 0 ? Math.min(...completed) : null,
    lastScanError: [...hostErrors, ...errors].join(' • ') || null
  }
  const scanState = ops.mergeScanState(states, common)
  if (parts.length === 1 && errors.length === 0) {
    return { ...parts[0].snapshot, scanState }
  }

  const base = ops.empty(request.scope, request.range, common)
  const snapshots = parts.map(labelServerRows)
  const byWeight = (left: Breakdown<S>, right: Breakdown<S>): number =>
    ops.weight(right) - ops.weight(left)
  const modelBreakdown = mergeByKey(
    snapshots.flatMap((snapshot) => snapshot.modelBreakdown),
    (row) => row.key,
    ops.addBreakdown
  ).sort(byWeight)
  const projectBreakdown = mergeByKey(
    snapshots.flatMap((snapshot) => snapshot.projectBreakdown),
    (row) => row.key,
    ops.addBreakdown
  ).sort(byWeight)
  const summary = ops.finishSummary({
    ...snapshots.reduce((total, snapshot) => ops.addSummary(total, snapshot.summary), base.summary),
    topModel: topLabel(modelBreakdown),
    topProject: topLabel(projectBreakdown)
  })
  return {
    ...base,
    scanState,
    summary,
    daily: mergeByKey(
      snapshots.flatMap((snapshot) => snapshot.daily),
      (point) => point.day,
      ops.addDaily
    ).sort((left, right) => left.day.localeCompare(right.day)),
    modelBreakdown,
    projectBreakdown,
    recentSessions: snapshots
      .flatMap((snapshot) => snapshot.recentSessions)
      .sort((left, right) => right.lastActiveAt.localeCompare(left.lastActiveAt))
      .slice(0, request.limit)
  }
}
