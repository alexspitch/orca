import {
  EMPTY_BUILD_WEB_SAVED_FILTER,
  type BuildWebSavedFilter
} from '../../../../../shared/build-web-saved-query-types'
import {
  BUILD_WEB_ASSIGNEE_ME,
  BUILD_WEB_PRODUCTS,
  BUILD_WEB_STATUSES,
  type BuildWebProduct,
  type BuildWebStatus
} from '../../../../../shared/build-web-types'
import { assigneeFilterQuery } from '../build-web-assignee-options'
import type { QuickFilter } from '../build-web-view-prefs'

// Orca's Issues filters and build-web's saved filter, each way. The console's table narrows by more
// than Orca's list does; those fields are named, never silently applied as something else.

export type IssuesView = {
  quick: ReadonlySet<QuickFilter>
  statuses: ReadonlySet<BuildWebStatus>
  products: ReadonlySet<BuildWebProduct>
  assignees: ReadonlySet<string>
  query: string
}

export type AppliedSavedFilter = {
  quick: QuickFilter[]
  statuses: BuildWebStatus[]
  products: BuildWebProduct[]
  assignees: string[]
  query: string
  /** The filter's fields Orca's list does not narrow by. */
  unsupported: string[]
}

/**
 * What the list shows now, as the console saves it; the archive and the sort are not part of it.
 * Mine alone is saved as the console's Mine, so a shared query means each reader's own tasks.
 */
export function savedFilterOfView(view: IssuesView, me: string | null): BuildWebSavedFilter {
  const { mine, assignee } = assigneeFilterQuery(view.assignees, me)
  return {
    ...EMPTY_BUILD_WEB_SAVED_FILTER,
    q: view.query.trim(),
    product: BUILD_WEB_PRODUCTS.filter((p) => view.products.has(p)),
    assignee: assignee ?? [],
    status: BUILD_WEB_STATUSES.filter((s) => view.statuses.has(s)),
    jira: view.quick.has('jira') ? ['yes'] : [],
    favorite: view.quick.has('favorite'),
    mine: mine === true,
    ai: view.quick.has('ai')
  }
}

// Why a fixed one: the console files every filter under a product; one for all products goes here.
const ALL_PRODUCTS_STORAGE: BuildWebProduct = 'dc'

/** Where the console files a filter: its own product, or a fixed one when it names none or several. */
export function storageProductOf(filter: BuildWebSavedFilter): BuildWebProduct {
  const products = BUILD_WEB_PRODUCTS.filter((p) => filter.product.includes(p))
  return products.length === 1 ? products[0] : ALL_PRODUCTS_STORAGE
}

const OTHER_LISTS = ['type', 'version', 'verdict', 'author', 'stand', 'mode'] as const

/** A saved filter as Orca's list reads it, with what it could not apply. */
export function viewOfSavedFilter(filter: BuildWebSavedFilter): AppliedSavedFilter {
  const unsupported: string[] = OTHER_LISTS.filter((key) => filter[key].length > 0)
  // Why only `yes`: Orca's quick filter is «linked to Jira»; «not linked» has no switch.
  const jiraYes = filter.jira.includes('yes') && !filter.jira.includes('no')
  if (filter.jira.includes('no')) {
    unsupported.push('jira')
  }
  if (filter.from || filter.to) {
    unsupported.push('dates')
  }
  if (filter.rootOnly) {
    unsupported.push('rootOnly')
  }
  // Why Mine wins: the console ANDs its Mine with the assignees, so the tasks shown are the reader's
  // own at most; the list's assignees are ORed and cannot say that.
  if (filter.mine && filter.assignee.length > 0) {
    unsupported.push('assignee')
  }
  const quick: QuickFilter[] = []
  if (filter.ai) {
    quick.push('ai')
  }
  if (filter.favorite) {
    quick.push('favorite')
  }
  if (jiraYes) {
    quick.push('jira')
  }
  return {
    quick,
    statuses: BUILD_WEB_STATUSES.filter((s) => filter.status.includes(s)),
    products: BUILD_WEB_PRODUCTS.filter((p) => filter.product.includes(p)),
    assignees: filter.mine ? [BUILD_WEB_ASSIGNEE_ME] : [...filter.assignee],
    query: filter.q,
    unsupported
  }
}
