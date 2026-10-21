import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import { useBuildWebStore } from './build-web-store'
import {
  closeTaskTab,
  keepTaskTab,
  labelTaskTab,
  showTaskList,
  showTaskTab,
  useBuildWebTaskTabs
} from './build-web-task-tabs'

const row = (id: string): BuildWebIssueRow => ({
  id,
  key: `IS-${id}`,
  product: 'sa',
  title: `Task ${id}`,
  type: 'bug',
  status: 'todo',
  priority: 3,
  parent_id: null,
  parent_key: null,
  children: 0,
  children_open: 0,
  favorite: false,
  for_ai: false,
  assignee: '',
  version_id: null,
  version_name: null,
  jira_key: null,
  updated_at: '',
  agent_session: null,
  url: ''
})

const ids = (context = 'host'): string[] =>
  (useBuildWebTaskTabs.getState().byContext[context] ?? []).map((tab) => tab.id)

/** What the Issues page does for a card it shows in full. */
function openFull(id: string): void {
  useBuildWebStore.getState().openIssue(id, true)
  keepTaskTab(id)
}

const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value)
    }
  })
  useBuildWebTaskTabs.setState({ byContext: {}, lastShownId: null })
  useBuildWebStore.setState({
    contextKey: 'host',
    issues: ['1', '2', '3'].map(row),
    openIssueId: null,
    fullScreen: false,
    openTab: 'overview'
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('build-web task tabs', () => {
  it('makes each full card a tab, once, right after the one it was opened from', () => {
    openFull('1')
    openFull('2')
    showTaskTab('1')
    keepTaskTab('1')
    openFull('3')
    openFull('3')
    expect(ids()).toEqual(['1', '3', '2'])
    expect(useBuildWebTaskTabs.getState().byContext.host?.[0]).toMatchObject({
      key: 'IS-1',
      title: 'Task 1'
    })
  })

  it('names a tab opened by a link once its card has read the task', () => {
    useBuildWebStore.setState({ issues: [] })
    openFull('9')
    expect(useBuildWebTaskTabs.getState().byContext.host?.[0]).toMatchObject({ key: null })
    labelTaskTab('9', 'IS-9', 'Linked')
    expect(useBuildWebTaskTabs.getState().byContext.host?.[0]).toMatchObject({
      key: 'IS-9',
      title: 'Linked'
    })
  })

  it("comes back to the card's own tab however the card was left", () => {
    openFull('1')
    useBuildWebStore.setState({ openTab: 'plan' })
    // Escape, or the card's Back to list.
    useBuildWebStore.getState().openIssue(null)
    showTaskTab('1')
    expect(useBuildWebStore.getState()).toMatchObject({
      openIssueId: '1',
      fullScreen: true,
      openTab: 'plan'
    })
    showTaskList()
    expect(useBuildWebStore.getState()).toMatchObject({ openIssueId: null, fullScreen: false })
    expect(ids()).toEqual(['1'])
  })

  it('moves to the right-hand neighbour, else the left, else the list when the shown tab closes', () => {
    openFull('1')
    openFull('2')
    openFull('3')
    showTaskTab('2')
    closeTaskTab('2')
    expect(useBuildWebStore.getState().openIssueId).toBe('3')
    closeTaskTab('3')
    expect(useBuildWebStore.getState().openIssueId).toBe('1')
    closeTaskTab('1')
    expect(useBuildWebStore.getState()).toMatchObject({ openIssueId: null, fullScreen: false })
    expect(ids()).toEqual([])
  })

  it('keeps a tab that is not shown from moving the page when it closes', () => {
    openFull('1')
    openFull('2')
    closeTaskTab('1')
    expect(useBuildWebStore.getState().openIssueId).toBe('2')
    expect(ids()).toEqual(['2'])
  })

  it("keeps each host's tabs apart, and none before a host answers", () => {
    openFull('1')
    useBuildWebStore.setState({ contextKey: 'other' })
    openFull('2')
    useBuildWebStore.setState({ contextKey: null })
    keepTaskTab('3')
    expect(ids('host')).toEqual(['1'])
    expect(ids('other')).toEqual(['2'])
  })

  it('remembers the tabs across a restart', async () => {
    openFull('1')
    vi.resetModules()
    const reloaded = await import('./build-web-task-tabs')
    expect(reloaded.useBuildWebTaskTabs.getState().byContext.host?.map((tab) => tab.id)).toEqual([
      '1'
    ])
  })
})
