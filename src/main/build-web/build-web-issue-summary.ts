import {
  BUILD_WEB_OPEN_STATUSES,
  type BuildWebIssueSummary,
  type BuildWebIssueSummaryQuery
} from '../../shared/build-web-types'
import { requireBuildWebCredential } from './build-web-connection'
import { listBuildWebIssues } from './build-web-issue-read'

// The Issues badge: how many open tasks the Issues list's filters and search leave sit at the top
// priority — the console's own reading of Jira's Highest, Blocker and Critical
// (ticketImport.priorityOfJira). The console cannot filter by priority, so one page sorted by it
// carries them first. A closed task (done, won't fix) blocks nothing, whatever the list shows.

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
    // Why: no status, or an empty list («any status» on the page), is every open status.
    status: filters.status?.length
      ? BUILD_WEB_OPEN_STATUSES.filter((s) => filters.status?.includes(s))
      : [...BUILD_WEB_OPEN_STATUSES],
    product: filters.product,
    assignee: filters.assignee,
    q: filters.q?.trim() || undefined
  }
  if (query.status.length === 0) {
    return { blockers: 0, capped: false }
  }
  const key = `${credential.baseUrl}#${credential.generation}#${JSON.stringify(query)}`
  if (cached?.key === key && Date.now() - cached.at < TTL_MS) {
    return cached.summary
  }
  const page = await listBuildWebIssues({
    view: 'all',
    ...query,
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
