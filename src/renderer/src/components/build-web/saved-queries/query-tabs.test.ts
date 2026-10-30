import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EMPTY_BUILD_WEB_SAVED_FILTER,
  type BuildWebSavedQuery
} from '../../../../../shared/build-web-saved-query-types'
import { useBuildWebStore } from '../build-web-store'
import {
  closeQueryTab,
  openQueryTab,
  showPlainList,
  showQueryTab,
  useBuildWebQueryTabs
} from './query-tabs'

const saved = (id: string, over: Partial<BuildWebSavedQuery['filter']>): BuildWebSavedQuery => ({
  id,
  name: `Query ${id}`,
  product: 'dc',
  owner: 'me@x',
  mine: true,
  shared: false,
  filter: { ...EMPTY_BUILD_WEB_SAVED_FILTER, ...over }
})

const shown = () => {
  const s = useBuildWebStore.getState()
  return { tab: s.queryTabId, query: s.query, products: [...s.products], quick: [...s.quick] }
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
  useBuildWebQueryTabs.setState({ byContext: {} })
  useBuildWebStore.setState({ contextKey: 'host', queryTabId: null, openIssueId: null })
  showPlainList()
  useBuildWebStore.getState().setQuery('plain')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('saved query tabs', () => {
  it('opens a query as its tab, and each tab comes back with the filters it was left with', () => {
    openQueryTab(saved('a', { q: 'deploy', product: ['dc'], mine: true }))
    expect(shown()).toEqual({ tab: 'a', query: 'deploy', products: ['dc'], quick: ['mine'] })

    useBuildWebStore.getState().setQuery('deploy failed')
    showPlainList()
    expect(shown()).toMatchObject({ tab: null, query: 'plain' })

    showQueryTab('a')
    expect(shown()).toMatchObject({ tab: 'a', query: 'deploy failed' })
  })

  it('runs a query again from its own filters, and closing its tab returns to the List', () => {
    openQueryTab(saved('a', { q: 'deploy' }))
    useBuildWebStore.getState().setQuery('changed')
    openQueryTab(saved('a', { q: 'deploy' }))
    expect(shown()).toMatchObject({ tab: 'a', query: 'deploy' })
    expect(useBuildWebQueryTabs.getState().byContext.host).toHaveLength(1)

    closeQueryTab('a')
    expect(shown()).toMatchObject({ tab: null, query: 'plain' })
    expect(useBuildWebQueryTabs.getState().byContext.host).toEqual([])
  })
})
