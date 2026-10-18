import type {
  BuildWebIssueDetail,
  BuildWebIssuePage,
  BuildWebIssueQuery,
  BuildWebIssueRow,
  BuildWebUser,
  BuildWebVersion
} from '../../shared/build-web-types'
import { requireBuildWebCredential } from './build-web-connection'
import { buildWebRequest } from './build-web-request'
import { issueDetailOf, issueRowOf } from './build-web-issue-mapping'
import { numberOf, recordOf, textOf } from './build-web-response-fields'

const LIST_LIMIT_MAX = 100

/** The query string for a list request: the console's own filter names. */
export function issueListQuery(query: BuildWebIssueQuery): string {
  const params = new URLSearchParams({
    parent: 'root',
    sort: query.sort ?? 'updated_at',
    dir: query.dir ?? 'desc'
  })
  // Why the flags win: an older client sends only `view`, a newer one both (for older hosts).
  const flagged = query.mine !== undefined || query.ai !== undefined || query.favorite !== undefined
  const quick = flagged
    ? { mine: query.mine === true, ai: query.ai === true, favorite: query.favorite === true }
    : { mine: query.view === 'mine', ai: query.view === 'ai', favorite: query.view === 'favorite' }
  for (const [name, on] of Object.entries(quick)) {
    if (on) {
      params.set(name, 'yes')
    }
  }
  const q = query.q?.trim()
  if (q) {
    params.set('q', q)
  }
  if (query.status?.length) {
    params.set('status', query.status.join(','))
  }
  if (query.product?.length) {
    params.set('product', query.product.join(','))
  }
  params.set('limit', String(Math.min(Math.max(query.limit ?? LIST_LIMIT_MAX, 1), LIST_LIMIT_MAX)))
  if (query.offset) {
    params.set('offset', String(query.offset))
  }
  return params.toString()
}

export async function listBuildWebIssues(
  query: BuildWebIssueQuery,
  signal?: AbortSignal
): Promise<BuildWebIssuePage> {
  const credential = requireBuildWebCredential()
  const page = recordOf(
    await buildWebRequest({
      ...credential,
      path: `/api/tms/issues?${issueListQuery(query)}`,
      signal
    })
  )
  const rows = Array.isArray(page?.issues) ? page.issues : []
  const issues = rows
    .map((row) => issueRowOf(credential.baseUrl, row))
    .filter((row): row is BuildWebIssueRow => row !== null)
  return { issues, total: numberOf(page?.total, issues.length) }
}

export async function getBuildWebIssue(
  id: string,
  signal?: AbortSignal
): Promise<BuildWebIssueDetail> {
  const credential = requireBuildWebCredential()
  const detail = issueDetailOf(
    credential.baseUrl,
    await buildWebRequest({
      ...credential,
      path: `/api/tms/issues/${encodeURIComponent(id)}`,
      signal
    })
  )
  if (!detail) {
    throw new Error(`build-web returned no task ${id}`)
  }
  return detail
}

export async function listBuildWebAssignees(): Promise<BuildWebUser[]> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({ ...credential, path: '/api/tms/issues/assignees' })
  )
  const users = Array.isArray(answer?.users) ? answer.users : []
  return users
    .map((u) => recordOf(u))
    .filter((u): u is Record<string, unknown> => u !== null && typeof u.email === 'string')
    .map((u) => ({ email: textOf(u.email), name: textOf(u.name) }))
}

export async function listBuildWebVersions(product: string): Promise<BuildWebVersion[]> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({
      ...credential,
      path: `/api/tms/versions?product=${encodeURIComponent(product)}`
    })
  )
  const versions = Array.isArray(answer?.versions) ? answer.versions : []
  return versions
    .map((v) => recordOf(v))
    .filter((v): v is Record<string, unknown> => v !== null && typeof v.id === 'string')
    .map((v) => ({ id: textOf(v.id), name: textOf(v.name), branch: textOf(v.branch) }))
}
