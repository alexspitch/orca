import type { BuildWebPushProgress } from './build-web-image-types'
import type { BuildWebRunBuild } from './build-web-run-types'
import { withoutTwins } from './build-web-redos-twin'

// Builds and pushes started from Images, followed until the console reports their end: what the
// desktop's stores and the phone's screen both keep.

/** A run started from Images: one image, or several built together. */
export type TrackedImageBuild = { runId: string; images: string[]; startedAt: number }

/** Still going on the console: waiting, queued or building. */
export const isBuildGoing = (status: string): boolean =>
  /^(pending|queued|building|running|in_progress)$/i.test(status)

/** The version a branch builds: `3.1` for `dc-release-3.1`, `2.6` for chat-platform's `version-2.6`, master as itself. */
export const versionOfBranch = (branch: string): string =>
  /(?:-release-|^version-)(\d+(?:\.\d+)*)$/.exec(branch)?.[1] ?? branch

/** The run's builds of the tracked images; a redos twin comes with a publication, not with this build. */
export const trackedBuildsOf = (
  run: TrackedImageBuild,
  builds: readonly BuildWebRunBuild[]
): BuildWebRunBuild[] => withoutTwins(builds.filter((b) => run.images.includes(b.image)))

export const withTrackedBuild = (
  runs: readonly TrackedImageBuild[],
  run: TrackedImageBuild
): TrackedImageBuild[] => [run, ...runs.filter((r) => r.runId !== run.runId)]

export type TrackedImagePush = {
  runId: string
  /** `image|dist` of the builds asked for. */
  keys: string[]
  startedAt: number
}

export type ImagePushTracking = {
  pushes: TrackedImagePush[]
  progress: Record<string, BuildWebPushProgress>
}

export const pushKeyOf = (build: { image: string; dist: string }): string =>
  `${build.image}|${build.dist}`

export const isPushOver = (progress: BuildWebPushProgress | undefined): boolean =>
  progress !== undefined && progress.state !== 'pushing'

export function withTrackedPush(
  state: ImagePushTracking,
  push: TrackedImagePush
): ImagePushTracking {
  const current = state.pushes.find((p) => p.runId === push.runId)
  const going = current && !isPushOver(state.progress[push.runId])
  // A push queued onto one still going rides its stream: the asks add up.
  const next = going ? { ...current, keys: [...new Set([...current.keys, ...push.keys])] } : push
  const { [push.runId]: _old, ...progress } = state.progress
  return {
    pushes: [next, ...state.pushes.filter((p) => p.runId !== push.runId)],
    progress: going ? state.progress : progress
  }
}

export function withoutPush(state: ImagePushTracking, runId: string): ImagePushTracking {
  const { [runId]: _gone, ...progress } = state.progress
  return { pushes: state.pushes.filter((p) => p.runId !== runId), progress }
}

export const withPushProgress = (
  state: ImagePushTracking,
  list: readonly BuildWebPushProgress[]
): ImagePushTracking => ({
  ...state,
  progress: { ...state.progress, ...Object.fromEntries(list.map((p) => [p.runId, p])) }
})

/** What a tracked push says about one build: still going, failed, or nothing to add. */
export function pushStateOf(
  state: ImagePushTracking,
  build: { run_id: string; image: string; dist: string }
): 'pushing' | 'failed' | null {
  const key = pushKeyOf(build)
  const push = state.pushes.find((p) => p.runId === build.run_id && p.keys.includes(key))
  if (!push) {
    return null
  }
  const progress = state.progress[push.runId]
  if (progress?.failed.includes(key)) {
    return 'failed'
  }
  if (progress?.ok.includes(key)) {
    return null
  }
  return isPushOver(progress) ? null : 'pushing'
}

/** A row's place in a push still going: its own outcome once known, else pushing; null outside one. */
export function rowPushProgress(
  state: ImagePushTracking,
  key: string
): { going: boolean; progress: BuildWebPushProgress | undefined } {
  for (const push of state.pushes) {
    const progress = state.progress[push.runId]
    if (push.keys.includes(key) && !isPushOver(progress)) {
      return { going: true, progress }
    }
  }
  return { going: false, progress: undefined }
}

/** Pushes still going, and how many of their images have an outcome: what re-reads a table. */
export function pushesGoing(state: ImagePushTracking): { ids: string[]; finished: number } {
  const going = state.pushes.filter((p) => !isPushOver(state.progress[p.runId]))
  const finished = state.pushes.reduce(
    (n, p) =>
      n + (state.progress[p.runId]?.ok.length ?? 0) + (state.progress[p.runId]?.failed.length ?? 0),
    0
  )
  return { ids: going.map((p) => p.runId), finished }
}
