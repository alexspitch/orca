import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RequestModule from './build-web-request'

// The «Recaps» page's reads: the list of finished reports, and one report in pieces.

const mocks = vi.hoisted(() => ({
  request: vi.fn<(request: { path: string }) => Promise<unknown>>(),
  text: vi.fn<(request: { path: string; maxBytes: number }) => Promise<string>>(),
  generation: 1
}))

vi.mock('./build-web-connection', () => ({
  requireBuildWebCredential: () => ({
    baseUrl: 'https://bw.test',
    token: 't',
    generation: mocks.generation
  })
}))
vi.mock('./build-web-request', async (importOriginal) => ({
  ...(await importOriginal<typeof RequestModule>()),
  buildWebRequest: mocks.request,
  buildWebTextRequest: mocks.text
}))

const { BuildWebApiError } = await import('./build-web-request')
const { RECAP_PIECE_CHARS, listBuildWebRecaps, readBuildWebRecapReport } =
  await import('./build-web-recaps')

const QUERY = { product: null, versionId: null, from: null, to: null, limit: 50, offset: 0 }

beforeEach(() => {
  mocks.request.mockReset()
  mocks.text.mockReset()
  // Why: each test starts on its own token, so no report is served from an earlier test's cache.
  mocks.generation += 1
})

describe('the list', () => {
  it('asks only for the filters that are set', async () => {
    mocks.request.mockResolvedValue({ results: [], total: 0, facets: {} })
    await listBuildWebRecaps(QUERY)
    await listBuildWebRecaps({
      product: 'dc',
      versionId: 'v 1',
      automationId: 'a1',
      from: '2026-10-01T22:00:00.000Z',
      to: '2026-10-18T22:00:00.000Z',
      limit: 50,
      offset: 100
    })
    expect(mocks.request.mock.calls.map(([r]) => r.path)).toEqual([
      '/api/automations/results?limit=50&offset=0',
      '/api/automations/results?limit=50&offset=100&product=dc&version=v+1&automation=a1' +
        '&from=2026-10-01T22%3A00%3A00.000Z&to=2026-10-18T22%3A00%3A00.000Z'
    ])
  })

  it('reads the reports and the facets, dropping what it does not know', async () => {
    mocks.request.mockResolvedValue({
      results: [
        {
          id: 'r2',
          automation_id: 'a1',
          name: 'Weekly review',
          product: 'sa',
          version: { id: 'v1', name: '2.16', branch: 'master' },
          commit: 'abcdef1234',
          trigger: 'scheduled',
          started_by: null,
          finished_at: '2026-10-19T06:00:00.000Z'
        },
        { id: 'r1', product: 'mobile', version: null, trigger: 'nonsense' },
        { name: 'no id' }
      ],
      total: 7,
      facets: {
        products: ['sa', 'mobile', 'dc'],
        versions: [
          { id: 'v1', product: 'sa', name: '2.16' },
          { id: 'v9', product: 'mobile' }
        ],
        automations: [
          { id: 'a1', name: 'Weekly review', product: 'sa', version_id: 'v1' },
          { id: 'a9', name: 'Mobile', product: 'mobile', version_id: 'v9' }
        ]
      }
    })
    const got = await listBuildWebRecaps(QUERY)
    expect(got).toEqual({
      ok: true,
      value: {
        results: [
          {
            id: 'r2',
            automation_id: 'a1',
            name: 'Weekly review',
            product: 'sa',
            version: { id: 'v1', name: '2.16', branch: 'master' },
            commit: 'abcdef1234',
            trigger: 'scheduled',
            started_by: null,
            finished_at: '2026-10-19T06:00:00.000Z'
          },
          {
            id: 'r1',
            automation_id: '',
            name: '',
            product: 'unknown',
            version: null,
            commit: null,
            trigger: 'manual',
            started_by: null,
            finished_at: ''
          }
        ],
        total: 7,
        facets: {
          products: ['sa', 'dc'],
          versions: [{ id: 'v1', product: 'sa', name: '2.16' }],
          automations: [{ id: 'a1', name: 'Weekly review', product: 'sa', version_id: 'v1' }]
        }
      }
    })
  })

  it('offers no automation picker against a console that would ignore it', async () => {
    mocks.request.mockResolvedValue({ results: [], total: 0, facets: { products: ['sa'] } })
    const got = await listBuildWebRecaps(QUERY)
    expect(got.ok && got.value.facets.automations).toBeNull()
  })

  it('tells an older console apart from a missing permission', async () => {
    mocks.request.mockRejectedValueOnce(new BuildWebApiError('нет такой автоматизации', 404))
    expect(await listBuildWebRecaps(QUERY)).toMatchObject({
      ok: false,
      status: 404,
      routeMissing: true,
      error: 'This build-web has no Recaps list yet. Update the console.'
    })
    mocks.request.mockRejectedValueOnce(
      new BuildWebApiError('этот маршрут не отнесён ни к одному разделу консоли', 403)
    )
    expect(await listBuildWebRecaps(QUERY)).toMatchObject({
      ok: false,
      status: 404,
      routeMissing: true,
      error: 'This build-web has no automations yet. Update the console.'
    })
    mocks.request.mockRejectedValueOnce(
      new BuildWebApiError('нет права на этот раздел', 403, ['automations'])
    )
    expect(await listBuildWebRecaps(QUERY)).toMatchObject({
      ok: false,
      status: 403,
      error: 'нет права на этот раздел. Needs section: automations.'
    })
  })
})

