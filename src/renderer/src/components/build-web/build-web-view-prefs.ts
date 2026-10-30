import {
  BUILD_WEB_ASSIGNEE_ME,
  BUILD_WEB_ISSUE_SORTS,
  BUILD_WEB_STATUSES,
  type BuildWebIssueSort,
  type BuildWebStatus
} from '../../../../shared/build-web-types'

// Per-viewer conveniences kept in localStorage (as the GitHub project column widths are): the
// Issues page's quick filters and sort, and the side card's width. Lost storage just means defaults.

export const QUICK_FILTERS = ['ai', 'favorite', 'jira', 'archived'] as const
export type QuickFilter = (typeof QUICK_FILTERS)[number]

export type IssueSortState = { sort: BuildWebIssueSort; dir: 'asc' | 'desc' }

export const RECAP_VIEWS = ['calendar', 'list'] as const
export type RecapView = (typeof RECAP_VIEWS)[number]

export const DRAWER_MIN_WIDTH = 420
export const DRAWER_DEFAULT_WIDTH = 560

type ViewPrefs = {
  quick: QuickFilter[]
  /** Null until the person picks: the list then shows the open statuses. */
  statuses: BuildWebStatus[] | null
  /** The assignee filter: logins, nobody and Mine; Mine alone until the person picks. */
  assignees: string[]
  sort: IssueSortState
  drawerWidth: number
  /** The sized side of each split (a full-screen card tab, the Recaps list), by panel. */
  panelWidths: Record<string, number>
  /** How a task's build list is narrowed — its own, by run id, as build-web keeps it. */
  runFilters: Record<string, RunFilter>
  /** Hide the images not built yet, in every build list. */
  hidePending: boolean
  /** Every family folded in the list; `folded` then holds the ones opened by hand. */
  foldAll: boolean
  /** The tasks whose subtasks were toggled by hand against `foldAll`. */
  folded: string[]
  /** Recaps as a month's calendar or as the list of reports. */
  recapView: RecapView
  /** The Images list's filters; the search text and page start fresh. */
  imageFilters: ImageFilters
}

export type ImageFilters = {
  products: string[]
  dists: string[]
  statuses: string[]
  version: string
}
export const NO_IMAGE_FILTERS: ImageFilters = {
  products: [],
  dists: [],
  statuses: [],
  version: 'all'
}

export const RUN_DISTS = ['all', 'rhel', 'redos'] as const
export const RUN_PRODUCT_FILTERS = ['all', 'sa', 'dc', 'ap', 'storage', 'cp'] as const
export type RunFilter = {
  dist: (typeof RUN_DISTS)[number]
  product: (typeof RUN_PRODUCT_FILTERS)[number]
}
// Why a cap: one entry per build ever opened would grow without end.
const RUN_FILTERS_KEPT = 30
const FOLDED_KEPT = 200

const STORAGE_KEY = 'orca.buildWeb.viewPrefs'
const DEFAULTS: ViewPrefs = {
  quick: [],
  statuses: null,
  assignees: [BUILD_WEB_ASSIGNEE_ME],
  sort: { sort: 'updated_at', dir: 'desc' },
  drawerWidth: DRAWER_DEFAULT_WIDTH,
  panelWidths: {},
  runFilters: {},
  hidePending: false,
  foldAll: false,
  folded: [],
  recapView: 'calendar',
  imageFilters: NO_IMAGE_FILTERS
}

const stringsOf = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string') : []

function imageFiltersOf(raw: unknown): ImageFilters {
  if (!raw || typeof raw !== 'object') {
    return NO_IMAGE_FILTERS
  }
  const v = Object.fromEntries(Object.entries(raw))
  return {
    products: stringsOf(v.products),
    dists: stringsOf(v.dists),
    statuses: stringsOf(v.statuses),
    version: typeof v.version === 'string' && v.version ? v.version : 'all'
  }
}

