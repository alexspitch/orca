import { create } from 'zustand'
import type { BuildWebSavedQuery } from '../../../../../shared/build-web-saved-query-types'
import {
  BUILD_WEB_ASSIGNEE_ME,
  BUILD_WEB_PRODUCTS,
  BUILD_WEB_STATUSES,
  type BuildWebProduct,
  type BuildWebStatus
} from '../../../../../shared/build-web-types'
import { useBuildWebStore, type BuildWebListFilters } from '../build-web-store'
import { QUICK_FILTERS } from '../build-web-view-prefs'
import { viewOfSavedFilter } from './saved-query-filter'

// A saved query run from the List tab opens as a tab of its own, named after it. Each tab keeps the
// filters it was left with, and so does the plain List, so moving between them swaps the filters.

export type BuildWebQueryTab = {
  /** The saved query's id: running it again shows this tab. */
  id: string
  name: string
  filters: BuildWebListFilters
}

type QueryTabsState = {
  /** Per build-web host (the store's contextKey), as the task tabs. */
  byContext: Readonly<Record<string, readonly BuildWebQueryTab[]>>
}

const STORAGE_KEY = 'orca.buildWeb.queryTabs'
const TABS_KEPT = 20
const NO_TABS: readonly BuildWebQueryTab[] = []

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

function filtersOfRaw(raw: unknown): BuildWebListFilters {
  const v = raw && typeof raw === 'object' ? Object.fromEntries(Object.entries(raw)) : {}
  return {
    quick: QUICK_FILTERS.filter((q) => strings(v.quick).includes(q)),
    statuses: BUILD_WEB_STATUSES.filter((s) => strings(v.statuses).includes(s)),
    // Why `product` too: tabs kept before the list took several products held one.
    products: BUILD_WEB_PRODUCTS.filter((p) => strings(v.products).includes(p) || v.product === p),
    // Why the quick filters: tabs kept before the assignee list held Mine there.
    assignees: Array.isArray(v.assignees)
      ? strings(v.assignees)
      : strings(v.quick).includes('mine')
        ? [BUILD_WEB_ASSIGNEE_ME]
        : [],
    query: typeof v.query === 'string' ? v.query : ''
  }
}

function tabsOf(raw: unknown): BuildWebQueryTab[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== 'object') {
      return []
    }
    const v = Object.fromEntries(Object.entries(entry))
    return typeof v.id === 'string' && typeof v.name === 'string'
      ? [{ id: v.id, name: v.name, filters: filtersOfRaw(v.filters) }]
      : []
  })
}

function readTabs(): Record<string, BuildWebQueryTab[]> {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    return raw && typeof raw === 'object'
      ? Object.fromEntries(Object.entries(raw).map(([context, tabs]) => [context, tabsOf(tabs)]))
      : {}
  } catch {
    return {}
  }
}

function writeTabs(byContext: QueryTabsState['byContext']): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(byContext))
  } catch {
    // Storage may be disabled; the tabs just won't survive this session.
  }
}

export const useBuildWebQueryTabs = create<QueryTabsState>()(() => ({ byContext: readTabs() }))

export function useQueryTabsOf(contextKey: string | null): readonly BuildWebQueryTab[] {
  return useBuildWebQueryTabs((s) => (contextKey ? s.byContext[contextKey] : undefined) ?? NO_TABS)
}

function update(change: (tabs: readonly BuildWebQueryTab[]) => readonly BuildWebQueryTab[]): void {
  const context = useBuildWebStore.getState().contextKey
  if (!context) {
    return
  }
  const state = useBuildWebQueryTabs.getState()
  const tabs = state.byContext[context] ?? NO_TABS
  const next = change(tabs)
  if (next !== tabs) {
    const byContext = { ...state.byContext, [context]: next }
    writeTabs(byContext)
    useBuildWebQueryTabs.setState({ byContext })
  }
}

function currentTabs(): readonly BuildWebQueryTab[] {
  const context = useBuildWebStore.getState().contextKey
  return (context ? useBuildWebQueryTabs.getState().byContext[context] : undefined) ?? NO_TABS
}

type FilterState = {
  quick: ReadonlySet<string>
  statuses: ReadonlySet<BuildWebStatus>
  products: ReadonlySet<BuildWebProduct>
  assignees: ReadonlySet<string>
  query: string
}

const filtersOf = (state: FilterState): BuildWebListFilters => ({
  quick: QUICK_FILTERS.filter((q) => state.quick.has(q)),
  statuses: BUILD_WEB_STATUSES.filter((s) => state.statuses.has(s)),
  products: BUILD_WEB_PRODUCTS.filter((p) => state.products.has(p)),
  assignees: [...state.assignees],
  query: state.query
})

// The plain List's filters while a query's tab is shown.
let listFilters = filtersOf(useBuildWebStore.getState())

// Why a subscription: the filters change from the bar, the status menu and the search alike, and
// each tab must come back as it was left.
useBuildWebStore.subscribe((state, prev) => {
  if (
    state.queryTabId !== prev.queryTabId ||
    state.contextKey !== prev.contextKey ||
    (state.quick === prev.quick &&
      state.statuses === prev.statuses &&
      state.products === prev.products &&
      state.assignees === prev.assignees &&
      state.query === prev.query)
  ) {
    return
  }
  const filters = filtersOf(state)
  const id = state.queryTabId
  if (id === null) {
    listFilters = filters
    return
  }
  update((tabs) => tabs.map((tab) => (tab.id === id ? { ...tab, filters } : tab)))
})

/** The plain List, with the filters it was left with. */
export function showPlainList(): void {
  useBuildWebStore.getState().showListTab(null, listFilters)
}

export function showQueryTab(id: string): void {
  const tab = currentTabs().find((entry) => entry.id === id)
  if (tab) {
    useBuildWebStore.getState().showListTab(id, tab.filters)
  }
}

/**
 * A saved query run: its tab, opened or brought back to the query's own filters. Returns the
 * filter's fields Orca's list cannot narrow by.
 */
export function openQueryTab(query: BuildWebSavedQuery): string[] {
  const { unsupported, ...filters } = viewOfSavedFilter(query.filter)
  update((tabs) => {
    const entry: BuildWebQueryTab = { id: query.id, name: query.name, filters }
    return tabs.some((tab) => tab.id === query.id)
      ? tabs.map((tab) => (tab.id === query.id ? entry : tab))
      : [...tabs, entry].slice(-TABS_KEPT)
  })
  useBuildWebStore.getState().showListTab(query.id, filters)
  return unsupported
}

/** Closing the tab on show moves to its right-hand neighbour, else its left, else the List. */
export function closeQueryTab(id: string): void {
  const tabs = currentTabs()
  const index = tabs.findIndex((tab) => tab.id === id)
  const next = tabs.filter((tab) => tab.id !== id)
  update(() => next)
  const store = useBuildWebStore.getState()
  if (store.queryTabId !== id) {
    return
  }
  // Why the card stays: a task's tab is in front, the closed query was only the list behind it.
  const keepCard = store.fullScreen && store.openIssueId !== null
  const neighbour = next[index] ?? next[index - 1]
  store.showListTab(neighbour?.id ?? null, neighbour?.filters ?? listFilters, { keepCard })
}
