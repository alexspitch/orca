import { create } from 'zustand'
import {
  BUILD_WEB_OPEN_STATUSES,
  BUILD_WEB_PRODUCTS,
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
import { assigneeFilterQuery } from './build-web-assignee-options'
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

/** What a tab of the list narrows by; the sort and the page are the list's own. */
export type BuildWebListFilters = {
  quick: readonly QuickFilter[]
  statuses: readonly BuildWebStatus[]
  /** None means every product. */
  products: readonly BuildWebProduct[]
  /** Logins and `BUILD_WEB_UNASSIGNED`; none means anyone's. */
  assignees: readonly string[]
  query: string
}

/** What a page opens on when a notification leads there; the page takes it once. */
export type BuildWebFocus =
  | { kind: 'train'; trainId: string; run: BuildWebTrainRun | null }
  | { kind: 'image'; image: string }
  /** IS-10: a test run from the task list, picked in the Testing page's history. */
  | { kind: 'test-run'; runId: string }

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
  /** The products shown; empty means every product. */
  products: ReadonlySet<BuildWebProduct>
  /** The assignees shown, any of them, Mine (`BUILD_WEB_ASSIGNEE_ME`) among them; empty means anyone's. */
  assignees: ReadonlySet<string>
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
  toggleProduct: (product: BuildWebProduct) => void
  setProducts: (products: readonly BuildWebProduct[]) => void
  toggleAssignee: (assignee: string) => void
  setAssignees: (assignees: readonly string[]) => void
  /** The saved query whose tab the list is; null for the plain List, whose filters are kept. */
  queryTabId: string | null
  /** The list as one of its tabs: the plain List or a saved query's, each with its own filters. */
  showListTab: (
    queryTabId: string | null,
    filters: BuildWebListFilters,
    options?: { keepCard?: boolean }
  ) => void
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
/** The quick filters an older host knows as its single `view`, after Mine. */
const VIEW_FILTERS = ['ai', 'favorite'] as const

export const useBuildWebStore = create<BuildWebState>()((set, get) => ({
  contextKey: null,
  status: null,
  quick: new Set(prefs.quick),
  sort: prefs.sort,
  page: 0,
  drawerWidth: prefs.drawerWidth,
  panelWidths: prefs.panelWidths,
  query: '',
  statuses: new Set(prefs.statuses ?? OPEN_STATUSES),
  products: new Set(),
  assignees: new Set(prefs.assignees),
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
        : {
            contextKey,
            status,
            issues: [],
            total: 0,
            selected: new Set(),
            openIssueId: null,
            queryTabId: null
          }
    ),
  toggleQuick: (filter) =>
    set((state) => {
      const quick = toggled(state.quick, filter)
      // Why the archive is not kept: a restart must land on the live tasks, not on put-away ones.
      if (state.queryTabId === null) {
        writeViewPrefs({ quick: [...quick].filter((q) => q !== 'archived') })
      }
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
      const statuses = toggled(state.statuses, status)
      if (state.queryTabId === null) {
        writeViewPrefs({ statuses: [...statuses] })
      }
      return { statuses, page: 0 }
    }),
  setStatuses: (list) => {
    if (get().queryTabId === null) {
      writeViewPrefs({ statuses: [...list] })
    }
    set({ statuses: new Set(list), page: 0 })
  },
  toggleProduct: (product) =>
    set((state) => ({ products: toggled(state.products, product), page: 0 })),
  setProducts: (list) => set({ products: new Set(list), page: 0 }),
  toggleAssignee: (assignee) => get().setAssignees([...toggled(get().assignees, assignee)]),
  setAssignees: (list) => {
    if (get().queryTabId === null) {
      writeViewPrefs({ assignees: [...list] })
    }
    set({ assignees: new Set(list), page: 0 })
  },
  queryTabId: null,
  showListTab: (queryTabId, { quick, statuses, products, assignees, query }, options) =>
    set({
      queryTabId,
      quick: new Set(quick),
      statuses: new Set(statuses),
      products: new Set(products),
      assignees: new Set(assignees),
      query,
      page: 0,
      ...(options?.keepCard
        ? {}
        : { openIssueId: null, fullScreen: false, fullScreenFromDrawer: false })
    }),
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
  toggleSelected: (id) => set((state) => ({ selected: toggled(state.selected, id) })),
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

function toggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set)
  if (!next.delete(value)) {
    next.add(value)
  }
  return next
}

const productsOf = (products: ReadonlySet<BuildWebProduct>): BuildWebProduct[] | undefined =>
  products.size ? BUILD_WEB_PRODUCTS.filter((p) => products.has(p)) : undefined

/** The list request for the current filters, sort and page; `me` is the token owner's login. */
export function issueQueryOf(
  state: Pick<
    BuildWebState,
    'quick' | 'sort' | 'page' | 'query' | 'statuses' | 'products' | 'assignees'
  >,
  me: string | null
): BuildWebIssueQuery {
  const assignee = assigneeFilterQuery(state.assignees, me)
  return {
    // Why: a host older than the flags reads only `view`, which holds one quick filter at most.
    view: assignee.mine ? 'mine' : (VIEW_FILTERS.find((q) => state.quick.has(q)) ?? 'all'),
    ...assignee,
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
    product: productsOf(state.products),
    // As build-web's list: each task with its subtasks right under it.
    tree: true
  }
}

/** The filters the sidebar's blocker count follows: the list's, without its search and paging. */
export function issueSummaryQueryOf(
  state: Pick<BuildWebState, 'quick' | 'statuses' | 'products' | 'assignees' | 'query'>,
  me: string | null
): BuildWebIssueSummaryQuery {
  return {
    ...assigneeFilterQuery(state.assignees, me),
    ai: state.quick.has('ai'),
    favorite: state.quick.has('favorite'),
    jira: state.quick.has('jira'),
    // Why the page's choice as it is: the host counts its open statuses only, all of them for none.
    status: BUILD_WEB_STATUSES.filter((s) => state.statuses.has(s)),
    product: productsOf(state.products),
    q: state.query.trim() || undefined
  }
}
