import {
  EMPTY_BUILD_WEB_SAVED_FILTER,
  type BuildWebSavedFilter,
  type BuildWebSavedQuery
} from '../../shared/build-web-saved-query-types'
import {
  BUILD_WEB_PRODUCTS,
  type BuildWebMutationResult,
  type BuildWebProduct
} from '../../shared/build-web-types'
import { requireBuildWebCredential } from './build-web-connection'
import { buildWebMutation, buildWebRequest } from './build-web-request'
import { recordOf, recordsOf, textOf } from './build-web-response-fields'
import { getStoredBuildWebMetadata } from './credential-store'

// The Issues table's saved filters, as build-web keeps them: per product, the viewer's own plus
// everybody's shared ones, and only the owner may delete one.

const KIND = 'issues'
const LIST_FIELDS = [
  'product',
  'type',
  'status',
  'version',
  'verdict',
  'jira',
  'author',
  'assignee',
  'stand',
  'mode'
] as const
const FLAGS = ['rootOnly', 'favorite', 'mine', 'ai'] as const

/** A stored filter, any field of the wrong shape taken as empty: it outlives the build that wrote it. */
export function savedFilterOf(raw: unknown): BuildWebSavedFilter {
  const v = recordOf(raw) ?? {}
  const out: BuildWebSavedFilter = { ...EMPTY_BUILD_WEB_SAVED_FILTER }
  for (const key of LIST_FIELDS) {
    const list = v[key]
    out[key] = Array.isArray(list) ? list.map(String).filter(Boolean) : []
  }
  for (const key of FLAGS) {
    out[key] = v[key] === true
  }
  out.q = textOf(v.q)
  out.from = textOf(v.from)
  out.to = textOf(v.to)
  return out
}

function savedQueryOf(r: Record<string, unknown>, viewer: string): BuildWebSavedQuery | null {
  const product = BUILD_WEB_PRODUCTS.find((p) => p === r.product)
  if (typeof r.id !== 'string' || !product) {
    return null
  }
  const owner = textOf(r.owner)
  return {
    id: r.id,
    name: textOf(r.name),
    product,
    owner,
    mine: owner.toLowerCase() === viewer,
    shared: r.shared === true,
    filter: savedFilterOf(r.filter)
  }
}

const viewerLogin = () => (getStoredBuildWebMetadata()?.login ?? '').trim().toLowerCase()

/** The saved filters of these products, by name; one stored under two of them is listed once. */
export async function listBuildWebSavedQueries(
  products: readonly BuildWebProduct[]
): Promise<BuildWebSavedQuery[]> {
  const credential = requireBuildWebCredential()
  const viewer = viewerLogin()
  const settled = await Promise.allSettled(
    products.map((product) =>
      buildWebRequest({
        ...credential,
        path: `/api/tms/filters?product=${encodeURIComponent(product)}&kind=${KIND}`
      })
    )
  )
  // Why one refusal is not the list's: a product the viewer may not read hides its filters only.
  const answers = settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
  const refused = settled.find((r) => r.status === 'rejected')
  if (answers.length === 0 && refused) {
    throw refused.reason
  }
  const byId = new Map<string, BuildWebSavedQuery>()
  for (const answer of answers) {
    for (const row of recordsOf(recordOf(answer)?.filters)) {
      const query = savedQueryOf(row, viewer)
      if (query && !byId.has(query.id)) {
        byId.set(query.id, query)
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Save under a name; the viewer's filter of the same name and product is replaced. */
export function saveBuildWebSavedQuery(args: {
  product: BuildWebProduct
  name: string
  shared: boolean
  filter: BuildWebSavedFilter
}): Promise<BuildWebMutationResult<BuildWebSavedQuery>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = await buildWebRequest({
      ...credential,
      method: 'POST',
      path: '/api/tms/filters',
      body: { ...args, kind: KIND }
    })
    const saved = savedQueryOf(recordOf(recordOf(answer)?.filter) ?? {}, viewerLogin())
    if (!saved) {
      throw new Error('build-web did not return the saved query')
    }
    return saved
  })
}

/** Only the owner's own; the console answers 404 for somebody else's. */
export function deleteBuildWebSavedQuery(id: string): Promise<BuildWebMutationResult<true>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    await buildWebRequest({
      ...credential,
      method: 'DELETE',
      path: `/api/tms/filters/${encodeURIComponent(id)}`
    })
    return true as const
  })
}
