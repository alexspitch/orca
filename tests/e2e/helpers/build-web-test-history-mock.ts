import type http from 'node:http'

// build-web's test history for the console mock: 45 runs (a nightly one today, a recheck
// yesterday, the rest started by hand), one nightly run's detail, a workspace and a test.

export const TEST_RUN_COUNT = 45

const at = (daysAgo: number, hour: number) => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour).toISOString()
}

const scope = (workspace: string, status = 'passed') => ({
  workspace,
  suite_variant: 'mocha',
  status,
  selection: { mode: 'all' }
})

const NIGHTLY = {
  id: 'run-nightly-1',
  created_at: at(0, 3),
  user: 'nightly',
  exec_mode: 'agent-nightly',
  branch: 'master',
  commit_sha: 'abcdef1234567',
  dirty: false,
  status: 'failed',
  totals: { passed: 40, failed: 2, skipped: 3, jobs: 3 },
  jobs: [
    scope('packages/model-adapters', 'failed'),
    scope('applications/dc-ui'),
    scope('plugins/sa-plugin-wfm/backend')
  ]
}

function runs(): Record<string, unknown>[] {
  const manual = Array.from({ length: TEST_RUN_COUNT - 2 }, (_, i) => ({
    ...NIGHTLY,
    id: `run-manual-${String(i + 1).padStart(2, '0')}`,
    created_at: at(2 + Math.floor(i / 4), 12 - (i % 4)),
    user: 'qa@box.test',
    exec_mode: 'worktree',
    status: 'passed',
    totals: { passed: 5, failed: 0, skipped: 0, jobs: 1 },
    jobs: [
      {
        ...scope('packages/model-adapters'),
        selection: { mode: 'files', files: [`src/case-${i + 1}.test.ts`] }
      }
    ]
  }))
  const recheck = {
    ...NIGHTLY,
    id: 'run-recheck-1',
    created_at: at(1, 4),
    exec_mode: 'agent-recheck',
    status: 'passed'
  }
  return [NIGHTLY, recheck, ...manual]
}

const row = (key: string, change: string, was: string | null, now: string | null) => ({
  key,
  name: key.split('::').at(-1),
  workspace: key.split('|')[0],
  was,
  now,
  change
})

const DETAIL = {
  run: { ...NIGHTLY, jobs: undefined },
  jobs: NIGHTLY.jobs.map((j, i) => ({ id: `job-${i + 1}`, ...j })),
  delta: {
    previousRunId: 'run-nightly-0',
    comparable: true,
    rows: [
      row('packages/model-adapters|mocha|a.test.ts::splits a stream', 'broken', 'passed', 'failed'),
      row(
        'packages/model-adapters|mocha|a.test.ts::keeps the tail',
        'still_failing',
        'failed',
        'failed'
      ),
      row(
        'applications/dc-ui|mocha|b.test.ts::renders the agent list',
        'fixed',
        'failed',
        'passed'
      ),
      row('applications/dc-ui|mocha|c.test.ts::opens the editor', 'new', null, 'passed'),
      row(
        'applications/dc-ui|mocha|c.test.ts::retries the socket',
        'unchanged',
        'passed',
        'passed'
      ),
      row('applications/dc-ui|mocha|c.test.ts::draws the chart', 'unchanged', 'passed', 'passed')
    ]
  },
  flaky: [{ key: 'applications/dc-ui|mocha|c.test.ts::retries the socket', retries: 2, flips: 0 }]
}

const job = (i: number, workspace: string, over: Record<string, unknown>) => ({
  jobId: `job-${i}`,
  workspace,
  variant: 'mocha',
  jobStatus: 'passed',
  durationMs: 61_000,
  passed: 10,
  failed: 0,
  skipped: 0,
  flaky: 0,
  jobFlaky: false,
  hasReport: true,
  ...over
})

