import { create } from 'zustand'
import { BUILD_WEB_CARD_TABS, useBuildWebStore, type BuildWebCardTab } from './build-web-store'

/** A task kept open as a tab on the Issues page; key and title name it before its card loads. */
export type BuildWebTaskTab = {
  id: string
  key: string | null
  title: string | null
  /** The card's own tab (Overview, Plan…) to come back to. */
  cardTab: BuildWebCardTab
}

type TaskTabsState = {
  /** Per build-web host (the store's contextKey): another host's task ids mean nothing here. */
  byContext: Readonly<Record<string, readonly BuildWebTaskTab[]>>
  /** The tab a newly opened card is placed after, as an editor places a file opened from one. */
  lastShownId: string | null
}

const STORAGE_KEY = 'orca.buildWeb.taskTabs'
// Why a cap: tabs survive restarts, so one per task ever opened would grow without end.
const TABS_KEPT = 30
const NO_TABS: readonly BuildWebTaskTab[] = []

function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function tabsOf(raw: unknown): BuildWebTaskTab[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== 'object') {
      return []
    }
    const v = Object.fromEntries(Object.entries(entry))
    const id = text(v.id)
    return id
      ? [
          {
            id,
            key: text(v.key),
            title: text(v.title),
            cardTab: BUILD_WEB_CARD_TABS.find((tab) => tab === v.cardTab) ?? 'overview'
          }
        ]
      : []
  })
}

function readTabs(): Record<string, BuildWebTaskTab[]> {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    return raw && typeof raw === 'object'
      ? Object.fromEntries(Object.entries(raw).map(([context, tabs]) => [context, tabsOf(tabs)]))
      : {}
  } catch {
    return {}
  }
}

function writeTabs(byContext: TaskTabsState['byContext']): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(byContext))
  } catch {
    // Storage may be disabled; the tabs just won't survive this session.
  }
}

export const useBuildWebTaskTabs = create<TaskTabsState>()(() => ({
  byContext: readTabs(),
  lastShownId: null
}))

export function useTaskTabsOf(contextKey: string | null): readonly BuildWebTaskTab[] {
  return useBuildWebTaskTabs((s) => (contextKey ? s.byContext[contextKey] : undefined) ?? NO_TABS)
}

function update(
  change: (tabs: readonly BuildWebTaskTab[]) => readonly BuildWebTaskTab[],
  lastShownId?: string | null
): void {
  const context = useBuildWebStore.getState().contextKey
  if (!context) {
    return
  }
  const state = useBuildWebTaskTabs.getState()
  const tabs = state.byContext[context] ?? NO_TABS
  const next = change(tabs)
  if (next !== tabs) {
    const byContext = { ...state.byContext, [context]: next }
    writeTabs(byContext)
    useBuildWebTaskTabs.setState({ byContext })
  }
  if (lastShownId !== undefined) {
    useBuildWebTaskTabs.setState({ lastShownId })
  }
}

function currentTabs(): readonly BuildWebTaskTab[] {
  const context = useBuildWebStore.getState().contextKey
  return (context ? useBuildWebTaskTabs.getState().byContext[context] : undefined) ?? NO_TABS
}

/** The task whose card fills the page, which is the active tab; null while the list shows. */
export function activeTaskTabId(state: {
  openIssueId: string | null
  fullScreen: boolean
}): string | null {
  return state.fullScreen ? state.openIssueId : null
}

/** Makes the card on the page a tab: a new one goes right after the one it was opened from. */
export function keepTaskTab(id: string): void {
  update((tabs) => {
    if (tabs.some((tab) => tab.id === id)) {
      return tabs
    }
    const row = useBuildWebStore.getState().issues.find((issue) => issue.id === id)
    const entry: BuildWebTaskTab = {
      id,
      key: row?.key ?? null,
      title: row?.title ?? null,
      cardTab: 'overview'
    }
    const after = tabs.findIndex((tab) => tab.id === useBuildWebTaskTabs.getState().lastShownId)
    const next =
      after === -1
        ? [...tabs, entry]
        : [...tabs.slice(0, after + 1), entry, ...tabs.slice(after + 1)]
    return next.slice(-TABS_KEPT)
  }, id)
}

/** Names a tab once its card has read the task. */
export function labelTaskTab(id: string, key: string, title: string): void {
  update((tabs) =>
    tabs.some((tab) => tab.id === id && (tab.key !== key || tab.title !== title))
      ? tabs.map((tab) => (tab.id === id ? { ...tab, key, title } : tab))
      : tabs
  )
}

// Why a subscription: a card is left by a tab, Escape, its own Back or a link to another task
// alike, and each leaves the card's own tab in `prev` for the task's tab to come back to.
useBuildWebStore.subscribe((state, prev) => {
  const left = activeTaskTabId(prev)
  if (!left || left === activeTaskTabId(state) || state.contextKey !== prev.contextKey) {
    return
  }
  update((tabs) =>
    tabs.some((tab) => tab.id === left && tab.cardTab !== prev.openTab)
      ? tabs.map((tab) => (tab.id === left ? { ...tab, cardTab: prev.openTab } : tab))
      : tabs
  )
})

export function showTaskTab(id: string): void {
  const tab = currentTabs().find((entry) => entry.id === id)
  useBuildWebStore.getState().openIssue(id, true, tab?.cardTab ?? 'overview')
}

export function showTaskList(): void {
  useBuildWebStore.getState().openIssue(null)
}

/** Closing the tab on show moves to its right-hand neighbour, else its left, else the list. */
export function closeTaskTab(id: string): void {
  const tabs = currentTabs()
  const index = tabs.findIndex((tab) => tab.id === id)
  const next = tabs.filter((tab) => tab.id !== id)
  update(() => next)
  if (activeTaskTabId(useBuildWebStore.getState()) !== id) {
    return
  }
  const neighbour = next[index] ?? next[index - 1]
  if (neighbour) {
    showTaskTab(neighbour.id)
  } else {
    useBuildWebStore.getState().openIssue(null)
  }
}
