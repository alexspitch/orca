import { create } from 'zustand'
import type { BuildWebPushProgress } from '../../../../../shared/build-web-image-types'
import {
  withoutPush,
  withTrackedPush,
  withPushProgress,
  type ImagePushTracking,
  type TrackedImagePush
} from '../../../../../shared/build-web-image-tracking'

// Pushes started from Images in this window, followed until the console reports their end. Kept
// outside the views, like the tracked builds, so leaving an image's history does not lose one.

export {
  isPushOver,
  pushKeyOf,
  pushStateOf,
  type TrackedImagePush
} from '../../../../../shared/build-web-image-tracking'

type ImagePushes = ImagePushTracking & {
  track: (push: TrackedImagePush) => void
  dismiss: (runId: string) => void
  setProgress: (list: BuildWebPushProgress[]) => void
}

export const useImagePushes = create<ImagePushes>()((set) => ({
  pushes: [],
  progress: {},
  track: (push) => set((state) => withTrackedPush(state, push)),
  dismiss: (runId) => set((state) => withoutPush(state, runId)),
  setProgress: (list) => set((state) => ({ progress: withPushProgress(state, list).progress }))
}))
