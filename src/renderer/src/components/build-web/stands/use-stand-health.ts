import { useCallback, useEffect, useRef, useState } from 'react'
import type { BuildWebStandHealthMap } from '../../../../../shared/build-web-stand-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { useBuildWebBadgeKick } from '../../sidebar/use-build-web-badge'
import { useStandGroups } from './stand-groups-store'
import { readStandHealth } from './stand-health'

const POLL_MS = 60_000

export type StandHealthState = {
  health: BuildWebStandHealthMap | null
  loading: boolean
}

/** The stands table's monitoring column: read on open, each minute, and on demand. */
export function useStandHealth(
  target: RuntimeClientTarget,
  /** A change reads past the host's cache: the page's «read again». */
  refreshes: number
): StandHealthState {
  const [health, setHealth] = useState<BuildWebStandHealthMap | null>(null)
  const [loading, setLoading] = useState(false)
  const latest = useRef(0)
  const kickBadge = useBuildWebBadgeKick()
  const hidden = useStandGroups((s) => s.hiddenKeys)
  const load = useCallback(
    async (refresh: boolean) => {
      const mine = ++latest.current
      setLoading(true)
      try {
        const next = await readStandHealth(target, { refresh, hidden })
        if (mine === latest.current) {
          setHealth(next)
          if (refresh) {
            kickBadge()
          }
        }
      } catch {
        // Why kept: a failed re-read leaves the last answer up; the stands' own reads say why.
      } finally {
        if (mine === latest.current) {
          setLoading(false)
        }
      }
    },
    [hidden, kickBadge, target]
  )
  useEffect(() => {
    void load(false)
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        void load(false)
      }
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [load])
  const seenRefreshes = useRef(refreshes)
  useEffect(() => {
    if (refreshes !== seenRefreshes.current) {
      seenRefreshes.current = refreshes
      void load(true)
    }
  }, [load, refreshes])
  return { health, loading }
}
