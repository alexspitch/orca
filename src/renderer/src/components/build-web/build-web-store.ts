import { create } from 'zustand'
import {
  BUILD_WEB_OPEN_STATUSES,
  BUILD_WEB_STATUSES,
  type BuildWebConnectionStatus,
  type BuildWebIssueQuery,
  type BuildWebIssueRow,
  type BuildWebIssueSort,
  type BuildWebIssueSummaryQuery,
  type BuildWebProduct,
  type BuildWebStatus
} from '../../../../shared/build-web-types'
import type { BuildWebTrainRun } from '../../../../shared/build-web-train-types'
import {
  nextSort,
  readViewPrefs,
  writeViewPrefs,
  type IssueSortState,
  type QuickFilter
} from './build-web-view-prefs'

/** The full-screen card's tabs, as build-web's task card has them. */
export const BUILD_WEB_CARD_TABS = [
  'overview',
  'plan',
  'mockups',
  'build',
  'guide',
  'commits',
  'subtasks'
] as const
export type BuildWebCardTab = (typeof BUILD_WEB_CARD_TABS)[number]

/** The statuses a task is still being worked in — the list's default. */
export const OPEN_STATUSES = BUILD_WEB_OPEN_STATUSES

/** «К работе» in build-web: what is waiting for hands, not for a train or a tester. */
export const TO_WORK_STATUSES: readonly BuildWebStatus[] = [
  'todo',
  'planned',
  'inprogress',
  'build_failed'
]

/** What a page opens on when a notification leads there; the page takes it once. */
export type BuildWebFocus =
  | { kind: 'train'; trainId: string; run: BuildWebTrainRun | null }
  | { kind: 'image'; image: string }

export function sameStatuses(set: ReadonlySet<BuildWebStatus>, list: readonly BuildWebStatus[]) {
  return set.size === list.length && list.every((s) => set.has(s))
}

type BuildWebState = {
  /** Which host's answer `status` is: a reply from a host the page left is dropped. */
  contextKey: string | null
  status: BuildWebConnectionStatus | null
  /** Quick filters, combined; none means every task. */
  quick: ReadonlySet<QuickFilter>
  sort: IssueSortState
  page: number
  drawerWidth: number
  panelWidths: Readonly<Record<string, number>>
  query: string
  /** The statuses shown; empty means any status. */
  statuses: ReadonlySet<BuildWebStatus>
  product: BuildWebProduct | 'all'
  issues: BuildWebIssueRow[]
  total: number
  loading: boolean
  error: string | null
  selected: ReadonlySet<string>
  openIssueId: string | null
  fullScreen: boolean
  /** The full-screen card was expanded from the side card, so collapsing returns there. */
  fullScreenFromDrawer: boolean
  /** The worktree «Take to work» used last. */
  lastWorktreeId: string | null
  setStatus: (contextKey: string, status: BuildWebConnectionStatus) => void
  toggleQuick: (filter: QuickFilter) => void
  sortBy: (sort: BuildWebIssueSort) => void
  setPage: (page: number) => void
  setDrawerWidth: (width: number) => void
  setPanelWidth: (panel: string, width: number) => void
  setQuery: (query: string) => void
  toggleStatus: (status: BuildWebStatus) => void
  setStatuses: (statuses: readonly BuildWebStatus[]) => void
  setProduct: (product: BuildWebProduct | 'all') => void
  setLoading: () => void
  setIssues: (issues: BuildWebIssueRow[], total: number) => void
  setError: (error: string) => void
  patchIssue: (id: string, patch: Partial<BuildWebIssueRow>) => void
  toggleSelected: (id: string) => void
  clearSelection: () => void
  /** The full-screen card's tab: the one it opens on, then the one shown, so Back restores it. */
  openTab: BuildWebCardTab
  openIssue: (id: string | null, fullScreen?: boolean, tab?: BuildWebCardTab) => void
  expandToFullScreen: () => void
  /** Back one level: to the side card it came from, or to the list. */
  collapseFullScreen: () => void
  rememberTakeToWork: (worktreeId: string) => void
  focus: BuildWebFocus | null
  setFocus: (focus: BuildWebFocus | null) => void
}

const prefs = readViewPrefs()

export const ISSUE_PAGE_SIZE = 50
/** The quick filters an older host knows as its single `view`. */
const VIEW_FILTERS = ['mine', 'ai', 'favorite'] as const

