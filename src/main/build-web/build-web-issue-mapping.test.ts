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

  it('combines the quick filters and passes the sort and the page', () => {
    const params = new URLSearchParams(
      issueListQuery({
        view: 'mine',
        mine: true,
        favorite: true,
        sort: 'priority',
        dir: 'asc',
        limit: 50,
        offset: 100
      })
    )
    expect(params.get('mine')).toBe('yes')
    expect(params.get('favorite')).toBe('yes')
    expect(params.get('ai')).toBeNull()
    expect(params.get('sort')).toBe('priority')
    expect(params.get('dir')).toBe('asc')
    expect(params.get('offset')).toBe('100')
    expect(
      new URLSearchParams(issueListQuery({ view: 'mine', mine: false })).get('mine')
    ).toBeNull()
  })

  it('asks for families without leaving the subtasks out', () => {
    const params = new URLSearchParams(issueListQuery({ view: 'all', tree: true }))
    expect(params.get('tree')).toBe('1')
    expect(params.get('parent')).toBeNull()
    expect(params.get('sort')).toBe('updated_at')
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
    expect(row?.url).toBe('https://bw.test/issues/abc?product=sa')
    expect(buildWebIssueUrl('https://bw.test', 'a/b', 's&a')).toBe(
      'https://bw.test/issues/a%2Fb?product=s%26a'
    )
  })

  it('reads where a row stands in its family', () => {
    const task = issueRowOf('https://bw.test', { ...raw, children: 3, children_open: 1 })
    expect(task).toMatchObject({ parent_id: null, children: 3, children_open: 1 })
    const sub = issueRowOf('https://bw.test', { ...raw, parent_id: 'p1', parent_key: 'IS-90' })
    expect(sub).toMatchObject({ parent_id: 'p1', parent_key: 'IS-90', children: 0 })
  })

  it('narrows unknown values instead of trusting them', () => {
    const row = issueRowOf('https://bw.test', {
      ...raw,
      status: 'weird',
      product: 'xx',
      priority: 'high'
    })
    expect(row).toMatchObject({ status: 'unknown', product: 'unknown', priority: 3 })
    expect(row?.url).toBe('https://bw.test/issues/abc?product=xx')
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
    expect(detail?.files).toEqual([])
  })

  it('reads where each comment went and whether one may go to Telegram', () => {
    const detail = issueDetailOf('https://bw.test', {
      issue: raw,
      telegram_available: true,
      comments: [
        { id: 'c1', author: 'a', body: 'asked', created_at: 't', channel: 'telegram' },
        { id: 'c2', author: 'b', body: 'answer', created_at: 't', channel: 'telegram_reply' },
        { id: 'c3', author: 'a', body: 'plain', created_at: 't', channel: 'fax' },
        { id: 'c4', author: 'a', body: 'older console', created_at: 't' }
      ]
    })
    expect(detail?.telegram_available).toBe(true)
    expect(detail?.comments.map((c) => c.channel)).toEqual(['telegram', 'telegram_reply', '', ''])
    // A console before IS-195 says nothing: no Telegram.
    expect(issueDetailOf('https://bw.test', { issue: raw })?.telegram_available).toBe(false)
  })

  it('reads the files of the task and of its comments', () => {
    const detail = issueDetailOf('https://bw.test', {
      issue: raw,
      files: [
        {
          id: 'a1b2c3d4e5f6',
          name: 'notes.md',
          size: 120,
          mime: 'text/markdown',
          comment_id: null
        },
        { id: 'b1b2c3d4e5f6', name: 'shot.png', size: 9, mime: 'image/png', comment_id: 'c1' },
        { name: 'no id' }
      ]
    })
    expect(detail?.files.map((f) => [f.name, f.comment_id])).toEqual([
      ['notes.md', null],
      ['shot.png', 'c1']
    ])
  })
})