function runFiltersOf(raw: unknown): Record<string, RunFilter> {
  const out: Record<string, RunFilter> = {}
  if (!raw || typeof raw !== 'object') {
    return out
  }
  for (const [runId, value] of Object.entries(raw).slice(-RUN_FILTERS_KEPT)) {
    const v = value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)) : {}
    out[runId] = {
      dist: RUN_DISTS.find((d) => d === v.dist) ?? 'all',
      product: RUN_PRODUCT_FILTERS.find((p) => p === v.product) ?? 'all'
    }
  }
  return out
}

function prefsOf(raw: unknown): ViewPrefs {
  if (!raw || typeof raw !== 'object') {
    return DEFAULTS
  }
  const v = Object.fromEntries(Object.entries(raw))
  const quick = Array.isArray(v.quick)
    ? QUICK_FILTERS.filter((q) => v.quick.includes(q))
    : DEFAULTS.quick
  const sortRaw =
    v.sort && typeof v.sort === 'object' ? Object.fromEntries(Object.entries(v.sort)) : {}
  const sort = BUILD_WEB_ISSUE_SORTS.find((s) => s === sortRaw.sort)
  const width =
    typeof v.drawerWidth === 'number' && Number.isFinite(v.drawerWidth) ? v.drawerWidth : null
  const statuses = Array.isArray(v.statuses)
    ? BUILD_WEB_STATUSES.filter((s) => v.statuses.includes(s))
    : null
  // Why the quick filters: Mine was one of them before the assignee list, kept as it was left.
  const assignees = Array.isArray(v.assignees)
    ? stringsOf(v.assignees)
    : Array.isArray(v.quick) && !v.quick.includes('mine')
      ? []
      : DEFAULTS.assignees
  const panelWidths: Record<string, number> = {}
  if (v.panelWidths && typeof v.panelWidths === 'object') {
    for (const [key, value] of Object.entries(v.panelWidths)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        panelWidths[key] = Math.round(value)
      }
    }
  }
  return {
    quick,
    statuses,
    assignees,
    panelWidths,
    runFilters: runFiltersOf(v.runFilters),
    hidePending: v.hidePending === true,
    foldAll: v.foldAll === true,
    folded: Array.isArray(v.folded)
      ? v.folded.filter((id): id is string => typeof id === 'string').slice(-FOLDED_KEPT)
      : [],
    recapView: RECAP_VIEWS.find((view) => view === v.recapView) ?? DEFAULTS.recapView,
    imageFilters: imageFiltersOf(v.imageFilters),
    sort: sort ? { sort, dir: sortRaw.dir === 'asc' ? 'asc' : 'desc' } : DEFAULTS.sort,
    drawerWidth:
      width === null ? DEFAULTS.drawerWidth : Math.max(DRAWER_MIN_WIDTH, Math.round(width))
  }
}

export function readViewPrefs(): ViewPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? prefsOf(JSON.parse(raw)) : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function writeViewPrefs(patch: Partial<ViewPrefs>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readViewPrefs(), ...patch }))
  } catch {
    // Storage may be disabled; the preference just won't survive this session.
  }
}

/** A click on a column: the same column flips its direction, another starts in its natural one. */
export function nextSort(current: IssueSortState, sort: BuildWebIssueSort): IssueSortState {
  if (current.sort === sort) {
    return { sort, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  }
  return { sort, dir: sort === 'priority' || sort === 'updated_at' ? 'desc' : 'asc' }
}

/** A task build's filters; a build never narrowed shows everything. */
export function readRunFilter(runId: string): RunFilter {
  return readViewPrefs().runFilters[runId] ?? { dist: 'all', product: 'all' }
}

export function writeRunFilter(runId: string, filter: RunFilter): void {
  const { [runId]: _previous, ...rest } = readViewPrefs().runFilters
  writeViewPrefs({ runFilters: runFiltersOf({ ...rest, [runId]: filter }) })
}
