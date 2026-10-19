import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RequestModule from './build-web-request'

// The «Test history» tab's reads: the runs, one run cut down for RPC, a workspace, one test.

const mocks = vi.hoisted(() => ({
  request: vi.fn<(request: { path: string; responseLimit?: unknown }) => Promise<unknown>>()
}))

vi.mock('./build-web-connection', () => ({
  requireBuildWebCredential: () => ({ baseUrl: 'https://bw.test', token: 't', generation: 1 })
}))
vi.mock('./build-web-request', async (importOriginal) => ({
  ...(await importOriginal<typeof RequestModule>()),
  buildWebRequest: mocks.request
}))

const { BuildWebApiError } = await import('./build-web-request')
const { DELTA_ROWS_MAX } = await import('./build-web-test-history-model')
const {
  getBuildWebLastNightly,
  getBuildWebTestCase,
  getBuildWebTestRun,
  getBuildWebTestWorkspace,
  listBuildWebTestRuns
} = await import('./build-web-test-history')

function answer(paths: Record<string, unknown>): void {
  mocks.request.mockImplementation(async ({ path }) => {
    const value = paths[path]
    if (value instanceof Error) {
      throw value
    }
    return value
  })
}

const RUN = {
  id: 'r2',
  created_at: '2026-10-19T16:51:30.469Z',
  user: 'nightly',
  exec_mode: 'agent-nightly',
  branch: 'master',
  commit_sha: 'abcdef1234',
  dirty: false,
  status: 'failed',
  totals: { passed: 3, failed: '1', skipped: 0, jobs: 2 }
}

beforeEach(() => {
  mocks.request.mockReset()
})

describe('the runs', () => {
  it('reads every run with its job scopes, a selection it does not know as the whole suite', async () => {
    answer({
      '/api/tests/history': {
        runs: [
          {
            ...RUN,
            jobs: [
              {
                workspace: 'packages/a',
                suite_variant: 'mocha',
                status: 'passed',
                selection: null
              },
              {
                workspace: 'packages/b',
                suite_variant: 'jest',
                status: 'failed',
                selection: { mode: 'files', files: ['x.test.ts', 7] }
              },
              {
                workspace: 'e2e/c',
                suite_variant: 'pw',
                status: 'passed',
                selection: { mode: '?' }
              }
            ]
          },
          { id: 5 }
        ]
      }
    })
    const runs = await listBuildWebTestRuns()
    expect(runs).toHaveLength(1)
    expect(runs[0].totals).toEqual({ passed: 3, failed: 1, skipped: 0, jobs: 2 })
    expect(runs[0].jobs.map((j) => j.selection)).toEqual([
      { mode: 'all' },
      { mode: 'files', files: ['x.test.ts'] },
      { mode: 'all' }
    ])
  })

  it('says to update a console that has no test history', async () => {
    answer({ '/api/tests/history': new BuildWebApiError('Not Found', 404, [], true) })
    await expect(listBuildWebTestRuns()).rejects.toThrow('no test history yet')
  })
})

