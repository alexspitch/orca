import { beforeEach, describe, expect, it, vi } from 'vitest'

// The Issues badge counts open tasks at the top priority from one page sorted by priority.

import { BUILD_WEB_OPEN_STATUSES } from '../../shared/build-web-types'

const mocks = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('./build-web-connection', () => ({
  requireBuildWebCredential: () => ({ baseUrl: 'https://bw.test', token: 't', generation: 1 })
}))
vi.mock('./build-web-issue-read', () => ({ listBuildWebIssues: mocks.list }))

const { buildWebIssueSummary, _resetBuildWebIssueSummary } =
  await import('./build-web-issue-summary')

beforeEach(() => {
  mocks.list.mockReset()
  _resetBuildWebIssueSummary()
})

describe('issue summary', () => {
  it('counts the open tasks at priority 5, asking for the highest first', async () => {
    mocks.list.mockResolvedValueOnce({
      issues: [{ priority: 5 }, { priority: 5 }, { priority: 4 }],
      total: 3
    })
    expect(await buildWebIssueSummary()).toEqual({ blockers: 2, capped: false })
    expect(mocks.list.mock.calls[0][0]).toMatchObject({
      sort: 'priority',
      dir: 'desc',
      view: 'all'
    })
    await buildWebIssueSummary()
    expect(mocks.list).toHaveBeenCalledTimes(1)
  })

  it('counts within the list filters and search, open tasks only, and caches by them', async () => {
    mocks.list.mockResolvedValue({ issues: [{ priority: 5 }], total: 1 })
    await buildWebIssueSummary({ mine: true, status: [], product: ['dc'], q: ' IS-1 ' })
    expect(mocks.list.mock.calls[0][0]).toMatchObject({
      mine: true,
      ai: false,
      status: [...BUILD_WEB_OPEN_STATUSES],
      product: ['dc'],
      q: 'IS-1'
    })
    // A closed status chosen on the page is not counted: a done task blocks nothing.
    await buildWebIssueSummary({ mine: true, status: ['todo', 'done'], product: ['dc'] })
    expect(mocks.list).toHaveBeenCalledTimes(2)
    expect(mocks.list.mock.calls[1][0]).toMatchObject({ status: ['todo'] })
  })

  it('counts none, without asking, when only closed statuses are chosen', async () => {
    expect(await buildWebIssueSummary({ status: ['done', 'wontfix'] })).toEqual({
      blockers: 0,
      capped: false
    })
    expect(mocks.list).not.toHaveBeenCalled()
  })
})
