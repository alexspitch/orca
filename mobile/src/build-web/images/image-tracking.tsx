import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  withoutPush,
  isPushFollowed,
  progressNews,
  withTrackedBuild,
  withTrackedPush,
  withPushProgress,
  type ImagePushTracking,
  type TrackedImageBuild,
  type TrackedImagePush
} from '../../../../src/shared/build-web-image-tracking'
import type { BuildWebScreen } from '../build-web-screen-context'

// The builds and pushes started from Images while this screen is open: kept above the views, as the
// desktop's stores are, so leaving an image's history or the section does not lose one going.

const POLL_MS = 1500

export type ImageTracking = {
  builds: readonly TrackedImageBuild[]
  pushes: ImagePushTracking
  /** Moves each time a push ends: the tables read the registry again. */
  pushSettles: number
  trackBuild: (run: TrackedImageBuild) => void
  dismissBuild: (runId: string) => void
  trackPush: (push: TrackedImagePush) => void
  dismissPush: (runId: string) => void
}

export const ImageTrackingContext = createContext<ImageTracking | null>(null)

export function useImageTracking(): ImageTracking {
  const tracking = useContext(ImageTrackingContext)
  if (!tracking) {
    throw new Error('useImageTracking outside the build-web screen')
  }
  return tracking
}

/** The tracking itself, with the one poll that follows every push still going. */
export function useImageTrackingState(
  call: BuildWebScreen['call'] | null,
  notify: BuildWebScreen['notify']
): ImageTracking {
  const [builds, setBuilds] = useState<readonly TrackedImageBuild[]>([])
  const [pushes, setPushes] = useState<ImagePushTracking>({ pushes: [], progress: {} })
  const [pushSettles, setPushSettles] = useState(0)
  const goingIds = pushes.pushes
    .filter((p) => isPushFollowed(pushes.progress[p.runId]))
    .map((p) => p.runId)
    .join(',')
  const notifyRef = useRef(notify)
  notifyRef.current = notify
  const progressRef = useRef(pushes.progress)
  progressRef.current = pushes.progress

  useEffect(() => {
    if (!goingIds || !call) {
      return
    }
    let alive = true
    const read = async (): Promise<void> => {
      try {
        const list = await call('pushProgress', { runIds: goingIds.split(',') })
        if (!alive) {
          return
        }
        const { pushEnded, twinsEnded } = progressNews(progressRef.current, list)
        // Why at once: a second read before the next render must not say the same news again.
        progressRef.current = withPushProgress(
          { pushes: [], progress: progressRef.current },
          list
        ).progress
        setPushes((state) => withPushProgress(state, list))
        if (pushEnded.length === 0 && twinsEnded.length === 0) {
          return
        }
        setPushSettles((n) => n + 1)
        for (const p of pushEnded) {
          if (p.failed.length) {
            notifyRef.current(`${p.failed.length} image(s) were not pushed`, 'error')
          } else if (p.ok.length) {
            notifyRef.current(`${p.ok.length} image(s) pushed`, 'success')
          }
        }
        for (const p of twinsEnded) {
          if (p.redos?.failed.length) {
            notifyRef.current(`redos of ${p.redos.failed.join(', ')} not made`, 'error')
          }
        }
      } catch {
        // A blip: the next beat asks again.
      }
    }
    void read()
    const timer = setInterval(() => void read(), POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [call, goingIds])

  const trackBuild = useCallback(
    (run: TrackedImageBuild) => setBuilds((runs) => withTrackedBuild(runs, run)),
    []
  )
  const dismissBuild = useCallback(
    (runId: string) => setBuilds((runs) => runs.filter((r) => r.runId !== runId)),
    []
  )
  const trackPush = useCallback(
    (push: TrackedImagePush) => setPushes((state) => withTrackedPush(state, push)),
    []
  )
  const dismissPush = useCallback(
    (runId: string) => setPushes((state) => withoutPush(state, runId)),
    []
  )
  return { builds, pushes, pushSettles, trackBuild, dismissBuild, trackPush, dismissPush }
}
