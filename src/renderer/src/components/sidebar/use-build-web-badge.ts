import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { useBuildWebTarget } from '../build-web/use-build-web-data'
import { useImageBuildRuns } from '../build-web/images/image-build-runs'

const POLL_MS = 60_000
// Why a minute, not more: a token locked at launch unlocks as soon as Issues or Images opens.
const FAILED_POLL_MS = 60_000

export type BuildWebBadge = { count: number; capped: boolean }

/** A build-web number for a sidebar item, or null when unknown (not connected, no access). */
export function useBuildWebBadge(
  enabled: boolean,
  read: (target: RuntimeClientTarget) => Promise<BuildWebBadge>
): BuildWebBadge | null {
  const { target } = useBuildWebTarget()
  const [badge, setBadge] = useState<BuildWebBadge | null>(null)
  // Why: opening a build-web page (which unlocks the token) or starting a build reads at once.
  const onBuildWebPage = useAppStore(
    (s) => s.activeView === 'build-web' || s.activeView === 'build-web-images'
  )
  const started = useImageBuildRuns((s) => s.runs.length)
  useEffect(() => {
    if (!enabled) {
      setBadge(null)
      return
    }
    let alive = true
    let timer = 0
    const poll = async (): Promise<void> => {
      let delay = POLL_MS
      // Why: a hidden window has nobody to show the number to; skip the console round-trip.
      if (document.visibilityState !== 'hidden') {
        try {
          const next = await read(target)
          if (alive) {
            setBadge(next)
          }
        } catch {
          delay = FAILED_POLL_MS
          if (alive) {
            setBadge(null)
          }
        }
      }
      if (alive) {
        timer = window.setTimeout(() => void poll(), delay)
      }
    }
    void poll()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [enabled, onBuildWebPage, read, started, target])
  return badge
}
