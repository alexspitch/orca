import { describe, expect, it } from 'vitest'
import type {
  BuildWebTestFile,
  BuildWebTestJobBreakdown
} from '../../../../../../shared/build-web-test-history-types'
import {
  breakdownJobs,
  durationText,
  filterFiles,
  keepJob,
  mapGroups,
  toneOf
} from './run-breakdown'

function job(patch: Partial<BuildWebTestJobBreakdown>): BuildWebTestJobBreakdown {
  return {
    jobId: patch.workspace ?? 'j',
    workspace: 'packages/a',
    variant: 'mocha',
    jobStatus: 'passed',
    durationMs: 10,
    passed: 1,
    failed: 0,
    skipped: 0,
    flaky: 0,
    jobFlaky: false,
    hasReport: false,
    ...patch
  }
}

describe('the breakdown of a run', () => {
  it('counts a red job as failed with no red case, and orders red, then retried, then by name', () => {
    const jobs = [
      job({ workspace: 'packages/z' }),
      job({ workspace: 'packages/y', flaky: 1 }),
      job({ workspace: 'packages/x', jobStatus: 'timeout', passed: 0 })
    ]
    expect(keepJob(jobs[2], 'failed')).toBe(true)
    expect(breakdownJobs(jobs, 'all').map((j) => j.workspace)).toEqual([
      'packages/x',
      'packages/y',
      'packages/z'
    ])
    expect(breakdownJobs(jobs, 'flaky').map((j) => j.workspace)).toEqual(['packages/y'])
  })

  it('keeps only the tests a filter asks for and drops a file left empty', () => {
    const test = (key: string, status: string, flaky = false) => ({
      key,
      jobId: 'j',
      suite: '',
      name: key,
      status,
      durationMs: 1,
      retries: flaky ? 1 : 0,
      flaky,
      failureMessage: null,
      change: null
    })
    const files: BuildWebTestFile[] = [
      {
        file: 'a',
        passed: 1,
        failed: 1,
        skipped: 0,
        flaky: 0,
        durationMs: 2,
        tests: [test('a1', 'passed'), test('a2', 'failed')]
      },
      {
        file: 'b',
        passed: 1,
        failed: 0,
        skipped: 0,
        flaky: 1,
        durationMs: 1,
        tests: [test('b1', 'passed', true)]
      }
    ]
    expect(filterFiles(files, 'failed').map((f) => f.tests.map((t) => t.key))).toEqual([['a2']])
    expect(filterFiles(files, 'flaky').map((f) => f.file)).toEqual(['b'])
    expect(filterFiles(files, 'all')).toHaveLength(2)
  })

  it('draws a workspace by its outcome and the map by family', () => {
    expect(toneOf(job({ passed: 0, jobStatus: 'empty' }))).toBe('failed')
    expect(toneOf(job({ passed: 0 }))).toBe('empty')
    expect(toneOf(job({ skipped: 2 }))).toBe('skipped')
    const groups = mapGroups([
      job({ workspace: 'plugins/sa-plugin-x/backend', failed: 1 }),
      job({ workspace: 'packages/b' }),
      job({ workspace: 'packages/a', skipped: 1 })
    ])
    expect(
      groups.map((g) => [g.family, g.jobs.map((j) => j.workspace), g.failed, g.skipped])
    ).toEqual([
      ['packages', ['packages/a', 'packages/b'], 0, 1],
      ['plugins', ['plugins/sa-plugin-x/backend'], 1, 0]
    ])
  })

  it('says a duration the way a person reads it', () => {
    expect(durationText(null)).toBe('—')
    expect(durationText(250)).toBe('250 ms')
    expect(durationText(12_300)).toBe('12.3 s')
    expect(durationText(5 * 60_000)).toBe('5 min')
    expect(durationText(125 * 60_000)).toBe('2 h 5 min')
  })
})
