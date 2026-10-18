import { create } from 'zustand'
import type { BuildWebPushProgress } from '../../../../../shared/build-web-image-types'

// Pushes started from Images in this window, followed until the console reports their end. Kept
// outside the views, like the tracked builds, so leaving an image's history does not lose one.

export type TrackedImagePush = {
  runId: string
  /** `image|dist` of the builds asked for. */
  keys: string[]
  startedAt: number
}

type ImagePushes = {
  pushes: TrackedImagePush[]
  progress: Record<string, BuildWebPushProgress>
  track: (push: TrackedImagePush) => void
  dismiss: (runId: string) => void
  setProgress: (list: BuildWebPushProgress[]) => void
}

export const pushKeyOf = (build: { image: string; dist: string }): string =>
  `${build.image}|${build.dist}`

export const isPushOver = (progress: BuildWebPushProgress | undefined): boolean =>
  progress !== undefined && progress.state !== 'pushing'

export const useImagePushes = create<ImagePushes>()((set) => ({
  pushes: [],
  progress: {},
  track: (push) =>
    set((state) => {
      const current = state.pushes.find((p) => p.runId === push.runId)
      const going = current && !isPushOver(state.progress[push.runId])
      // A push queued onto one still going rides its stream: the asks add up.
      const next = going
        ? { ...current, keys: [...new Set([...current.keys, ...push.keys])] }
        : push
      const { [push.runId]: _old, ...progress } = state.progress
      return {
        pushes: [next, ...state.pushes.filter((p) => p.runId !== push.runId)],
        progress: going ? state.progress : progress
      }
    }),
  dismiss: (runId) =>
    set((state) => {
      const { [runId]: _gone, ...progress } = state.progress
      return { pushes: state.pushes.filter((p) => p.runId !== runId), progress }
    }),
  setProgress: (list) =>
    set((state) => ({
      progress: { ...state.progress, ...Object.fromEntries(list.map((p) => [p.runId, p])) }
    }))
}))

/** What a tracked push says about one build: still going, failed, or nothing to add. */
export function pushStateOf(
  state: Pick<ImagePushes, 'pushes' | 'progress'>,
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
