import {
  BUILD_WEB_OPEN_STATUSES,
  BUILD_WEB_PRODUCTS,
  type BuildWebProduct,
  type BuildWebStatus
} from '../../../../shared/build-web-types'
import {
  assigneeFilterLabel,
  productLabel,
  quickFilterLabel,
  statusLabel
} from '../build-web/build-web-labels'
import { QUICK_FILTERS, type QuickFilter } from '../build-web/build-web-view-prefs'

/**
 * The Issues filters the blocker count is taken within, named as the page shows them; empty when
 * nothing narrows the open tasks. Statuses are the open ones chosen: a closed task is never counted.
 */
export function blockerFilterNames(state: {
  quick: ReadonlySet<QuickFilter>
  statuses: ReadonlySet<BuildWebStatus>
  products: ReadonlySet<BuildWebProduct>
  assignees: ReadonlySet<string>
  /** The viewer's login, to name their own tasks «Mine». */
  me: string | null
  query: string
}): string[] {
  const names = QUICK_FILTERS.filter((q) => state.quick.has(q)).map(quickFilterLabel)
  const products = BUILD_WEB_PRODUCTS.filter((p) => state.products.has(p))
  if (products.length > 0) {
    names.push(products.map(productLabel).join(', '))
  }
  if (state.assignees.size > 0) {
    names.push([...state.assignees].map((a) => assigneeFilterLabel(a, state.me)).join(', '))
  }
  const open = BUILD_WEB_OPEN_STATUSES.filter((s) => state.statuses.has(s))
  if (open.length > 0 && open.length < BUILD_WEB_OPEN_STATUSES.length) {
    names.push(open.map(statusLabel).join(', '))
  }
  const query = state.query.trim()
  if (query) {
    names.push(`«${query}»`)
  }
  return names
}
