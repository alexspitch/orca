import { beforeEach, describe, expect, it } from 'vitest'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import { issueQueryOf, OPEN_STATUSES, useBuildWebStore } from './build-web-store'

const row = (id: string): BuildWebIssueRow => ({
  id,
  key: `IS-${id}`,
  product: 'sa',
  title: id,
  type: 'bug',
  status: 'todo',
  priority: 3,
  parent_id: null,
  parent_key: null,
  children_open: 0,
  favorite: false,
  for_ai: false,
  assignee: '',
  version_id: 'v31',
  version_name: '3.1',
  jira_key: null,
  updated_at: '',
  agent_session: null,
  url: `https://bw.test/tms/issues/${id}?product=sa`
})

beforeEach(() => {
  useBuildWebStore.setState({
    contextKey: 'local#0',
    status: { connected: true, baseUrl: 'https://bw.test', login: 'a', perms: [] },
    issues: [],
    selected: new Set(),
    openIssueId: null
  })
})

describe('build-web store', () => {
  it('drops selected tasks the refreshed list no longer shows', () => {
    const store = useBuildWebStore.getState()
    store.setIssues([row('1'), row('2')], 2)
    store.toggleSelected('1')
    store.toggleSelected('2')
    useBuildWebStore.getState().setIssues([row('2')], 1)
    expect([...useBuildWebStore.getState().selected]).toEqual(['2'])
  })

  it('appends the next page without repeating a task that moved up', () => {
    useBuildWebStore.getState().setIssues([row('1'), row('2')], 4)
    useBuildWebStore.getState().appendIssues([row('2'), row('3')], 4)
    expect(useBuildWebStore.getState().issues.map((i) => i.id)).toEqual(['1', '2', '3'])
  })

  it('forgets another host’s tasks when the host changes', () => {
    const store = useBuildWebStore.getState()
    store.setIssues([row('1')], 1)
    store.toggleSelected('1')
    store.openIssue('1')
    useBuildWebStore
      .getState()
      .setStatus('runtime:env#0', { connected: false, baseUrl: null, login: null, perms: [] })
    const after = useBuildWebStore.getState()
    expect(after.issues).toEqual([])
    expect(after.selected.size).toBe(0)
    expect(after.openIssueId).toBeNull()
  })

  it('asks for open work by default and for one status when picked', () => {
    expect(
      issueQueryOf({ view: 'mine', query: '  ', statusFilter: 'open', product: 'all' })
    ).toEqual({
      view: 'mine',
      q: undefined,
      status: [...OPEN_STATUSES],
      product: undefined
    })
    expect(
      issueQueryOf({ view: 'ai', query: 'export', statusFilter: 'testing', product: 'dc' })
    ).toMatchObject({
      q: 'export',
      status: ['testing'],
      product: ['dc']
    })
    expect(
      issueQueryOf({ view: 'all', query: '', statusFilter: 'all', product: 'all' }).status
    ).toBeUndefined()
  })
})