const BREAKDOWN = {
  summary: {
    workspaces: 3,
    passed: 40,
    failed: 2,
    skipped: 3,
    flaky: 1,
    durationMs: 183_000,
    redWorkspaces: 1
  },
  jobs: [
    job(1, 'packages/model-adapters', { jobStatus: 'failed', passed: 8, failed: 2 }),
    job(2, 'applications/dc-ui', { passed: 22, flaky: 1 }),
    job(3, 'plugins/sa-plugin-wfm/backend', { skipped: 3 })
  ]
}

const test = (
  name: string,
  status: string,
  change: string | null,
  failureMessage: string | null = null
) => ({
  key: `packages/model-adapters|mocha|a.test.ts::${name}`,
  jobId: 'job-1',
  suite: 'stream',
  name,
  status,
  durationMs: 120,
  retries: 0,
  flaky: false,
  failureMessage,
  change
})

const WORKSPACE = {
  workspace: 'packages/model-adapters',
  previousRunId: 'run-nightly-0',
  files: [
    {
      file: 'src/a.test.ts',
      passed: 1,
      failed: 2,
      skipped: 0,
      flaky: 0,
      durationMs: 360,
      tests: [
        test(
          'splits a stream',
          'failed',
          'broken',
          'AssertionError: expected 2 to equal 3\n    at a.test.ts:12'
        ),
        test('keeps the tail', 'failed', 'still_failing', 'Timeout of 2000ms exceeded'),
        test('reads the head', 'passed', 'unchanged')
      ]
    },
    {
      file: 'src/b.test.ts',
      passed: 7,
      failed: 0,
      skipped: 0,
      flaky: 0,
      durationMs: 840,
      tests: []
    }
  ],
  disappeared: []
}

const LOG =
  'mocha --reporter json\n  stream\n    ✓ reads the head\n    1) splits a stream\n2 failing\n'

/** Answers a `/api/tests/…` request, or returns false for a path it does not know. */
export function serveTestHistory(
  res: http.ServerResponse,
  path: string,
  url: URL,
  json: (res: http.ServerResponse, status: number, body: unknown) => void
): boolean {
  if (path === '/api/tests/history') {
    json(res, 200, { runs: runs() })
  } else if (path === '/api/tests/nightly') {
    // A nightly run under way is passed over: the badge counts the newest one that finished.
    const running = { ...NIGHTLY, id: 'run-nightly-2', status: 'running', totals: {} }
    json(res, 200, { runs: [running, NIGHTLY].map(({ jobs: _jobs, ...run }) => run), open: [] })
  } else if (path === '/api/tests/history/case') {
    const key = url.searchParams.get('key') ?? ''
    json(res, 200, {
      key,
      name: key.split('::').at(-1),
      workspace: key.split('|')[0],
      points: Array.from({ length: 14 }, (_, i) => ({
        runId: `run-${i}`,
        createdAt: at(14 - i, 3),
        commitSha: 'abcdef1',
        status: i === 13 || i === 6 ? 'failed' : 'passed',
        durationMs: 100 + i * 10,
        retries: 0
      })),
      flips: 1,
      avgDurationMs: 165
    })
  } else if (path === `/api/tests/history/${NIGHTLY.id}`) {
    json(res, 200, DETAIL)
  } else if (path === `/api/tests/history/${NIGHTLY.id}/breakdown`) {
    json(res, 200, BREAKDOWN)
  } else if (
    path === `/api/tests/history/${NIGHTLY.id}/breakdown/${encodeURIComponent(WORKSPACE.workspace)}`
  ) {
    json(res, 200, WORKSPACE)
  } else if (/^\/api\/tests\/runs\/[^/]+\/jobs\/[^/]+\/log$/.test(path)) {
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const size = Buffer.byteLength(LOG)
    json(
      res,
      200,
      offset >= size ? { offset: size, size, text: '' } : { offset: size, size, text: LOG }
    )
  } else {
    return false
  }
  return true
}
