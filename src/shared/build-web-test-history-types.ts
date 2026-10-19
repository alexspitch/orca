// build-web's test history (its /tests/history) for the «Test history» tab of Testing.

export const BUILD_WEB_TEST_TRANSITIONS = [
  'broken',
  'still_failing',
  'fixed',
  'new',
  'disappeared',
  'unchanged'
] as const
export type BuildWebTestTransition = (typeof BUILD_WEB_TEST_TRANSITIONS)[number]

/** How a delta row is shown: its transition, or `flaky` when the test was flaky in this run. */
export type BuildWebTestDeltaKind = BuildWebTestTransition | 'flaky'

/** The order a delta is read in: what broke first, the bulk of unchanged rows last. */
export const BUILD_WEB_TEST_DELTA_ORDER: readonly BuildWebTestDeltaKind[] = [
  'broken',
  'still_failing',
  'fixed',
  'new',
  'flaky',
  'disappeared',
  'unchanged'
]

/** What one job was narrowed to; what names a run in the list. */
export type BuildWebTestSelection =
  | { mode: 'all' }
  | { mode: 'files'; files: string[] }
  | { mode: 'tests'; tests: string[] }
  | { mode: 'phases'; phases: string[] }
  | { mode: 'tag'; expr: string }
  | { mode: 'shard'; index: number | null; total: number }

export type BuildWebTestJobScope = {
  workspace: string
  suite_variant: string
  status: string
  selection: BuildWebTestSelection
}

export type BuildWebTestTotals = { passed: number; failed: number; skipped: number; jobs: number }

export type BuildWebTestRun = {
  id: string
  created_at: string
  user: string
  /** `agent-nightly` / `agent-recheck` for the build agent's runs, else where a person ran it. */
  exec_mode: string
  branch: string | null
  commit_sha: string | null
  dirty: boolean
  status: string
  totals: BuildWebTestTotals
  jobs: BuildWebTestJobScope[]
}

export type BuildWebTestDeltaRow = {
  key: string
  name: string
  workspace: string
  was: string | null
  now: string | null
  change: BuildWebTestTransition
  kind: BuildWebTestDeltaKind
  /** Set for a test that was flaky in this run: retries inside it, flips at the same commit. */
  flaky: { retries: number; flips: number } | null
}

export type BuildWebTestDelta = {
  previousRunId: string | null
  /** False when either run was partial: `disappeared` is then not computed. */
  comparable: boolean
  /** Rows of every kind, over the whole delta. */
  counts: Partial<Record<BuildWebTestDeltaKind, number>>
  /** The changed rows (a flaky unchanged one included) in reading order, at most a cap of them. */
  rows: BuildWebTestDeltaRow[]
  /** Changed rows past the cap. */
  omitted: number
}

export type BuildWebTestRunSummary = {
  workspaces: number
  passed: number
  failed: number
  skipped: number
  flaky: number
  /** Sum of the jobs' durations: suites run side by side, so not the wall time. */
  durationMs: number
  redWorkspaces: number
}

export type BuildWebTestJobBreakdown = {
  jobId: string
  workspace: string
  variant: string
  jobStatus: string
  durationMs: number | null
  passed: number
  failed: number
  skipped: number
  /** Passed after a retry inside the run. */
  flaky: number
  /** The suite was red next to the others and green alone (a run of the build agent). */
  jobFlaky: boolean
  hasReport: boolean
}

export type BuildWebTestRunDetail = {
  run: BuildWebTestRun
  delta: BuildWebTestDelta
  summary: BuildWebTestRunSummary
  breakdown: BuildWebTestJobBreakdown[]
}

export type BuildWebTestCase = {
  key: string
  jobId: string
  suite: string
  name: string
  status: string
  durationMs: number | null
  retries: number
  /** Passed, but only after a retry. */
  flaky: boolean
  failureMessage: string | null
  change: BuildWebTestTransition | null
}

export type BuildWebTestFile = {
  /** '' for the tests with no file. */
  file: string
  passed: number
  failed: number
  skipped: number
  flaky: number
  durationMs: number
  tests: BuildWebTestCase[]
}

export type BuildWebTestWorkspace = { workspace: string; files: BuildWebTestFile[] }

export type BuildWebTestCasePoint = {
  runId: string
  createdAt: string | null
  commitSha: string | null
  status: string
  durationMs: number | null
  retries: number
}

export type BuildWebTestCaseHistory = {
  key: string
  name: string | null
  workspace: string | null
  /** Oldest first. */
  points: BuildWebTestCasePoint[]
  flips: number
  avgDurationMs: number | null
}

/** The newest finished nightly run of master, for the Testing item's badge. */
export type BuildWebLastNightly = {
  runId: string
  created_at: string
  commit_sha: string | null
  /** Failed tests (cases) of that run. */
  failed: number
}
