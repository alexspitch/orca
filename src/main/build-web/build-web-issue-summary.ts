import { BUILD_WEB_OPEN_STATUSES, type BuildWebIssueSummary } from '../../shared/build-web-types'
import { requireBuildWebCredential } from './build-web-connection'
import { listBuildWebIssues } from './build-web-issue-read'

// The Issues badge: how many open tasks sit at the top priority — the console's own reading of
// Jira's Highest, Blocker and Critical (ticketImport.priorityOfJira). The console cannot filter by
// priority, so one page sorted by it carries them first.

const TTL_MS = 60_000
const PAGE = 100

let cached: { key: string; at: number; summary: BuildWebIssueSummary } | null = null

export async function buildWebIssueSummary(): Promise<BuildWebIssueSummary> {
  // Why background: a sidebar poll must not be what asks the keychain for the token.
  const credential = requireBuildWebCredential({ background: true })
  const key = `${credential.baseUrl}#${credential.generation}`
  if (cached?.key === key && Date.now() - cached.at < TTL_MS) {
    return cached.summary
  }
  const page = await listBuildWebIssues({
    view: 'all',
    status: [...BUILD_WEB_OPEN_STATUSES],
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