describe('a report', () => {
  it('comes in pieces from one read, the last one short', async () => {
    const html = 'x'.repeat(RECAP_PIECE_CHARS * 2 + 10)
    mocks.text.mockResolvedValue(html)
    const first = await readBuildWebRecapReport('r1', 0)
    const second = await readBuildWebRecapReport('r1', first.next)
    const third = await readBuildWebRecapReport('r1', second.next)
    expect([first.next, second.next, third.next]).toEqual([
      RECAP_PIECE_CHARS,
      RECAP_PIECE_CHARS * 2,
      html.length
    ])
    expect(third.text).toHaveLength(10)
    expect(third.total).toBe(html.length)
    expect(first.text + second.text + third.text).toBe(html)
    expect(mocks.text).toHaveBeenCalledTimes(1)
    expect(mocks.text.mock.calls[0][0].path).toBe('/api/automations/runs/r1/report')
  })

  it('never ends a piece between the halves of a surrogate pair', async () => {
    const html = `${'a'.repeat(RECAP_PIECE_CHARS - 1)}😀b`
    mocks.text.mockResolvedValue(html)
    const first = await readBuildWebRecapReport('r1', 0)
    expect(first.next).toBe(RECAP_PIECE_CHARS - 1)
    const second = await readBuildWebRecapReport('r1', first.next)
    expect(second.text).toBe('😀b')
  })

  it('is read again under another token, after it falls out of the cache, or after it failed', async () => {
    mocks.text.mockImplementation(async ({ path }) => path)
    await readBuildWebRecapReport('r1', 0)
    mocks.generation += 1
    await readBuildWebRecapReport('r1', 0)
    expect(mocks.text).toHaveBeenCalledTimes(2)

    for (const id of ['r2', 'r3', 'r4', 'r5']) {
      await readBuildWebRecapReport(id, 0)
    }
    await readBuildWebRecapReport('r5', 0)
    expect(mocks.text).toHaveBeenCalledTimes(6)
    await readBuildWebRecapReport('r1', 0)
    expect(mocks.text).toHaveBeenCalledTimes(7)

    mocks.text.mockRejectedValueOnce(new BuildWebApiError('отчёта нет', 404))
    await expect(readBuildWebRecapReport('r6', 0)).rejects.toThrow('отчёта нет')
    await readBuildWebRecapReport('r6', 0)
    expect(mocks.text).toHaveBeenCalledTimes(9)
  })
})
