import type http from 'node:http'

// build-web's bell and task list, as the console's toolbar reads them: two unread rows (one on the
// task of the issues mock), a console error already read, and two tasks going and one finished.

export const activityCalls: string[] = []

let seen = false
let cleared = false
// Rows that arrive after Orca first read the bell.
const arrived: Record<string, unknown>[] = []

export function resetActivityMock(): void {
  activityCalls.length = 0
  seen = false
  cleared = false
  arrived.length = 0
}

/** A new row under the bell: a comment on IS-900, unread. */
export function arriveNotification(id: string, title: string): void {
  arrived.unshift({
    id,
    kind: 'comment',
    severity: 'info',
    title,
    body: 'Please retest on the stand.',
    issue_id: 'iss-files',
    issue_key: 'IS-900',
    issue_product: 'dc',
    run_id: null,
    job_id: null,
    recipient: 'qa@box.test',
    count: 1,
    created_at: '2026-10-21T10:00:00Z',
    last_at: '2026-10-21T10:00:00Z',
    unread: true
  })
}

const NOTIFICATIONS = [
  {
    id: 'n-comment',
    kind: 'comment',
    severity: 'info',
    title: 'qa@box.test commented on IS-900',
    body: 'The stand still drops calls after the restart.',
    issue_id: 'iss-files',
    issue_key: 'IS-900',
    issue_product: 'dc',
    run_id: null,
    job_id: null,
    recipient: 'qa@box.test',
    count: 1,
    created_at: '2026-10-21T08:00:00Z',
    last_at: '2026-10-21T08:00:00Z'
  },
  {
    id: 'n-build',
    kind: 'build',
    severity: 'error',
    title: 'Image build failed: dc/ib-script-engine (rhel)',
    body: 'dc/ib-script-engine (rhel) [release/3.1] — FAILURE #812\nhttps://jenkins.test/job/dc/812/',
    issue_id: null,
    issue_key: null,
    issue_product: null,
    run_id: 'run-x',
    job_id: null,
    recipient: null,
    count: 3,
    created_at: '2026-10-21T07:00:00Z',
    last_at: '2026-10-21T07:30:00Z'
  },
  {
    id: 'n-runtime',
    kind: 'runtime',
    severity: 'warning',
    title: 'Console error: Jira did not answer',
    body: '',
    issue_id: null,
    issue_key: null,
    issue_product: null,
    run_id: null,
    job_id: null,
    recipient: null,
    count: 1,
    created_at: '2026-10-20T07:00:00Z',
    last_at: '2026-10-20T07:00:00Z'
  }
]

const TASKS = [
  {
    key: 'deploy:job-1',
    source: 'deploy',
    id: 'job-1',
    kind: 'restart',
    title: 'Restart services on 3.1 box DC',
    detail: 'ib-script-engine',
    status: 'running',
    active: true,
    user: 'qa@box.test',
    created_at: '2026-10-21T08:10:00Z',
    started_at: '2026-10-21T08:10:02Z',
    finished_at: null,
    error: null,
    has_log: true,
    can_cancel: true,
    run_id: null,
    stand_id: 'c-dc'
  },
  {
    key: 'build:run-x',
    source: 'build',
    id: 'run-x',
    kind: 'build',
    title: 'Image build IS-900',
    detail: 'release/3.1 · 2 images',
    status: 'running',
    active: true,
    user: 'qa@box.test',
    created_at: '2026-10-21T08:00:00Z',
    started_at: '2026-10-21T08:00:00Z',
    finished_at: null,
    error: null,
    has_log: false,
    can_cancel: false,
    run_id: 'run-x',
    stand_id: null
  },
  {
    key: 'test:t-1',
    source: 'test',
    id: 't-1',
    kind: 'test',
    title: 'Nightly tests dc',
    detail: '412 passed · 3 failed',
    status: 'partial',
    active: false,
    user: 'scheduler',
    created_at: '2026-10-21T02:00:00Z',
    started_at: '2026-10-21T02:00:00Z',
    finished_at: '2026-10-21T03:10:00Z',
    error: null,
    has_log: false,
    can_cancel: false,
    run_id: null,
    stand_id: null
  }
]

export function serveActivity(
  res: http.ServerResponse,
  path: string,
  json: (res: http.ServerResponse, status: number, body: unknown) => void
): boolean {
  if (path === '/api/notifications') {
    activityCalls.push('notifications')
    const rows = [
      ...arrived,
      ...(cleared
        ? []
        : NOTIFICATIONS.map((n) => ({ ...n, unread: !seen && n.id !== 'n-runtime' })))
    ]
    json(res, 200, { notifications: rows, unread: rows.filter((n) => n.unread).length })
  } else if (path === '/api/notifications/seen') {
    activityCalls.push('seen')
    seen = true
    json(res, 200, { ok: true })
  } else if (path === '/api/notifications/clear') {
    activityCalls.push('clear')
    seen = true
    cleared = true
    json(res, 200, { ok: true })
  } else if (path === '/api/tasks') {
    activityCalls.push('tasks')
    json(res, 200, { tasks: TASKS })
  } else {
    return false
  }
  return true
}