export const useBuildWebStore = create<BuildWebState>()((set) => ({
  contextKey: null,
  status: null,
  quick: new Set(prefs.quick),
  sort: prefs.sort,
  page: 0,
  drawerWidth: prefs.drawerWidth,
  panelWidths: prefs.panelWidths,
  query: '',
  statuses: new Set(prefs.statuses ?? OPEN_STATUSES),
  product: 'all',
  issues: [],
  total: 0,
  loading: false,
  error: null,
  selected: new Set(),
  openIssueId: null,
  openTab: 'overview',
  fullScreen: false,
  fullScreenFromDrawer: false,
  lastWorktreeId: null,
  setStatus: (contextKey, status) =>
    set((state) =>
      // Why: another host's tasks must not stay on screen under this host's account.
      state.contextKey === contextKey
        ? { status }
        : { contextKey, status, issues: [], total: 0, selected: new Set(), openIssueId: null }
    ),
  toggleQuick: (filter) =>
    set((state) => {
      const quick = new Set(state.quick)
      if (!quick.delete(filter)) {
        quick.add(filter)
      }
      // Why the archive is not kept: a restart must land on the live tasks, not on put-away ones.
      writeViewPrefs({ quick: [...quick].filter((q) => q !== 'archived') })
      return { quick, page: 0 }
    }),
  sortBy: (by) =>
    set((state) => {
      const sort = nextSort(state.sort, by)
      writeViewPrefs({ sort })
      return { sort, page: 0 }
    }),
  setPage: (page) => set({ page: Math.max(0, page) }),
  setDrawerWidth: (drawerWidth) => {
    writeViewPrefs({ drawerWidth })
    set({ drawerWidth })
  },
  setPanelWidth: (panel, width) =>
    set((state) => {
      const panelWidths = { ...state.panelWidths, [panel]: width }
      writeViewPrefs({ panelWidths })
      return { panelWidths }
    }),
  // Why page 0: a narrower filter may have fewer pages than the one being read.
  setQuery: (query) => set({ query, page: 0 }),
  toggleStatus: (status) =>
    set((state) => {
      const statuses = new Set(state.statuses)
      if (!statuses.delete(status)) {
        statuses.add(status)
      }
      writeViewPrefs({ statuses: [...statuses] })
      return { statuses, page: 0 }
    }),
  setStatuses: (list) => {
    writeViewPrefs({ statuses: [...list] })
    set({ statuses: new Set(list), page: 0 })
  },
  setProduct: (product) => set({ product, page: 0 }),
  setLoading: () => set({ loading: true }),
  setIssues: (issues, total) =>
    set((state) => {
      // Why: a selection must not hold tasks the list no longer shows — Take to work would send them.
      const shown = new Set(issues.map((issue) => issue.id))
      const selected = new Set([...state.selected].filter((id) => shown.has(id)))
      // Why: a page past the end (the list shrank) would read as «nothing matches».
      const page =
        issues.length === 0 && state.page > 0 && total > 0
          ? Math.ceil(total / ISSUE_PAGE_SIZE) - 1
          : state.page
      return { issues, total, page, loading: false, error: null, selected }
    }),
  setError: (error) => set({ loading: false, error }),
  patchIssue: (id, patch) =>
    set((state) => ({
      issues: state.issues.map((issue) => (issue.id === id ? { ...issue, ...patch } : issue))
    })),
  toggleSelected: (id) =>
    set((state) => {
      const selected = new Set(state.selected)
      if (!selected.delete(id)) {
        selected.add(id)
      }
      return { selected }
    }),
  clearSelection: () => set({ selected: new Set() }),
  openIssue: (openIssueId, fullScreen = false, openTab = 'overview') =>
    set({ openIssueId, fullScreen, fullScreenFromDrawer: false, openTab }),
  expandToFullScreen: () =>
    set((state) =>
      state.openIssueId ? { fullScreen: true, fullScreenFromDrawer: true, openTab: 'overview' } : {}
    ),
  collapseFullScreen: () =>
    set((state) =>
      state.fullScreenFromDrawer
        ? { fullScreen: false, fullScreenFromDrawer: false }
        : { fullScreen: false, openIssueId: null }
    ),
  rememberTakeToWork: (lastWorktreeId) => set({ lastWorktreeId }),
  focus: null,
  setFocus: (focus) => set({ focus })
}))

/** The list request for the current filters, sort and page. */
export function issueQueryOf(
  state: Pick<BuildWebState, 'quick' | 'sort' | 'page' | 'query' | 'statuses' | 'product'>
): BuildWebIssueQuery {
  return {
    // Why: a host older than the flags reads only `view`, which holds one quick filter at most.
    view: VIEW_FILTERS.find((q) => state.quick.has(q)) ?? 'all',
    mine: state.quick.has('mine'),
    ai: state.quick.has('ai'),
    favorite: state.quick.has('favorite'),
    jira: state.quick.has('jira'),
    // Why only when on: the flag needs a host that knows it, the live list does not.
    ...(state.quick.has('archived') ? { archived: true } : {}),
    sort: state.sort.sort,
    dir: state.sort.dir,
    limit: ISSUE_PAGE_SIZE,
    offset: state.page * ISSUE_PAGE_SIZE,
    q: state.query.trim() || undefined,
    status: state.statuses.size
      ? BUILD_WEB_STATUSES.filter((s) => state.statuses.has(s))
      : undefined,
    product: state.product === 'all' ? undefined : [state.product],
    // As build-web's list: each task with its subtasks right under it.
    tree: true
  }
}

/** The filters the sidebar's blocker count follows: the list's, without its search and paging. */
export function issueSummaryQueryOf(
  state: Pick<BuildWebState, 'quick' | 'statuses' | 'product' | 'query'>
): BuildWebIssueSummaryQuery {
  return {
    mine: state.quick.has('mine'),
    ai: state.quick.has('ai'),
    favorite: state.quick.has('favorite'),
    jira: state.quick.has('jira'),
    // Why the page's choice as it is: the host counts its open statuses only, all of them for none.
    status: BUILD_WEB_STATUSES.filter((s) => state.statuses.has(s)),
    product: state.product === 'all' ? undefined : [state.product],
    q: state.query.trim() || undefined
  }
}
