import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RequestModule from './build-web-request'

// The «Testing» page's reads: the watch list, from an older console and a newer one.

const mocks = vi.hoisted(() => ({
  request:
    vi.fn<(request: { method?: string; path: string; body?: unknown }) => Promise<unknown>>(),
  invalidate: vi.fn()
}))

vi.mock('./build-web-connection', () => ({
  requireBuildWebCredential: () => ({
    baseUrl: 'https://bw.test',
    token: 't',
    generation: 1
  })
}))
vi.mock('./build-web-images', () => ({
  invalidateBuildWebImageCatalog: mocks.invalidate
}))
vi.mock('./build-web-request', async (importOriginal) => ({
  ...(await importOriginal<typeof RequestModule>()),
  buildWebRequest: mocks.request
}))

const { checkBuildWebWatch, getBuildWebWatch } = await import('./build-web-watch')

const STATE = {
  enabled: true,
  interval_ms: 300_000,
  from_statuses: ['Testing', 'TESTING_EXTERNAL'],
  to_statuses: ['Done']
}

function answer(paths: Record<string, unknown>): void {
  mocks.request.mockImplementation(async ({ path }) => {
    const value = paths[path]
    if (value instanceof Error) {
      throw value
    }
    return value
  })
}

beforeEach(() => {
  mocks.request.mockReset()
  mocks.invalidate.mockReset()
})

describe('the watch list', () => {
  it('reads an older console: the ticket is the Jira key, the newer fields are unknown', async () => {
    answer({
      '/api/watch': {
        ...STATE,
        entries: [
          {
            ticket: 'SDAP-3931',
            status: 'Testing',
            status_changed_at: '2026-10-16T15:09:08.104Z',
            checked_at: '2026-10-18T19:28:25.568Z',
            last_action: null,
            last_action_at: null,
            issue_id: 'c78f',
            issue_key: 'SDAP-3931',
            run: {
              id: 'run 1',
              branch: 'master',
              created_at: '2026-09-24',
              unpushed: 1,
              pending: 0
            }
          },
          { status: 'Testing' }
        ]
      },
      '/api/me': { jiraBaseUrl: 'https://spitch.atlassian.net/' }
    })
    const state = await getBuildWebWatch()
    expect(state).toMatchObject(STATE)
    expect(state.entries).toHaveLength(1)
    expect(state.entries[0]).toMatchObject({
      ticket: 'SDAP-3931',
      jira_key: 'SDAP-3931',
      jira_url: 'https://spitch.atlassian.net/browse/SDAP-3931',
      task_status: null,
      auto: null,
      armed: null,
      run: {
        unpushed: 1,
        pending: 0,
        main_tag_left: 0,
        in_flight: 0,
        console_url: 'https://bw.test/runs/run%201'
      }
    })
  })

  it('reads a newer console: a task without a Jira key gets no Jira link', async () => {
    answer({
      '/api/watch': {
        ...STATE,
        entries: [
          {
            ticket: 'IS-146',
            jira_key: null,
            title: 'A task filed here',
            status: 'Testing',
            task_status: 'testing',
            checked_at: null,
            auto: 'console',
            armed: false,
            run: {
              id: 'r',
              unpushed: 0,
              pending: 1,
              main_tag_left: 2,
              in_flight: 1
            }
          }
        ]
      },
      '/api/me': { jiraBaseUrl: 'https://spitch.atlassian.net' }
    })
    const [entry] = (await getBuildWebWatch()).entries
    expect(entry).toMatchObject({
      ticket: 'IS-146',
      jira_key: null,
      jira_url: null,
      title: 'A task filed here',
      task_status: 'testing',
      checked_at: null,
      auto: 'console',
      armed: false,
      run: { pending: 1, main_tag_left: 2, in_flight: 1 }
    })
  })

  it('still reads when /api/me fails or names no https Jira', async () => {
    answer({
      '/api/watch': {
        ...STATE,
        entries: [{ ticket: 'SDAP-1', status: 'Testing' }]
      },
      '/api/me': new Error('down')
    })
    expect((await getBuildWebWatch()).entries[0].jira_url).toBeNull()
    answer({
      '/api/watch': {
        ...STATE,
        entries: [{ ticket: 'SDAP-1', status: 'Testing' }]
      },
      '/api/me': { jiraBaseUrl: 'javascript:alert(1)' }
    })
    expect((await getBuildWebWatch()).entries[0].jira_url).toBeNull()
  })
})

describe('check now', () => {
  it('runs a pass, reads what it did, and drops the image catalog when it queued images', async () => {
    answer({
      '/api/watch/check': {
        ...STATE,
        entries: [],
        result: {
          checked: 17,
          transitions: 1,
          images: 3,
          builds: 1,
          busy: false
        }
      },
      '/api/me': {}
    })
    const result = await checkBuildWebWatch()
    expect(result).toEqual({
      ok: true,
      value: {
        ...STATE,
        entries: [],
        result: {
          checked: 17,
          transitions: 1,
          images: 3,
          builds: 1,
          busy: false
        }
      }
    })
    expect(
      mocks.request.mock.calls.find(([r]) => r.path === '/api/watch/check')?.[0]
    ).toMatchObject({ method: 'POST', body: {} })
    expect(mocks.invalidate).toHaveBeenCalledTimes(1)
  })

  it('says busy without touching the catalog', async () => {
    answer({
      '/api/watch/check': { ...STATE, entries: [], result: { busy: true } },
      '/api/me': {}
    })
    const result = await checkBuildWebWatch()
    expect(result.ok && result.value.result).toEqual({
      checked: 0,
      transitions: 0,
      images: 0,
      builds: 0,
      busy: true
    })
    expect(mocks.invalidate).not.toHaveBeenCalled()
  })

  it('reports Jira being down as a refusal', async () => {
    const { BuildWebApiError } = await import('./build-web-request')
    answer({
      '/api/watch/check': new BuildWebApiError('Jira is unreachable', 502),
      '/api/me': {}
    })
    expect(await checkBuildWebWatch()).toEqual({
      ok: false,
      error: 'Jira is unreachable',
      status: 502
    })
  })
})
