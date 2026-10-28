import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RequestModule from './build-web-request'

// The titlebar's bell and task counter: what is read, what an older console or a refusal hides.

const mocks = vi.hoisted(() => {
  const credentialOptions: unknown[] = []
  return {
    request: vi.fn<(request: { path: string; method?: string }) => Promise<unknown>>(),
    credentialOptions
  }
})

vi.mock('./build-web-connection', () => ({
  requireBuildWebCredential: (options?: unknown) => {
    mocks.credentialOptions.push(options)
    return { baseUrl: 'https://bw.test', token: 't', generation: 1 }
  }
}))
vi.mock('./build-web-request', async (importOriginal) => ({
  ...(await importOriginal<typeof RequestModule>()),
  buildWebRequest: mocks.request
}))

const { BuildWebApiError } = await import('./build-web-request')
const { clearBuildWebNotifications, markBuildWebNotificationsSeen, readBuildWebActivity } =
  await import('./build-web-activity')

const note = (over: Record<string, unknown>) => ({
  id: 'n1',
  kind: 'build',
  severity: 'error',
  title: 'Image build failed: dc/app (rhel)',
  body: 'FAILURE #12',
  issue_id: 'i1',
  issue_key: 'IS-10',
  issue_product: 'dc',
  run_id: 'r1',
  job_id: null,
  recipient: null,
  count: 2,
  created_at: '2026-10-21T08:00:00Z',
  last_at: '2026-10-21T09:00:00Z',
  unread: true,
  ...over
})

const task = (over: Record<string, unknown>) => ({
  key: 'deploy:j1',
  source: 'deploy',
  id: 'j1',
  kind: 'restart',
  title: 'Restart on box',
  detail: 'IS-10',
  status: 'running',
  active: true,
  user: 'qa@box.test',
  created_at: '2026-10-21T09:00:00Z',
  started_at: '2026-10-21T09:00:05Z',
  finished_at: null,
  error: null,
  has_log: true,
  can_cancel: true,
  run_id: null,
  stand_id: 's1',
  ...over
})

beforeEach(() => {
  mocks.request.mockReset()
  mocks.credentialOptions.length = 0
})

describe('reading the bell and the tasks', () => {
  it('reads both lists, keeps known rows and clips a long body', async () => {
    mocks.request.mockImplementation(async ({ path }) =>
      path.startsWith('/api/notifications')
        ? {
            notifications: [
              note({}),
              note({ id: 'n2', severity: 'loud', body: 'x'.repeat(5000), unread: false }),
              note({ id: 7 })
            ],
            unread: 1
          }
        : {
            tasks: [
              task({}),
              task({ key: 'build:r1', source: 'build', id: 'r1', status: 'success' }),
              task({ key: 'x:1', source: 'chat' }),
              task({ key: 'deploy:j2', id: 'j2', status: 'paused' })
            ]
          }
    )
    const activity = await readBuildWebActivity()
    expect(mocks.credentialOptions).toEqual([{ background: true }])
    expect(mocks.request.mock.calls.map(([r]) => r.path).sort()).toEqual([
      '/api/notifications?limit=30',
      '/api/tasks?limit=10'
    ])
    expect(activity.baseUrl).toBe('https://bw.test')
    expect(activity.notifications?.unread).toBe(1)
    expect(activity.notifications?.items.map((n) => n.id)).toEqual(['n1', 'n2'])
    expect(activity.notifications?.items[0]).toEqual({
      id: 'n1',
      kind: 'build',
      severity: 'error',
      title: 'Image build failed: dc/app (rhel)',
      body: 'FAILURE #12',
      issue_id: 'i1',
      issue_key: 'IS-10',
      run_id: 'r1',
      count: 2,
      last_at: '2026-10-21T09:00:00Z',
      unread: true
    })
    // An unknown severity reads as a failure; the body is cut to what the menu can show.
    expect(activity.notifications?.items[1].severity).toBe('error')
    expect(activity.notifications?.items[1].body).toHaveLength(600)
    expect(activity.tasks?.map((t) => t.key)).toEqual(['deploy:j1', 'build:r1'])
    expect(activity.tasks?.[0]).toEqual({
      key: 'deploy:j1',
      source: 'deploy',
      id: 'j1',
      kind: 'restart',
      title: 'Restart on box',
      detail: 'IS-10',
      status: 'running',
      active: true,
      created_at: '2026-10-21T09:00:00Z',
      started_at: '2026-10-21T09:00:05Z',
      finished_at: null,
      has_log: true,
      build_url: null
    })
  })

  it('reads the page of a redos build, absent from an older console', async () => {
    const redos = {
      key: 'redos:r1:dc/app|master',
      source: 'build',
      id: 'r1',
      kind: 'redos',
      build_url: '/api/agent-jobs/a1/log'
    }
    mocks.request.mockImplementation(async ({ path }) =>
      path.startsWith('/api/tasks')
        ? { tasks: [task(redos), task({ key: 'build:r2', source: 'build', id: 'r2' })] }
        : { notifications: [], unread: 0 }
    )
    const { tasks } = await readBuildWebActivity()
    expect(tasks?.map((t) => [t.key, t.build_url])).toEqual([
      ['redos:r1:dc/app|master', '/api/agent-jobs/a1/log'],
      ['build:r2', null]
    ])
  })

  it('hides a list the console lacks or refuses, and keeps the other', async () => {
    mocks.request.mockImplementation(async ({ path }) => {
      if (path.startsWith('/api/notifications')) {
        throw new BuildWebApiError('Not Found', 404, [], true)
      }
      return { tasks: [task({})] }
    })
    const older = await readBuildWebActivity()
    expect(older.notifications).toBeNull()
    expect(older.tasks).toHaveLength(1)

    mocks.request.mockImplementation(async ({ path }) => {
      if (path.startsWith('/api/tasks')) {
        throw new BuildWebApiError('Forbidden', 403)
      }
      return { notifications: [], unread: 0 }
    })
    const noRights = await readBuildWebActivity()
    expect(noRights.tasks).toBeNull()
    expect(noRights.notifications).toEqual({ items: [], unread: 0 })
  })

  it('fails as a whole when the console cannot be reached or rejects the token', async () => {
    mocks.request.mockRejectedValue(new BuildWebApiError('token is unknown', 401))
    await expect(readBuildWebActivity()).rejects.toThrow('token is unknown')
  })
})

describe('marking the bell read and clearing it', () => {
  it('posts to the console and reports a refusal as a value', async () => {
    mocks.request.mockResolvedValue({ ok: true })
    expect(await markBuildWebNotificationsSeen()).toEqual({ ok: true, value: true })
    expect(await clearBuildWebNotifications()).toEqual({ ok: true, value: true })
    expect(mocks.request.mock.calls.map(([r]) => `${r.method} ${r.path}`)).toEqual([
      'POST /api/notifications/seen',
      'POST /api/notifications/clear'
    ])

    mocks.request.mockRejectedValue(new BuildWebApiError('need to sign in', 401))
    expect(await clearBuildWebNotifications()).toMatchObject({ ok: false, status: 401 })
  })
})
