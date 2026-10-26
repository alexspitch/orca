import { create } from 'zustand'

// Builds started from Images in this window, followed until they finish. Kept outside the views so
// going back to the list and into the image again does not lose a build that is still going.

/** A run started from Images: one image, or several built together. */
export type TrackedImageBuild = { runId: string; images: string[]; startedAt: number }

type ImageBuildRuns = {
  runs: TrackedImageBuild[]
  track: (run: TrackedImageBuild) => void
  dismiss: (runId: string) => void
}

export const useImageBuildRuns = create<ImageBuildRuns>()((set) => ({
  runs: [],
  track: (run) =>
    set((state) => ({ runs: [run, ...state.runs.filter((r) => r.runId !== run.runId)] })),
  dismiss: (runId) => set((state) => ({ runs: state.runs.filter((r) => r.runId !== runId) }))
}))

/** Still going on the console: waiting, queued or building. */
export const isBuildGoing = (status: string): boolean =>
  /^(pending|queued|building|running|in_progress)$/i.test(status)

/** The version a branch builds: `3.1` for `dc-release-3.1`, `2.6` for chat-platform's `version-2.6`, master as itself. */
export const versionOfBranch = (branch: string): string =>
  /(?:-release-|^version-)(\d+(?:\.\d+)*)$/.exec(branch)?.[1] ?? branch
