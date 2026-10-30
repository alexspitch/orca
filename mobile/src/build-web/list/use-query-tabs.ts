import { useCallback, useEffect, useRef } from 'react'
import type { BuildWebSavedQuery } from '../../../../src/shared/build-web-saved-query-types'
import { BUILD_WEB_PRODUCTS, BUILD_WEB_STATUSES } from '../../../../src/shared/build-web-types'
import { QUICK_FILTERS } from '../../../../src/renderer/src/components/build-web/build-web-view-prefs'
import { viewOfSavedFilter } from '../../../../src/renderer/src/components/build-web/saved-queries/saved-query-filter'
import type { BuildWebListFilters } from './issue-list-query'
import type { IssueList } from './use-issue-list'
import { recordOf, useStoredHostTabs } from './use-stored-host-tabs'

// The desktop query-tabs: a saved query run opens as a tab of its own, named after it. Each tab
// keeps the filters it was left with, and so does the plain List, so moving between them swaps them.

export type BuildWebQueryTab = { id: string; name: string; filters: BuildWebListFilters }

const TABS_KEPT = 20

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

function filtersOfRaw(raw: unknown): BuildWebListFilters {
  const v = recordOf(raw)
  return {
    quick: QUICK_FILTERS.filter((q) => strings(v.quick).includes(q)),
    statuses: BUILD_WEB_STATUSES.filter((s) => strings(v.statuses).includes(s)),
    // Why `product` too: tabs kept before the list took several products held one.
    products: BUILD_WEB_PRODUCTS.filter((p) => strings(v.products).includes(p) || v.product === p),
    assignees: strings(v.assignees),
    query: typeof v.query === 'string' ? v.query : ''
  }
}

function tabsOf(raw: unknown): BuildWebQueryTab[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.flatMap((entry: unknown) => {
    const v = recordOf(entry)
    return typeof v.id === 'string' && typeof v.name === 'string'
      ? [{ id: v.id, name: v.name, filters: filtersOfRaw(v.filters) }]
      : []
  })
}

/** Per build-web console: another console's saved queries mean nothing here. */
export function useQueryTabs(hostId: string, consoleUrl: string, list: IssueList) {
  const [tabs, update] = useStoredHostTabs(`orca:buildWebQueryTabs:${hostId}`, consoleUrl, tabsOf)
  // The plain List's filters while a query's tab is shown.
  const listFilters = useRef<BuildWebListFilters>(list.filters)
  const { filters, queryTabId, showListTab } = list

  // Why on every change: the filters change from the bar, the status sheet and the search alike,
  // and each tab must come back as it was left.
  useEffect(() => {
    if (queryTabId === null) {
      listFilters.current = filters
      return
    }
    update((current) =>
      current.some((tab) => tab.id === queryTabId && tab.filters !== filters)
        ? current.map((tab) => (tab.id === queryTabId ? { ...tab, filters } : tab))
        : current
    )
  }, [filters, queryTabId, update])

  const showPlainList = useCallback(() => showListTab(null, listFilters.current), [showListTab])

  const showQueryTab = useCallback(
    (id: string) => {
      const tab = tabs.find((entry) => entry.id === id)
      if (tab) {
        showListTab(id, tab.filters)
      }
    },
    [showListTab, tabs]
  )

  /** A saved query run: its tab, opened or brought back to the query's own filters. Returns the fields the list cannot narrow by. */
  const openQueryTab = useCallback(
    (query: BuildWebSavedQuery): string[] => {
      const { unsupported, ...applied } = viewOfSavedFilter(query.filter)
      const entry: BuildWebQueryTab = { id: query.id, name: query.name, filters: applied }
      update((current) =>
        current.some((tab) => tab.id === query.id)
          ? current.map((tab) => (tab.id === query.id ? entry : tab))
          : [...current, entry].slice(-TABS_KEPT)
      )
      showListTab(query.id, applied)
      return unsupported
    },
    [showListTab, update]
  )

  /** Closing the tab on show moves to its right-hand neighbour, else its left, else the List. */
  const closeQueryTab = useCallback(
    (id: string) => {
      const index = tabs.findIndex((tab) => tab.id === id)
      const next = tabs.filter((tab) => tab.id !== id)
      update(() => next)
      if (queryTabId !== id) {
        return
      }
      const neighbour = next[index] ?? next[index - 1]
      showListTab(neighbour?.id ?? null, neighbour?.filters ?? listFilters.current)
    },
    [queryTabId, showListTab, tabs, update]
  )

  return { tabs, showPlainList, showQueryTab, openQueryTab, closeQueryTab }
}

export type QueryTabs = ReturnType<typeof useQueryTabs>
