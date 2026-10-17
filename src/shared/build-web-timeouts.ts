// How long the host waits on the console; a paired client waits that long plus a margin.

export const BUILD_WEB_REQUEST_TIMEOUT_MS = 20_000
/** `git fetch` on the console before listing a task's commits. */
export const BUILD_WEB_COMMITS_FETCH_TIMEOUT_MS = 90_000
/** The whole build catalog behind the Images pages and badge. */
export const BUILD_WEB_CATALOG_TIMEOUT_MS = 45_000
/** Room for the RPC round trip on top of the host's own wait. */
export const BUILD_WEB_CLIENT_MARGIN_MS = 10_000

/** The host's own wait for one `buildWeb.*` call, so a client never cuts a healthy answer off. */
export function buildWebHostWaitMs(method: string, args: unknown): number {
  if (method === 'issueCommits') {
    const fetchFirst = typeof args === 'object' && args !== null && 'fetch' in args && args.fetch
    return fetchFirst === true ? BUILD_WEB_COMMITS_FETCH_TIMEOUT_MS : BUILD_WEB_REQUEST_TIMEOUT_MS
  }
  return method === 'imageSummary' || method === 'listImages' || method === 'listImageBuilds'
    ? BUILD_WEB_CATALOG_TIMEOUT_MS
    : BUILD_WEB_REQUEST_TIMEOUT_MS
}
