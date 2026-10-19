import type {
  BuildWebLastNightly,
  BuildWebTestCaseHistory,
  BuildWebTestRun,
  BuildWebTestRunDetail,
  BuildWebTestWorkspace
} from '../../shared/build-web-test-history-types'
import { BUILD_WEB_TEST_RUN_TIMEOUT_MS } from '../../shared/build-web-timeouts'
import { requireBuildWebCredential } from './build-web-connection'
import { BuildWebApiError, buildWebRequest, type BuildWebResponseLimit } from './build-web-request'
import { recordOf } from './build-web-response-fields'
import {
  lastNightlyOf,
  testBreakdownOf,
  testCaseHistoryOf,
  testDeltaOf,
  testFilesOf,
  testRunOf,
  testRunsOf,
  testSummaryOf
} from './build-web-test-history-model'

// build-web's test history for the «Test history» tab of Testing: the newest runs, one run, the
// tests of one of its workspaces, and one test across runs.

// Why larger than a reply: main cuts a nightly run's delta (~33k rows) down before it crosses RPC.
const DETAIL_LIMIT: BuildWebResponseLimit = { bytes: 64 * 1024 * 1024, structuralTokens: 8_000_000 }
const CASE_POINTS = 14

const enc = encodeURIComponent

/** A console without test history answers 404 from its SPA fallback; worded as "update". */
function olderConsole(error: unknown): unknown {
  return error instanceof BuildWebApiError && error.routeMissing
    ? new BuildWebApiError(
        'This build-web has no test history yet. Update the console.',
        error.status,
        [],
        true
      )
    : error
}

async function read(
  path: string,
  extra: { responseLimit?: BuildWebResponseLimit; timeoutMs?: number } = {}
): Promise<unknown> {
  try {
    return await buildWebRequest({ ...requireBuildWebCredential(), path, ...extra })
  } catch (error) {
    throw olderConsole(error)
  }
}

/** The newest runs the console keeps in its history, newest first. */
export async function listBuildWebTestRuns(): Promise<BuildWebTestRun[]> {
  return testRunsOf(await read('/api/tests/history'))
}

/** One run with its delta to the run before and its breakdown by workspace; null when gone. */
export async function getBuildWebTestRun(runId: string): Promise<BuildWebTestRunDetail | null> {
  const id = enc(runId)
  const extra = { responseLimit: DETAIL_LIMIT, timeoutMs: BUILD_WEB_TEST_RUN_TIMEOUT_MS }
  let detail: unknown
  let breakdown: unknown
  try {
    ;[detail, breakdown] = await Promise.all([
      read(`/api/tests/history/${id}`, extra),
      read(`/api/tests/history/${id}/breakdown`, extra)
    ])
  } catch (error) {
    if (error instanceof BuildWebApiError && error.status === 404 && !error.routeMissing) {
      return null
    }
    throw error
  }
  const d = recordOf(detail)
  // Why: the detail's `run` is a bare row; the job scopes that name it come as its `jobs`.
  const run = testRunOf({ ...recordOf(d?.run), jobs: d?.jobs })
  if (!run) {
    return null
  }
  const b = recordOf(breakdown)
  return {
    run,
    delta: testDeltaOf(d?.delta, d?.flaky),
    summary: testSummaryOf(b?.summary),
    breakdown: testBreakdownOf(b?.jobs)
  }
}

/** The files and tests of one workspace of a run, each with its change against the run before. */
export async function getBuildWebTestWorkspace(
  runId: string,
  workspace: string
): Promise<BuildWebTestWorkspace> {
  const answer = await read(`/api/tests/history/${enc(runId)}/breakdown/${enc(workspace)}`, {
    responseLimit: DETAIL_LIMIT
  })
  return { workspace, files: testFilesOf(answer) }
}

/** What one test did over its last runs. */
export async function getBuildWebTestCase(key: string): Promise<BuildWebTestCaseHistory> {
  return testCaseHistoryOf(
    await read(`/api/tests/history/case?key=${enc(key)}&limit=${CASE_POINTS}`),
    key
  )
}

/** The newest finished nightly run and how many of its tests failed; null before the first one. */
export async function getBuildWebLastNightly(): Promise<BuildWebLastNightly | null> {
  return lastNightlyOf(await read('/api/tests/nightly'))
}
