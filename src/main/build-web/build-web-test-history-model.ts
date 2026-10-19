import {
  BUILD_WEB_TEST_DELTA_ORDER,
  BUILD_WEB_TEST_TRANSITIONS,
  type BuildWebTestCase,
  type BuildWebTestCaseHistory,
  type BuildWebTestDelta,
  type BuildWebTestDeltaKind,
  type BuildWebTestDeltaRow,
  type BuildWebTestFile,
  type BuildWebTestJobBreakdown,
  type BuildWebLastNightly,
  type BuildWebTestJobScope,
  type BuildWebTestRun,
  type BuildWebTestRunSummary,
  type BuildWebTestSelection,
  type BuildWebTestTransition
} from '../../shared/build-web-test-history-types'
import { recordOf, recordsOf, textOf, textOrNull, textsOf } from './build-web-response-fields'

// The console's test history, narrowed field by field. A nightly run's delta holds every one of
// its ~33k cases; only the changed rows cross to the renderer, the By test tab lists the rest.

/** Changed rows of a delta that reach the renderer; past this only their count does. */
export const DELTA_ROWS_MAX = 2_000
// Why: the row shows the first line and the tooltip the rest; a stack dump would only bloat a reply.
const FAILURE_MESSAGE_MAX = 4_000

/** A count Postgres may send as a numeric string (bigint, numeric), or null. */
function numberOrNull(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

const countOf = (value: unknown): number => numberOrNull(value) ?? 0

function transitionOf(value: unknown): BuildWebTestTransition | null {
  return BUILD_WEB_TEST_TRANSITIONS.find((t) => t === value) ?? null
}

export function selectionOf(value: unknown): BuildWebTestSelection {
  const s = recordOf(value)
  switch (s?.mode) {
    case 'files':
      return { mode: 'files', files: textsOf(s.files) }
    case 'tests':
      return { mode: 'tests', tests: textsOf(s.tests) }
    case 'phases':
      return { mode: 'phases', phases: textsOf(s.phases) }
    case 'tag':
      return { mode: 'tag', expr: textOf(s.expr) }
    case 'shard':
      return { mode: 'shard', index: numberOrNull(s.index), total: countOf(s.total) }
    default:
      return { mode: 'all' }
  }
}

function scopeOf(j: Record<string, unknown>): BuildWebTestJobScope {
  return {
    workspace: textOf(j.workspace),
    suite_variant: textOf(j.suite_variant),
    status: textOf(j.status),
    selection: selectionOf(j.selection)
  }
}

export function testRunOf(value: unknown): BuildWebTestRun | null {
  const r = recordOf(value)
  if (!r || typeof r.id !== 'string') {
    return null
  }
  const totals = recordOf(r.totals)
  return {
    id: r.id,
    created_at: textOf(r.created_at),
    user: textOf(r.user),
    exec_mode: textOf(r.exec_mode),
    branch: textOrNull(r.branch),
    commit_sha: textOrNull(r.commit_sha),
    dirty: r.dirty === true,
    status: textOf(r.status),
    totals: {
      passed: countOf(totals?.passed),
      failed: countOf(totals?.failed),
      skipped: countOf(totals?.skipped),
      jobs: countOf(totals?.jobs)
    },
    jobs: recordsOf(r.jobs).map(scopeOf)
  }
}

export function testRunsOf(value: unknown): BuildWebTestRun[] {
  return recordsOf(recordOf(value)?.runs)
    .map(testRunOf)
    .filter((r): r is BuildWebTestRun => r !== null)
}

/** The delta with the flaky tests folded in, counted whole and cut to the changed rows. */
export function testDeltaOf(value: unknown, flakyValue: unknown): BuildWebTestDelta {
  const d = recordOf(value)
  const flaky = new Map(
    recordsOf(flakyValue).map((f) => [
      textOf(f.key),
      { retries: countOf(f.retries), flips: countOf(f.flips) }
    ])
  )
  const counts: Partial<Record<BuildWebTestDeltaKind, number>> = {}
  const changed: BuildWebTestDeltaRow[] = []
  for (const r of recordsOf(d?.rows)) {
    const change = transitionOf(r.change)
    if (!change) {
      continue
    }
    const key = textOf(r.key)
    const flakyOf = flaky.get(key) ?? null
    // Why: flakiness is not a transition; a flaky test that passed twice is `unchanged` and would hide.
    const kind: BuildWebTestDeltaKind = flakyOf ? 'flaky' : change
    counts[kind] = (counts[kind] ?? 0) + 1
    if (kind === 'unchanged') {
      continue
    }
    changed.push({
      key,
      name: textOf(r.name) || key,
      workspace: textOf(r.workspace),
      was: textOrNull(r.was),
      now: textOrNull(r.now),
      change,
      kind,
      flaky: flakyOf
    })
  }
  const rank = (row: BuildWebTestDeltaRow): number => BUILD_WEB_TEST_DELTA_ORDER.indexOf(row.kind)
  changed.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  return {
    previousRunId: textOrNull(d?.previousRunId),
    comparable: d?.comparable === true,
    counts,
    rows: changed.slice(0, DELTA_ROWS_MAX),
    omitted: Math.max(0, changed.length - DELTA_ROWS_MAX)
  }
}

export function testSummaryOf(value: unknown): BuildWebTestRunSummary {
  const s = recordOf(value)
  return {
    workspaces: countOf(s?.workspaces),
    passed: countOf(s?.passed),
    failed: countOf(s?.failed),
    skipped: countOf(s?.skipped),
    flaky: countOf(s?.flaky),
    durationMs: countOf(s?.durationMs),
    redWorkspaces: countOf(s?.redWorkspaces)
  }
}

export function testBreakdownOf(value: unknown): BuildWebTestJobBreakdown[] {
  return recordsOf(value)
    .filter((j) => typeof j.jobId === 'string')
    .map((j) => ({
      jobId: textOf(j.jobId),
      workspace: textOf(j.workspace),
      variant: textOf(j.variant),
      jobStatus: textOf(j.jobStatus),
      durationMs: numberOrNull(j.durationMs),
      passed: countOf(j.passed),
      failed: countOf(j.failed),
      skipped: countOf(j.skipped),
      flaky: countOf(j.flaky),
      jobFlaky: j.jobFlaky === true,
      hasReport: j.hasReport === true
    }))
}

function testCaseOf(t: Record<string, unknown>): BuildWebTestCase {
  const message = textOrNull(t.failureMessage)
  return {
    key: textOf(t.key),
    jobId: textOf(t.jobId),
    suite: textOf(t.suite),
    name: textOf(t.name) || textOf(t.key),
    status: textOf(t.status),
    durationMs: numberOrNull(t.durationMs),
    retries: countOf(t.retries),
    flaky: t.flaky === true,
    failureMessage: message === null ? null : message.slice(0, FAILURE_MESSAGE_MAX),
    change: transitionOf(t.change)
  }
}

export function testFilesOf(value: unknown): BuildWebTestFile[] {
  return recordsOf(recordOf(value)?.files).map((f) => ({
    file: textOf(f.file),
    passed: countOf(f.passed),
    failed: countOf(f.failed),
    skipped: countOf(f.skipped),
    flaky: countOf(f.flaky),
    durationMs: countOf(f.durationMs),
    tests: recordsOf(f.tests).map(testCaseOf)
  }))
}

export function testCaseHistoryOf(value: unknown, key: string): BuildWebTestCaseHistory {
  const c = recordOf(value)
  return {
    key: textOf(c?.key) || key,
    name: textOrNull(c?.name),
    workspace: textOrNull(c?.workspace),
    points: recordsOf(c?.points).map((p) => ({
      runId: textOf(p.runId),
      createdAt: textOrNull(p.createdAt),
      commitSha: textOrNull(p.commitSha),
      status: textOf(p.status),
      durationMs: numberOrNull(p.durationMs),
      retries: countOf(p.retries)
    })),
    flips: countOf(c?.flips),
    avgDurationMs: numberOrNull(c?.avgDurationMs)
  }
}

/** From `/api/tests/nightly`: the newest nightly run that finished with a result, or null. */
export function lastNightlyOf(value: unknown): BuildWebLastNightly | null {
  // Why not running or interrupted ones: a run still going, or cut short, has no count to show yet.
  const run = recordsOf(recordOf(value)?.runs).find(
    (r) => r.exec_mode === 'agent-nightly' && (r.status === 'passed' || r.status === 'failed')
  )
  if (!run || typeof run.id !== 'string') {
    return null
  }
  return {
    runId: run.id,
    created_at: textOf(run.created_at),
    commit_sha: textOrNull(run.commit_sha),
    failed: countOf(recordOf(run.totals)?.failed)
  }
}
