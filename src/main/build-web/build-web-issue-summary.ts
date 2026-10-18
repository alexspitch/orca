import {
  BUILD_WEB_OPEN_STATUSES,
  type BuildWebIssueSummary,
  type BuildWebIssueSummaryQuery
} from '../../shared/build-web-types'
import { requireBuildWebCredential } from './build-web-connection'
import { listBuildWebIssues } from './build-web-issue-read'

// The Issues badge: how many tasks the Issues list's filters leave sit at the top priority — the
// console's own reading of Jira's Highest, Blocker and Critical (ticketImport.priorityOfJira). The
// console cannot filter by priority, so one page sorted by it carries them first.

const TTL_MS = 60_000
const PAGE = 100

let cached: { key: string; at: number; summary: BuildWebIssueSummary } | null = null

export async function buildWebIssueSummary(
  filters: BuildWebIssueSummaryQuery = {}
): Promise<BuildWebIssueSummary> {
  // Why background: a sidebar poll must not be what asks the keychain for the token.
  const credential = requireBuildWebCredential({ background: true })
  const query = {
    mine: filters.mine === true,
    ai: filters.ai === true,
    favorite: filters.favorite === true,
    jira: filters.jira === true,
    // Why: an empty list is «any status» on the page, as it is to the console.
    status: filters.status ?? [...BUILD_WEB_OPEN_STATUSES],
    product: filters.product
  }
  const key = `${credential.baseUrl}#${credential.generation}#${JSON.stringify(query)}`
  if (cached?.key === key && Date.now() - cached.at < TTL_MS) {
    return cached.summary
  }
  const page = await listBuildWebIssues({
    view: 'all',
    ...query,
    status: query.status.length ? query.status : undefined,
    sort: 'priority',
    dir: 'desc',
    limit: PAGE
  })
  const blockers = page.issues.filter((issue) => issue.priority >= 5).length
  const summary = { blockers, capped: blockers === PAGE }
  cached = { key, at: Date.now(), summary }
  return summary
}

/** @internal - tests start from an empty cache. */
export function _resetBuildWebIssueSummary(): void {
  cached = null
}
