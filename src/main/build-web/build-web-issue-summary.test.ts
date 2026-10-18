import { beforeEach, describe, expect, it, vi } from 'vitest'

// The Issues badge counts open tasks at the top priority from one page sorted by priority.

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
})