describe('one run', () => {
  const row = (key: string, change: string, was: string | null = 'passed', now = 'passed') => ({
    key,
    name: `name ${key}`,
    workspace: 'packages/a',
    was,
    now,
    change
  })

  it('names the run from its jobs, counts the whole delta and keeps only the changed rows', async () => {
    answer({
      '/api/tests/history/r2': {
        run: RUN,
        jobs: [{ id: 'j1', workspace: 'packages/a', suite_variant: 'mocha', status: 'failed' }],
        delta: {
          previousRunId: 'r1',
          comparable: true,
          rows: [
            row('u1', 'unchanged'),
            row('u2', 'unchanged'),
            row('f1', 'unchanged'),
            row('n1', 'new', null),
            row('b1', 'broken', 'passed', 'failed'),
            row('x1', 'nonsense')
          ]
        },
        flaky: [{ key: 'f1', retries: 2, flips: 0 }]
      },
      '/api/tests/history/r2/breakdown': {
        summary: {
          workspaces: 1,
          passed: 3,
          failed: 1,
          skipped: 0,
          flaky: 1,
          durationMs: 900,
          redWorkspaces: 1
        },
        jobs: [
          {
            jobId: 'j1',
            workspace: 'packages/a',
            variant: 'mocha',
            jobStatus: 'failed',
            passed: 3,
            failed: 1,
            skipped: 0,
            flaky: 1,
            jobFlaky: false,
            hasReport: true,
            durationMs: 900
          }
        ]
      }
    })
    const detail = await getBuildWebTestRun('r2')
    expect(detail?.run.jobs.map((j) => j.workspace)).toEqual(['packages/a'])
    expect(detail?.delta.counts).toEqual({ unchanged: 2, flaky: 1, new: 1, broken: 1 })
    expect(detail?.delta.rows.map((r) => [r.key, r.kind])).toEqual([
      ['b1', 'broken'],
      ['n1', 'new'],
      ['f1', 'flaky']
    ])
    expect(detail?.delta.rows[2].flaky).toEqual({ retries: 2, flips: 0 })
    expect(detail?.delta.omitted).toBe(0)
    expect(detail?.breakdown[0]).toMatchObject({ jobId: 'j1', hasReport: true })
    expect(detail?.summary.redWorkspaces).toBe(1)
  })

  it('cuts a delta past the cap and says how many rows it left out', async () => {
    const rows = Array.from({ length: DELTA_ROWS_MAX + 5 }, (_, i) => row(`k${i}`, 'new', null))
    answer({
      '/api/tests/history/r2': {
        run: RUN,
        jobs: [],
        delta: { previousRunId: 'r1', comparable: true, rows },
        flaky: []
      },
      '/api/tests/history/r2/breakdown': { summary: {}, jobs: [] }
    })
    const detail = await getBuildWebTestRun('r2')
    expect(detail?.delta.rows).toHaveLength(DELTA_ROWS_MAX)
    expect(detail?.delta.omitted).toBe(5)
    expect(detail?.delta.counts.new).toBe(DELTA_ROWS_MAX + 5)
  })

  it('is null for a run the console no longer has', async () => {
    answer({
      '/api/tests/history/gone': new BuildWebApiError('not found', 404),
      '/api/tests/history/gone/breakdown': { summary: {}, jobs: [] }
    })
    expect(await getBuildWebTestRun('gone')).toBeNull()
  })
})

describe('a workspace and a test', () => {
  it('asks for the workspace by its encoded path and shortens a long failure', async () => {
    answer({
      '/api/tests/history/r2/breakdown/plugins%2Fsa-plugin-x%2Fbackend': {
        files: [
          {
            file: 'a.test.ts',
            passed: 0,
            failed: 1,
            skipped: 0,
            flaky: 0,
            durationMs: 5,
            tests: [
              {
                key: 'k',
                jobId: 'j1',
                suite: 's',
                name: 'n',
                status: 'failed',
                retries: 0,
                flaky: false,
                failureMessage: 'x'.repeat(10_000),
                change: 'broken'
              }
            ]
          }
        ]
      }
    })
    const ws = await getBuildWebTestWorkspace('r2', 'plugins/sa-plugin-x/backend')
    const test = ws.files[0].tests[0]
    expect(test.change).toBe('broken')
    expect(test.failureMessage?.length).toBe(4_000)
  })

  it('reads the last runs of one test', async () => {
    answer({
      '/api/tests/history/case?key=a%7Cb%7Cc&limit=14': {
        key: 'a|b|c',
        name: 'c',
        workspace: 'a',
        points: [
          {
            runId: 'r1',
            createdAt: null,
            commitSha: 'abc',
            status: 'passed',
            durationMs: '12',
            retries: 0
          }
        ],
        flips: 1,
        avgDurationMs: '12.5'
      }
    })
    const card = await getBuildWebTestCase('a|b|c')
    expect(card.points[0].durationMs).toBe(12)
    expect(card.avgDurationMs).toBe(12.5)
    expect(card.flips).toBe(1)
  })
})

describe('the last nightly run', () => {
  const agentRun = (id: string, exec_mode: string, status: string, failed: unknown) => ({
    id,
    exec_mode,
    status,
    commit_sha: 'abc',
    created_at: '2026-10-19T03:00:00.000Z',
    totals: { passed: 10, failed }
  })

  it('counts the failed tests of the newest nightly run that finished, past a recheck and a running one', async () => {
    answer({
      '/api/tests/nightly': {
        runs: [
          agentRun('n3', 'agent-nightly', 'running', 0),
          agentRun('r1', 'agent-recheck', 'passed', 0),
          agentRun('n2', 'agent-nightly', 'interrupted', 0),
          agentRun('n1', 'agent-nightly', 'failed', '7'),
          agentRun('n0', 'agent-nightly', 'failed', 3)
        ]
      }
    })
    expect(await getBuildWebLastNightly()).toEqual({
      runId: 'n1',
      created_at: '2026-10-19T03:00:00.000Z',
      commit_sha: 'abc',
      failed: 7
    })
  })

  it('is null before the first nightly run has finished', async () => {
    answer({ '/api/tests/nightly': { runs: [agentRun('n1', 'agent-nightly', 'running', 0)] } })
    expect(await getBuildWebLastNightly()).toBeNull()
  })
})
