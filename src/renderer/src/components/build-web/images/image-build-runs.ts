import { create } from 'zustand'
import {
  withTrackedBuild,
  type TrackedImageBuild
} from '../../../../../shared/build-web-image-tracking'

// Builds started from Images in this window, followed until they finish. Kept outside the views so
// going back to the list and into the image again does not lose a build that is still going.

export {
  isBuildGoing,
  trackedBuildsOf,
  versionOfBranch,
  type TrackedImageBuild
} from '../../../../../shared/build-web-image-tracking'

type ImageBuildRuns = {
  runs: TrackedImageBuild[]
  track: (run: TrackedImageBuild) => void
  dismiss: (runId: string) => void
}

export const useImageBuildRuns = create<ImageBuildRuns>()((set) => ({
  runs: [],
  track: (run) => set((state) => ({ runs: withTrackedBuild(state.runs, run) })),
  dismiss: (runId) => set((state) => ({ runs: state.runs.filter((r) => r.runId !== runId) }))
}))
