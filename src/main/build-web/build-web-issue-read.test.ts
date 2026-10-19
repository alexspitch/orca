import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RequestModule from './build-web-request'

// Families in the list and a card's subtasks, read from the console.

const mocks = vi.hoisted(() => ({
  request: vi.fn<(request: { path: string }) => Promise<unknown>>()
}))

vi.mock('./build-web-connection', () => ({
  requireBuildWebCredential: () => ({ baseUrl: 'https://bw.test', token: 't', generation: 1 })
}))
vi.mock('./build-web-request', async (importOriginal) => ({
  ...(await importOriginal<typeof RequestModule>()),
  buildWebRequest: mocks.request
}))

const { listBuildWebIssueChildren, listBuildWebIssues } = await import('./build-web-issue-read')

const row = (id: string, parent: string | null = null) => ({
  id,
  key: `IS-${id}`,
  product: 'dc',
  title: id,
  parent_id: parent
})

beforeEach(() => mocks.request.mockReset())

describe('issue families', () => {
  it('counts the tasks of a family page, not its subtasks', async () => {
    mocks.request.mockResolvedValueOnce({
      issues: [row('1'), row('2', '1'), row('3')],
      total: 3,
      groups: 2
    })
    const page = await listBuildWebIssues({ view: 'all', tree: true })
    expect(page.total).toBe(2)
    expect(page.issues.map((i) => i.parent_id)).toEqual([null, '1', null])
  })

  it('keeps the plain count from a console that answers without families', async () => {
    mocks.request.mockResolvedValueOnce({ issues: [row('1')], total: 7 })
    expect((await listBuildWebIssues({ view: 'all', tree: true })).total).toBe(7)
  })

  it('reads one task’s subtasks in number order', async () => {
    mocks.request.mockResolvedValueOnce({ issues: [row('2', '1'), { title: 'no id' }] })
    const children = await listBuildWebIssueChildren('a/1')
    expect(children.map((c) => c.id)).toEqual(['2'])
    expect(mocks.request.mock.calls[0][0].path).toBe(
      '/api/tms/issues?parent=a%2F1&limit=200&sort=key&dir=asc'
    )
  })
})
