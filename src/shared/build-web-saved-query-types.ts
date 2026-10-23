import type { BuildWebProduct } from './build-web-types'

// build-web's saved filters of the Issues table (`/api/tms/filters?kind=issues`), the console's own
// shape: Orca applies the fields its list knows and says which others a filter holds.

export type BuildWebSavedFilter = {
  q: string
  /** None means every product. */
  product: string[]
  type: string[]
  status: string[]
  version: string[]
  verdict: string[]
  /** `yes` — linked to Jira, `no` — not. */
  jira: string[]
  author: string[]
  assignee: string[]
  stand: string[]
  mode: string[]
  from: string
  to: string
  rootOnly: boolean
  favorite: boolean
  mine: boolean
  ai: boolean
}

export const EMPTY_BUILD_WEB_SAVED_FILTER: BuildWebSavedFilter = {
  q: '',
  product: [],
  type: [],
  status: [],
  version: [],
  verdict: [],
  jira: [],
  author: [],
  assignee: [],
  stand: [],
  mode: [],
  from: '',
  to: '',
  rootOnly: false,
  favorite: false,
  mine: false,
  ai: false
}

export type BuildWebSavedQuery = {
  id: string
  name: string
  /** The product it is stored under; the console lists them per product. */
  product: BuildWebProduct
  owner: string
  /** The viewer's own: only these can be deleted. */
  mine: boolean
  /** Everybody sees it, not only its owner. */
  shared: boolean
  filter: BuildWebSavedFilter
}
