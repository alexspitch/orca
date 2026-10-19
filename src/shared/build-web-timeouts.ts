// How long the host waits on the console; a paired client waits that long plus a margin.

export const BUILD_WEB_REQUEST_TIMEOUT_MS = 20_000
/** `git fetch` on the console before listing a task's commits. */
export const BUILD_WEB_COMMITS_FETCH_TIMEOUT_MS = 90_000
/** The whole build catalog behind the Images pages and badge. */
export const BUILD_WEB_CATALOG_TIMEOUT_MS = 45_000
/** A test run's detail: a nightly run's delta joins its ~33k cases with the run before. */
export const BUILD_WEB_TEST_RUN_TIMEOUT_MS = 45_000
/** Console work that reads git or the build server: detect, adopt, freshness, a fetch, a stand. */
export const BUILD_WEB_LONG_TIMEOUT_MS = 120_000
/** A guide written by the model: the console streams it for minutes. */
export const BUILD_WEB_GUIDE_TIMEOUT_MS = 15 * 60_000
/** Room for the RPC round trip on top of the host's own wait. */
export const BUILD_WEB_CLIENT_MARGIN_MS = 10_000

/** Calls that wait on git, the build server or a stand over SSH. */
export const BUILD_WEB_LONG_METHODS: ReadonlySet<string> = new Set([
  'detectBuilt',
  'lastBuilt',
  'runFreshness',
  'adoptBuilt',
  'detectImages',
  'fetchRepo',
  'standVersion',
  'refreshIssueVersion',
  // A stand's compose and containers, read over SSH before the answer or the log's first byte.
  'standStatus',
  'startStandLogs',
  // A watcher pass asks Jira about every watched ticket.
  'watchCheck'
])

/** The host's own wait for one `buildWeb.*` call, so a client never cuts a healthy answer off. */
export function buildWebHostWaitMs(method: string, args: unknown): number {
  if (BUILD_WEB_LONG_METHODS.has(method)) {
    return BUILD_WEB_LONG_TIMEOUT_MS
  }
  if (method === 'issueCommits') {
    const fetchFirst = typeof args === 'object' && args !== null && 'fetch' in args && args.fetch
    return fetchFirst === true ? BUILD_WEB_COMMITS_FETCH_TIMEOUT_MS : BUILD_WEB_REQUEST_TIMEOUT_MS
  }
  if (method === 'testRun') {
    return BUILD_WEB_TEST_RUN_TIMEOUT_MS
  }
  return method === 'imageSummary' || method === 'listImages' || method === 'listImageBuilds'
    ? BUILD_WEB_CATALOG_TIMEOUT_MS
    : BUILD_WEB_REQUEST_TIMEOUT_MS
}
