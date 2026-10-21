import { describe, expect, it } from 'vitest'
import type {
  BuildWebConsoleTask,
  BuildWebNotification
} from '../../../../../shared/build-web-activity-types'
import { notificationTarget, taskTarget } from './activity-targets'

const note = (over: Partial<BuildWebNotification>): BuildWebNotification => ({
  id: 'n1',
  kind: 'build',
  severity: 'error',
  title: 'Image build failed',
  body: '',
  issue_id: null,
  issue_key: null,
  run_id: null,
  count: 1,
  last_at: '2026-10-21T09:00:00Z',
  unread: true,
  ...over
})

const task = (over: Partial<BuildWebConsoleTask>): BuildWebConsoleTask => ({
  key: 'deploy:j1',
  source: 'deploy',
  id: 'j1',
  kind: 'restart',
  title: 'Restart',
  detail: null,
  status: 'running',
  active: true,
  created_at: '2026-10-21T09:00:00Z',
  started_at: null,
  finished_at: null,
  has_log: true,
  ...over
})

describe('where a notification leads', () => {
  it('opens its task, on the Build tab for a build or a push', () => {
    expect(notificationTarget(note({ issue_id: 'i1', run_id: 'r1' }))).toEqual({
      kind: 'issue',
      issueId: 'i1',
      tab: 'build'
    })
    expect(notificationTarget(note({ kind: 'comment', issue_id: 'i1' }))).toEqual({
      kind: 'issue',
      issueId: 'i1',
      tab: 'overview'
    })
  })

  it('falls back to its run, and to nothing for a console error', () => {
    expect(notificationTarget(note({ kind: 'job', run_id: 'r1' }))).toEqual({
      kind: 'run',
      runId: 'r1',
      tab: 'build'
    })
    expect(notificationTarget(note({ kind: 'runtime' }))).toBeNull()
  })
})

describe('where a task leads', () => {
  it('sends a build run to its card and a test run to the console', () => {
    expect(taskTarget(task({ source: 'build', id: 'r1', kind: 'build' }))).toEqual({
      kind: 'run',
      runId: 'r1',
      tab: 'build'
    })
    expect(taskTarget(task({ source: 'test', id: 't/1', kind: 'test' }))).toEqual({
      kind: 'console',
      path: '/tests/runs/t%2F1'
    })
  })

  it('opens a console job as its log, and nothing without one', () => {
    expect(taskTarget(task({ kind: 'shots' }))).toEqual({ kind: 'job', jobId: 'j1' })
    expect(taskTarget(task({ has_log: false }))).toBeNull()
  })
})
