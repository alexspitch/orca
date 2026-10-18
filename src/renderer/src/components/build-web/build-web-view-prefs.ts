import {
  BUILD_WEB_ISSUE_SORTS,
  BUILD_WEB_STATUSES,
  type BuildWebIssueSort,
  type BuildWebStatus
} from '../../../../shared/build-web-types'

// Per-viewer conveniences kept in localStorage (as the GitHub project column widths are): the
// Issues page's quick filters and sort, and the side card's width. Lost storage just means defaults.

export const QUICK_FILTERS = ['mine', 'ai', 'favorite', 'jira'] as const
export type QuickFilter = (typeof QUICK_FILTERS)[number]

export type IssueSortState = { sort: BuildWebIssueSort; dir: 'asc' | 'desc' }

export const DRAWER_MIN_WIDTH = 420
export const DRAWER_DEFAULT_WIDTH = 560

type ViewPrefs = {
  quick: QuickFilter[]
  /** Null until the person picks: the list then shows the open statuses. */
  statuses: BuildWebStatus[] | null
  sort: IssueSortState
  drawerWidth: number
  /** The side panel of each full-screen card tab, by tab. */
  panelWidths: Record<string, number>
}

const STORAGE_KEY = 'orca.buildWeb.viewPrefs'
const DEFAULTS: ViewPrefs = {
  quick: ['mine'],
  statuses: null,
  sort: { sort: 'updated_at', dir: 'desc' },
  drawerWidth: DRAWER_DEFAULT_WIDTH,
  panelWidths: {}
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
    panelWidths,
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
