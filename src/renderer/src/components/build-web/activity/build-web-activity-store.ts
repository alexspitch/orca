import { create } from 'zustand'
import type { BuildWebActivity } from '../../../../../shared/build-web-activity-types'

// build-web's bell and task list as last read, for the titlebar; one poller fills it for the
// titlebar and the desktop notifications alike (BuildWebActivityGate).

type BuildWebActivityState = {
  /** Null until read, and whenever build-web cannot be read (not connected, locked, no rights). */
  activity: BuildWebActivity | null
  /** The task list is open: somebody watches a status change, so it is read faster. */
  watching: boolean
}

export const useBuildWebActivity = create<BuildWebActivityState>()(() => ({
  activity: null,
  watching: false
}))
