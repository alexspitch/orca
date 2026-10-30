import {
  BUILD_WEB_OPEN_STATUSES,
  BUILD_WEB_PRODUCTS,
  BUILD_WEB_STATUSES,
  type BuildWebIssueQuery,
  type BuildWebProduct,
  type BuildWebStatus
} from '../../../../src/shared/build-web-types'
import type {
  IssueSortState,
  QuickFilter
} from '../../../../src/renderer/src/components/build-web/build-web-view-prefs'

// The desktop build-web-store's list request, without zustand: filters, sort and page in, query out.

export const ISSUE_PAGE_SIZE = 50

/** The statuses a task is still being worked in — the list's default. */
export const OPEN_STATUSES = BUILD_WEB_OPEN_STATUSES

/** «To work» in build-web: what is waiting for hands, not for a train or a tester. */
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

export type IssueListView = {
  quick: ReadonlySet<QuickFilter>
  statuses: ReadonlySet<BuildWebStatus>
  products: ReadonlySet<BuildWebProduct>
  assignees: ReadonlySet<string>
  query: string
  sort: IssueSortState
  page: number
}

/** The quick filters an older host knows as its single `view`. */
const VIEW_FILTERS = ['mine', 'ai', 'favorite'] as const

export function sameStatuses(set: ReadonlySet<BuildWebStatus>, list: readonly BuildWebStatus[]) {
  return set.size === list.length && list.every((s) => set.has(s))
}

export function issueQueryOf(view: IssueListView): BuildWebIssueQuery {
  return {
    // Why: a host older than the flags reads only `view`, which holds one quick filter at most.
    view: VIEW_FILTERS.find((q) => view.quick.has(q)) ?? 'all',
    mine: view.quick.has('mine'),
    ai: view.quick.has('ai'),
    favorite: view.quick.has('favorite'),
    jira: view.quick.has('jira'),
    // Why only when on: the flag needs a host that knows it, the live list does not.
    ...(view.quick.has('archived') ? { archived: true } : {}),
    sort: view.sort.sort,
    dir: view.sort.dir,
    limit: ISSUE_PAGE_SIZE,
    offset: view.page * ISSUE_PAGE_SIZE,
    q: view.query.trim() || undefined,
    status: view.statuses.size ? BUILD_WEB_STATUSES.filter((s) => view.statuses.has(s)) : undefined,
    product: view.products.size
      ? BUILD_WEB_PRODUCTS.filter((p) => view.products.has(p))
      : undefined,
    // Why sorted: the same choice is the same request, whatever order it was ticked in.
    assignee: view.assignees.size ? [...view.assignees].sort() : undefined,
    // As build-web's list: each task with its subtasks right under it.
    tree: true
  }
}
