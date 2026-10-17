import { describe, expect, it } from 'vitest'
import { buildWebIssueUrl, issueDetailOf, issueRowOf } from './build-web-issue-mapping'
import { issueListQuery } from './build-web-issue-read'

describe('issue list query', () => {
  it('asks the console for top-level tasks, newest first, with its own filter names', () => {
    const params = new URLSearchParams(
      issueListQuery({
        view: 'mine',
        q: ' export ',
        status: ['todo', 'inprogress'],
        product: ['sa']
      })
    )
    expect(Object.fromEntries(params)).toEqual({
      parent: 'root',
      sort: 'updated_at',
      dir: 'desc',
      mine: 'yes',
      q: 'export',
      status: 'todo,inprogress',
      product: 'sa',
      limit: '100'
    })
  })

  it('caps the page at 100 rows', () => {
    expect(new URLSearchParams(issueListQuery({ view: 'all', limit: 5000 })).get('limit')).toBe(
      '100'
    )
  })
})

describe('issue rows', () => {
  const raw = {
    id: 'abc',
    key: 'IS-91',
    product: 'sa',
    title: 'Export ignores the period',
    status: 'inprogress',
    priority: 2,
    favorite: true,
    for_ai: true,
    url: 'https://evil.test/phish',
    agent_session: {
      surface_kind: 'terminal',
      surface_id: 'tab-1',
      worktree_name: 'w',
      agent: 'claude'
    }
  }

  it('builds the link from the stored origin, never from the answer', () => {
    const row = issueRowOf('https://bw.test', raw)
    expect(row?.url).toBe('https://bw.test/tms/issues/abc?product=sa')
    expect(buildWebIssueUrl('https://bw.test', 'a/b', 's&a')).toBe(
      'https://bw.test/tms/issues/a%2Fb?product=s%26a'
    )
  })

  it('narrows unknown values instead of trusting them', () => {
    const row = issueRowOf('https://bw.test', {
      ...raw,
      status: 'weird',
      product: 'xx',
      priority: 'high'
    })
    expect(row).toMatchObject({ status: 'todo', product: 'tools', priority: 3 })
    expect(issueRowOf('https://bw.test', { title: 'no id' })).toBeNull()
    expect(
      issueRowOf('https://bw.test', { ...raw, agent_session: { surface_kind: 'window' } })
        ?.agent_session
    ).toBeNull()
  })

  it('reads the card with its branches and comments', () => {
    const detail = issueDetailOf('https://bw.test', {
      issue: { ...raw, description: 'text', steps: [{ text: 'one' }, 5] },
      branches: ['sa-release-3.1', 'master'],
      comments: [{ id: 'c1', author: 'a', body: 'hi', created_at: 't' }, { nope: 1 }]
    })
    expect(detail?.branches).toEqual(['sa-release-3.1', 'master'])
    expect(detail?.steps).toEqual([{ text: 'one' }, {}])
    expect(detail?.comments).toHaveLength(1)
  })
})
