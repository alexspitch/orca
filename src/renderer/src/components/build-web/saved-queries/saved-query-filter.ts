import {
  EMPTY_BUILD_WEB_SAVED_FILTER,
  type BuildWebSavedFilter
} from '../../../../../shared/build-web-saved-query-types'
import {
  BUILD_WEB_PRODUCTS,
  BUILD_WEB_STATUSES,
  type BuildWebProduct,
  type BuildWebStatus
} from '../../../../../shared/build-web-types'
import type { QuickFilter } from '../build-web-view-prefs'

// Orca's Issues filters and build-web's saved filter, each way. The console's table narrows by more
// than Orca's list does; those fields are named, never silently applied as something else.

export type IssuesView = {
  quick: ReadonlySet<QuickFilter>
  statuses: ReadonlySet<BuildWebStatus>
  product: BuildWebProduct | 'all'
  query: string
}

export type AppliedSavedFilter = {
  quick: QuickFilter[]
  statuses: BuildWebStatus[]
  product: BuildWebProduct | 'all'
  query: string
  /** The filter's fields Orca's list does not narrow by. */
  unsupported: string[]
}

/** What the list shows now, as the console saves it; the archive and the sort are not part of it. */
export function savedFilterOfView(view: IssuesView): BuildWebSavedFilter {
  return {
    ...EMPTY_BUILD_WEB_SAVED_FILTER,
    q: view.query.trim(),
    product: view.product === 'all' ? [] : [view.product],
    status: BUILD_WEB_STATUSES.filter((s) => view.statuses.has(s)),
    jira: view.quick.has('jira') ? ['yes'] : [],
    favorite: view.quick.has('favorite'),
    mine: view.quick.has('mine'),
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

const OTHER_LISTS = ['type', 'version', 'verdict', 'author', 'assignee', 'stand', 'mode'] as const

/** A saved filter as Orca's list reads it, with what it could not apply. */
export function viewOfSavedFilter(filter: BuildWebSavedFilter): AppliedSavedFilter {
  const unsupported: string[] = OTHER_LISTS.filter((key) => filter[key].length > 0)
  const products = BUILD_WEB_PRODUCTS.filter((p) => filter.product.includes(p))
  // Why 'all' for several: Orca's list picks one product or every one.
  if (products.length > 1) {
    unsupported.push('product')
  }
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
  const quick: QuickFilter[] = []
  if (filter.mine) {
    quick.push('mine')
  }
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
    product: products.length === 1 ? products[0] : 'all',
    query: filter.q,
    unsupported
  }
}
