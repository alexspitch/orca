import type { BuildWebMutationResult } from '../../shared/build-web-types'
import type {
  BuildWebBuildFreshness,
  BuildWebCombo,
  BuildWebFreshness,
  BuildWebFreshnessState,
  BuildWebLastBuilt,
  BuildWebPushAfter,
  BuildWebRun,
  BuildWebTestingStatus
} from '../../shared/build-web-run-types'
import { BUILD_WEB_LONG_TIMEOUT_MS } from '../../shared/build-web-timeouts'
import { requireBuildWebCredential } from './build-web-connection'
import { invalidateBuildWebImageCatalog } from './build-web-images'
import { buildWebMutation, buildWebRequest } from './build-web-request'
import { numberOf, recordOf, textOf, textOrNull, textsOf } from './build-web-response-fields'
import { runOf } from './build-web-runs'

// What the Build tab of a task does to its run, after build-web's Progress screen.

const enc = encodeURIComponent
const runPath = (runId: string, tail: string) => `/api/runs/${enc(runId)}${tail}`
const LAST_BUILT_STATES: readonly BuildWebLastBuilt['state'][] = [
  'up-to-date',
  'changed',
  'never-built',
  'no-image',
  'unknown'
]
const FRESHNESS_STATES: readonly BuildWebFreshnessState[] = ['current', 'stale', 'unknown']

const freshnessStateOf = (value: unknown): BuildWebFreshnessState =>
  FRESHNESS_STATES.find((s) => s === value) ?? 'unknown'

function records(value: unknown): Record<string, unknown>[] {
  return (Array.isArray(value) ? value : [])
    .map(recordOf)
    .filter((v): v is Record<string, unknown> => v !== null)
}

/** A write that answers with the run, which the tab shows as it now is. */
function runMutation(
  path: string,
  body?: unknown,
  timeoutMs?: number
): Promise<BuildWebMutationResult<BuildWebRun | null>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = await buildWebRequest({ ...credential, method: 'POST', path, body, timeoutMs })
    return runOf(answer, credential.baseUrl)
  })
}

/** Start (or restart) builds; `pushAfter` is what the console publishes once each one lands. */
export function buildBuildWebCombos(
  runId: string,
  combos: BuildWebCombo[],
  pushAfter: BuildWebPushAfter,
  skipTests: boolean
): Promise<BuildWebMutationResult<true>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    await buildWebRequest({
      ...credential,
      method: 'POST',
      path: runPath(runId, '/builds'),
      body: { combos, pushAfter, ...(skipTests ? { skipTests: true } : {}) }
    })
    // Why: the Images pages and badge count running builds from the catalog.
    invalidateBuildWebImageCatalog()
    return true as const
  })
}

export function cancelBuildWebBuild(
  runId: string,
  combo: BuildWebCombo
): Promise<BuildWebMutationResult<true>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    await buildWebRequest({
      ...credential,
      method: 'POST',
      path: runPath(runId, '/cancel'),
      body: combo
    })
    return true as const
  })
}

/** Add images to the run as pending; nothing builds until it is started. */
export function addBuildWebRunImages(runId: string, combos: BuildWebCombo[]) {
  return runMutation(runPath(runId, '/images'), { combos })
}

/** Drop images from the run's list; images already built on the server stay. */
export function removeBuildWebRunImages(runId: string, combos: BuildWebCombo[]) {
  return runMutation(runPath(runId, '/remove-images'), { combos })
}

/** Ask the build server which pending (or lost) images are already built, and record them. */
export function detectBuildWebBuilt(runId: string) {
  return runMutation(runPath(runId, '/detect-built'), undefined, BUILD_WEB_LONG_TIMEOUT_MS)
}

/** For the pending images: the last CI build of each, and whether anything changed since. */
export async function lastBuildWebBuilt(
  runId: string
): Promise<{ entries: BuildWebLastBuilt[]; probe_error: string | null }> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({
      ...credential,
      method: 'POST',
      path: runPath(runId, '/last-built'),
      timeoutMs: BUILD_WEB_LONG_TIMEOUT_MS
    })
  )
  const entries = records(answer?.entries).map((e) => ({
    image: textOf(e.image),
    dist: textOf(e.dist),
    branch: textOf(e.branch),
    state: LAST_BUILT_STATES.find((s) => s === e.state) ?? 'unknown',
    build_number: typeof e.build_number === 'number' ? e.build_number : null,
    built_at: textOrNull(e.built_at),
    ref: textOrNull(e.ref),
    published: typeof e.published === 'boolean' ? e.published : null,
    changed: textsOf(e.changed)
  }))
  return { entries, probe_error: textOrNull(answer?.probe_error) }
}

function buildFreshnessOf(value: Record<string, unknown>): BuildWebBuildFreshness {
  const unpublished = recordOf(recordOf(value.latest)?.newer_unpublished)
  return {
    key: textOf(value.key),
    state: freshnessStateOf(value.state),
    built_at: textOrNull(value.built_at),
    built_from:
      value.built_from === 'build-tag' || value.built_from === 'triggered'
        ? value.built_from
        : null,
    ref_at: textOrNull(value.ref_at),
    newer_unpublished: unpublished
      ? {
          build_number: numberOf(unpublished.build_number),
          at: textOrNull(unpublished.at),
          state: freshnessStateOf(unpublished.state)
        }
      : null
  }
}

/** Where each branch of the run ends, and which built images predate that commit. */
export async function buildWebRunFreshness(
  runId: string,
  fetchFirst: boolean
): Promise<BuildWebFreshness> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({
      ...credential,
      method: 'POST',
      path: runPath(runId, '/freshness'),
      body: { fetch: fetchFirst },
      timeoutMs: BUILD_WEB_LONG_TIMEOUT_MS
    })
  )
  return {
    refs: records(answer?.refs).map((r) => ({
      branch: textOf(r.branch),
      kind: textOf(r.kind),
      commit: textOf(r.commit),
      date: textOf(r.date),
      subject: textOf(r.subject)
    })),
    builds: records(answer?.builds).map(buildFreshnessOf),
    registry_error: textOrNull(answer?.registry_error),
    run: runOf(answer?.run, credential.baseUrl)
  }
}

/** Where the task is headed after its build — and with it what a train publishes. */
export function setBuildWebTestingStatus(
  runId: string,
  testingStatus: BuildWebTestingStatus
): Promise<BuildWebMutationResult<BuildWebRun | null>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'PUT',
        path: runPath(runId, '/testing-status'),
        body: { testingStatus }
      })
    )
    return runOf(answer?.run, credential.baseUrl)
  })
}
