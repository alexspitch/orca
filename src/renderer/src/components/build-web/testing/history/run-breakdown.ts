import type {
  BuildWebTestFile,
  BuildWebTestJobBreakdown
} from '../../../../../../shared/build-web-test-history-types'
import { familyOf, TEST_FAMILIES, type TestFamily } from './test-run-rows'

// A run laid out by test, after build-web's run-breakdown.ts: what the status filter keeps, and
// the workspace map's tones and rows.

export const BREAKDOWN_FILTERS = ['all', 'failed', 'flaky', 'skipped'] as const
export type BreakdownFilter = (typeof BREAKDOWN_FILTERS)[number]

const RED_JOB = new Set(['failed', 'load_error', 'empty', 'timeout'])

export const isRedJob = (status: string): boolean => RED_JOB.has(status)

/** Whether a workspace has anything the filter asks for; a red job counts as failed without a red case. */
export function keepJob(j: BuildWebTestJobBreakdown, f: BreakdownFilter): boolean {
  if (f === 'failed') {
    return j.failed > 0 || isRedJob(j.jobStatus)
  }
  if (f === 'flaky') {
    return j.flaky > 0 || j.jobFlaky
  }
  return f === 'skipped' ? j.skipped > 0 : true
}

/** The workspaces to show: the red ones first, then the ones with a retry, then by name. */
export function breakdownJobs(
  jobs: readonly BuildWebTestJobBreakdown[],
  f: BreakdownFilter
): BuildWebTestJobBreakdown[] {
  const rank = (j: BuildWebTestJobBreakdown): number =>
    isRedJob(j.jobStatus) ? 0 : j.flaky > 0 || j.jobFlaky ? 1 : 2
  return jobs
    .filter((j) => keepJob(j, f))
    .sort((a, b) => rank(a) - rank(b) || a.workspace.localeCompare(b.workspace))
}

/** The files of a workspace with only the tests the filter asks for; a file left empty goes. */
export function filterFiles(
  files: readonly BuildWebTestFile[],
  f: BreakdownFilter
): BuildWebTestFile[] {
  if (f === 'all') {
    return [...files]
  }
  const keep = (t: BuildWebTestFile['tests'][number]): boolean =>
    f === 'failed' ? t.status === 'failed' : f === 'flaky' ? t.flaky : t.status === 'skipped'
  return files
    .map((file) => ({ ...file, tests: file.tests.filter(keep) }))
    .filter((file) => file.tests.length > 0)
}

/** A workspace's colour on the map. A red job is red even without a red case. */
export type MapTone = 'passed' | 'failed' | 'skipped' | 'empty'

export function toneOf(j: BuildWebTestJobBreakdown): MapTone {
  if (j.failed > 0 || isRedJob(j.jobStatus)) {
    return 'failed'
  }
  if (j.passed + j.skipped === 0) {
    return 'empty'
  }
  return j.skipped > 0 ? 'skipped' : 'passed'
}

/** The map of a run: one row per family, the workspaces of a row by name. */
export function mapGroups(
  jobs: readonly BuildWebTestJobBreakdown[]
): { family: TestFamily; jobs: BuildWebTestJobBreakdown[]; failed: number; skipped: number }[] {
  return TEST_FAMILIES.map((family) => {
    const of = jobs
      .filter((j) => familyOf(j.workspace) === family)
      .sort((a, b) => a.workspace.localeCompare(b.workspace))
    const tones = of.map(toneOf)
    return {
      family,
      jobs: of,
      failed: tones.filter((t) => t === 'failed').length,
      skipped: tones.filter((t) => t === 'skipped').length
    }
  }).filter((g) => g.jobs.length > 0)
}

/** A duration as a person reads it: ms, s, min, h min. */
export function durationText(ms: number | null): string {
  if (ms == null) {
    return '—'
  }
  if (ms < 1000) {
    return `${Math.round(ms)} ms`
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)} s`
  }
  const min = Math.round(ms / 60_000)
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`
}
