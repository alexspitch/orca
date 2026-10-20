import type http from 'node:http'

// build-web's /api/automations/results for the Recaps page: reports finished in this month and the
// one before, so the calendar has days with a report and days without.

/** Reports on the 3rd and 10th of this month, and one in the month before, at local times. */
function recaps(): Record<string, unknown>[] {
  const now = new Date()
  const at = (monthDelta: number, day: number, hour: number) =>
    new Date(now.getFullYear(), now.getMonth() + monthDelta, day, hour).toISOString()
  const recap = (id: string, name: string, product: string, finishedAt: string) => ({
    id,
    automation_id: `auto-${name}`,
    name,
    product,
    version: { id: 'v1', name: '3.1', branch: 'release/3.1' },
    commit: 'abcdef1234',
    trigger: 'scheduled',
    started_by: null,
    finished_at: finishedAt
  })
  return [
    recap('r-night-3', 'Nightly review', 'dc', at(0, 3, 6)),
    recap('r-weekly-3', 'Weekly SA', 'sa', at(0, 3, 7)),
    recap('r-night-10', 'Nightly review', 'dc', at(0, 10, 6)),
    recap('r-old', 'Old report', 'dc', at(-1, 15, 6))
  ]
}

export function serveRecaps(
  res: http.ServerResponse,
  path: string,
  url: URL,
  json: (res: http.ServerResponse, status: number, body: unknown) => void
): boolean {
  if (path !== '/api/automations/results') {
    return false
  }
  const from = Date.parse(url.searchParams.get('from') ?? '') || -Infinity
  const to = Date.parse(url.searchParams.get('to') ?? '') || Infinity
  const results = recaps().filter((r) => {
    const at = Date.parse(r.finished_at)
    return at >= from && at < to
  })
  json(res, 200, {
    results,
    total: results.length,
    facets: { products: ['dc', 'sa'], versions: [], automations: [] }
  })
  return true
}
