import { describe, expect, it } from 'vitest'
import type {
  BuildWebConsoleTask,
  BuildWebNotification
} from '../../../../../shared/build-web-activity-types'
import { buildPageUrl, notificationTarget, taskTarget } from './activity-targets'

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
  build_url: null,
  user: null,
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

  it('leads a train failure to its train by the name in its title', () => {
    const title = 'Поезд «master rhel»: не удался шаг «сборка»'
    expect(notificationTarget(note({ kind: 'train', title }))).toEqual({
      kind: 'train',
      trainName: 'master rhel',
      at: '2026-10-21T09:00:00Z'
    })
    expect(notificationTarget(note({ kind: 'train', title: 'Train failed' }))).toEqual({
      kind: 'train',
      trainName: null,
      at: '2026-10-21T09:00:00Z'
    })
  })
})

describe('where a task leads', () => {
  it('sends a build run to its card and a test run to the Testing page', () => {
    expect(taskTarget(task({ source: 'build', id: 'r1', kind: 'build' }))).toEqual({
      kind: 'run',
      runId: 'r1',
      tab: 'build'
    })
    expect(taskTarget(task({ source: 'test', id: 't/1', kind: 'test' }))).toEqual({
      kind: 'test-run',
      runId: 't/1'
    })
  })

  it('opens a console job as its log, and nothing without one', () => {
    expect(taskTarget(task({ kind: 'shots' }))).toEqual({ kind: 'job', jobId: 'j1' })
    expect(taskTarget(task({ has_log: false }))).toBeNull()
  })
})

describe('a redos build row (IS-10)', () => {
  const redos = task({
    key: 'redos:r1:dc/app|master',
    source: 'build',
    id: 'r1',
    kind: 'redos',
    title: 'Redos dc/app #7'
  })

  it('opens its run’s card, as any build row', () => {
    expect(taskTarget(redos)).toEqual({ kind: 'run', runId: 'r1', tab: 'build' })
  })

  it('has its build’s page: Jenkins as is, a console path on the console', () => {
    const base = 'https://bw.test'
    const jenkins = 'https://ci.test/job/redos/7/'
    expect(buildPageUrl({ ...redos, build_url: jenkins }, base)).toBe(jenkins)
    expect(buildPageUrl({ ...redos, build_url: '/api/agent-jobs/a1/log' }, base)).toBe(
      'https://bw.test/api/agent-jobs/a1/log'
    )
    expect(buildPageUrl(redos, base)).toBeNull()
    expect(buildPageUrl({ ...redos, build_url: 'javascript:alert(1)' }, base)).toBeNull()
  })
})
