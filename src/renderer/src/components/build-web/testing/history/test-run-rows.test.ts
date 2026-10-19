import { describe, expect, it } from 'vitest'
import type {
  BuildWebTestJobScope,
  BuildWebTestRun
} from '../../../../../../shared/build-web-test-history-types'
import {
  dayLabel,
  familyOf,
  runDays,
  runsOfKind,
  runTitle,
  shortWorkspace,
  summarize,
  testName
} from './test-run-rows'

function job(workspace: string, selection: BuildWebTestJobScope['selection'] = { mode: 'all' }) {
  return { workspace, suite_variant: 'mocha', status: 'passed', selection }
}

function run(patch: Partial<BuildWebTestRun>): BuildWebTestRun {
  return {
    id: 'abcdef12-3456',
    created_at: '2026-10-19T10:00:00.000Z',
    user: 'a@b.c',
    exec_mode: 'worktree',
    branch: 'master',
    commit_sha: 'abcdef1234',
    dirty: false,
    status: 'passed',
    totals: { passed: 0, failed: 0, skipped: 0, jobs: 0 },
    jobs: [],
    ...patch
  }
}

describe('a run in the list', () => {
  it('keeps the nightly and recheck runs apart from the ones started on the console', () => {
    const runs = [
      run({ id: 'n', exec_mode: 'agent-nightly' }),
      run({ id: 'r', exec_mode: 'agent-recheck' }),
      run({ id: 'm', exec_mode: 'working-tree' })
    ]
    expect(runsOfKind(runs, 'all').map((r) => r.id)).toEqual(['n', 'r', 'm'])
    expect(runsOfKind(runs, 'nightly').map((r) => r.id)).toEqual(['n', 'r'])
    expect(runsOfKind(runs, 'manual').map((r) => r.id)).toEqual(['m'])
  })

  it('is named after what it ran', () => {
    expect(
      runTitle(run({ exec_mode: 'agent-nightly', jobs: [job('packages/a'), job('packages/b')] }))
    ).toEqual({
      title: 'Nightly run of master',
      sub: '2 workspace(s)'
    })
    expect(runTitle(run({ jobs: [job('applications/dc-ui')] }))).toEqual({
      title: 'dc-ui',
      sub: 'dc-ui · whole suite'
    })
    expect(
      runTitle(run({ jobs: [job('packages/a', { mode: 'tests', tests: ['t.test.ts::x :: y'] })] }))
        .title
    ).toBe('x :: y')
    expect(
      runTitle(
        run({
          jobs: [job('packages/a', { mode: 'files', files: ['src/a.test.ts'] }), job('packages/a')]
        })
      )
    ).toEqual({ title: 'a.test.ts and 1 more', sub: 'a' })
    expect(runTitle(run({ jobs: [] })).title).toBe('abcdef12')
  })

  it('says what it came to', () => {
    expect(summarize(run({ totals: { passed: 3, failed: 1, skipped: 0, jobs: 2 } }))).toBe(
      '3 passed · 1 failed'
    )
    expect(summarize(run({ totals: { passed: 0, failed: 0, skipped: 0, jobs: 2 } }))).toBe(
      '2 job(s), no results'
    )
  })

  it('is grouped by day, newest first', () => {
    const now = new Date(2026, 9, 19, 12)
    const runs = [
      run({ id: 'a', created_at: new Date(2026, 9, 19, 9).toISOString() }),
      run({ id: 'b', created_at: new Date(2026, 9, 19, 1).toISOString() }),
      run({ id: 'c', created_at: new Date(2026, 9, 18, 23).toISOString() }),
      run({ id: 'd', created_at: new Date(2025, 0, 2).toISOString() })
    ]
    const days = runDays(runs, 'en-US', now)
    expect(days.map((d) => [d.label, d.runs.map((r) => r.id)])).toEqual([
      ['Today, October 19', ['a', 'b']],
      ['Yesterday, October 18', ['c']],
      ['January 2, 2025', ['d']]
    ])
    expect(dayLabel('not a date', 'en-US', now)).toBe('—')
  })
})

describe('names', () => {
  it('reads a workspace and its family from its path', () => {
    expect(shortWorkspace('plugins/sa-plugin-wfm/backend')).toBe('sa-plugin-wfm/backend')
    expect(shortWorkspace('packages/model-adapters')).toBe('model-adapters')
    expect(familyOf('plugins/sa-plugin-wfm/backend')).toBe('plugins')
    expect(familyOf('tools/build-web')).toBe('other')
    expect(familyOf('other/x')).toBe('other')
  })

  it('cuts a pytest id at its last separator and a mocha id at its first', () => {
    expect(testName('tests/test_x.py::Class::test_y')).toBe('test_y')
    expect(testName('src/a.test.ts::suite :: case')).toBe('suite :: case')
    expect(testName('plain')).toBe('plain')
  })
})
