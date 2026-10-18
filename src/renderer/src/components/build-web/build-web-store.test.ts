import { beforeEach, describe, expect, it } from 'vitest'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import {
  ISSUE_PAGE_SIZE,
  issueQueryOf,
  OPEN_STATUSES,
  TO_WORK_STATUSES,
  useBuildWebStore
} from './build-web-store'
import type { QuickFilter } from './build-web-view-prefs'

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

  it('goes back to the last page when the one shown ran past the end', () => {
    useBuildWebStore.setState({ page: 3 })
    useBuildWebStore.getState().setIssues([], 60)
    expect(useBuildWebStore.getState().page).toBe(1)
  })

  it('starts a filter or sort change on the first page', () => {
    useBuildWebStore.setState({ page: 2 })
    useBuildWebStore.getState().toggleQuick('ai')
    expect(useBuildWebStore.getState().page).toBe(0)
    useBuildWebStore.setState({ page: 2 })
    useBuildWebStore.getState().sortBy('priority')
    expect(useBuildWebStore.getState()).toMatchObject({
      page: 0,
      sort: { sort: 'priority', dir: 'desc' }
    })
    useBuildWebStore.getState().sortBy('priority')
    expect(useBuildWebStore.getState().sort.dir).toBe('asc')
  })

  it('collapses a full card to where it came from: the side card, or the list', () => {
    const store = useBuildWebStore.getState()
    store.openIssue('1')
    useBuildWebStore.getState().expandToFullScreen()
    useBuildWebStore.getState().collapseFullScreen()
    expect(useBuildWebStore.getState()).toMatchObject({ openIssueId: '1', fullScreen: false })
    useBuildWebStore.getState().openIssue('2', true)
    useBuildWebStore.getState().collapseFullScreen()
    expect(useBuildWebStore.getState()).toMatchObject({ openIssueId: null, fullScreen: false })
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

  it('asks for the picked statuses, combined quick filters, the sort and the page', () => {
    const base = {
      quick: new Set<QuickFilter>(['mine']),
      sort: { sort: 'updated_at' as const, dir: 'desc' as const },
      page: 0,
      query: '  ',
      statuses: new Set(OPEN_STATUSES),
      product: 'all' as const
    }
    expect(issueQueryOf(base)).toEqual({
      view: 'mine',
      mine: true,
      ai: false,
      favorite: false,
      jira: false,
      sort: 'updated_at',
      dir: 'desc',
      limit: ISSUE_PAGE_SIZE,
      offset: 0,
      q: undefined,
      status: [...OPEN_STATUSES],
      product: undefined
    })
    expect(
      issueQueryOf({
        ...base,
        quick: new Set<QuickFilter>(['ai', 'favorite']),
        page: 2,
        query: 'export',
        statuses: new Set(TO_WORK_STATUSES),
        product: 'dc'
      })
    ).toMatchObject({
      view: 'ai',
      ai: true,
      favorite: true,
      offset: 2 * ISSUE_PAGE_SIZE,
      q: 'export',
      status: ['todo', 'planned', 'inprogress', 'build_failed'],
      product: ['dc']
    })
    expect(issueQueryOf({ ...base, quick: new Set(), statuses: new Set() })).toMatchObject({
      view: 'all',
      status: undefined
    })
  })
})
