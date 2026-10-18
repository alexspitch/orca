import { create } from 'zustand'
import {
  BUILD_WEB_STATUSES,
  type BuildWebConnectionStatus,
  type BuildWebIssueQuery,
  type BuildWebIssueRow,
  type BuildWebIssueSort,
  type BuildWebProduct,
  type BuildWebStatus
} from '../../../../shared/build-web-types'
import {
  nextSort,
  readViewPrefs,
  writeViewPrefs,
  type IssueSortState,
  type QuickFilter
} from './build-web-view-prefs'

/** The statuses a task is still being worked in — the list's default. */
export const OPEN_STATUSES: readonly BuildWebStatus[] = [
  'todo',
  'planned',
  'inprogress',
  'paused',
  'awaiting_response',
  'deploying',
  'build_failed',
  'testing',
  'testing_external'
]

/** «К работе» in build-web: what is waiting for hands, not for a train or a tester. */
export const TO_WORK_STATUSES: readonly BuildWebStatus[] = [
  'todo',
  'planned',
  'inprogress',
  'build_failed'
]

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
  /** The worktree «Take to work» used last, and whether it worked in it (`-no-worktree`). */
  lastWorktreeId: string | null
  noWorktree: boolean
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
  openIssue: (id: string | null, fullScreen?: boolean) => void
  expandToFullScreen: () => void
  /** Back one level: to the side card it came from, or to the list. */
  collapseFullScreen: () => void
  rememberTakeToWork: (worktreeId: string, noWorktree: boolean) => void
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
  fullScreen: false,
  fullScreenFromDrawer: false,
  lastWorktreeId: null,
  noWorktree: true,
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
      writeViewPrefs({ quick: [...quick] })
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
  openIssue: (openIssueId, fullScreen = false) =>
    set({ openIssueId, fullScreen, fullScreenFromDrawer: false }),
  expandToFullScreen: () =>
    set((state) => (state.openIssueId ? { fullScreen: true, fullScreenFromDrawer: true } : {})),
  collapseFullScreen: () =>
    set((state) =>
      state.fullScreenFromDrawer
        ? { fullScreen: false, fullScreenFromDrawer: false }
        : { fullScreen: false, openIssueId: null }
    ),
  rememberTakeToWork: (lastWorktreeId, noWorktree) => set({ lastWorktreeId, noWorktree })
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
    sort: state.sort.sort,
    dir: state.sort.dir,
    limit: ISSUE_PAGE_SIZE,
    offset: state.page * ISSUE_PAGE_SIZE,
    q: state.query.trim() || undefined,
    status: state.statuses.size
      ? BUILD_WEB_STATUSES.filter((s) => state.statuses.has(s))
      : undefined,
    product: state.product === 'all' ? undefined : [state.product]
  }
}
