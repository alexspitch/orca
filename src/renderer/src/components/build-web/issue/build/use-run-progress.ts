import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { BuildWebRun } from '../../../../../../shared/build-web-run-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../../build-web-client'
import { cellsOf, mergeCells, type Cell } from './run-cells'

const POLL_MS = 5000
const ENDED = new Set(['success', 'failed', 'partial'])

/**
 * The run's rows as they move. build-web follows a build over its event stream; Orca re-reads the
 * stored run every few seconds while it builds, and for a while after a build or a push is
 * started, before the console has written the run down as building.
 */
export function useRunProgress(
  target: RuntimeClientTarget,
  run: BuildWebRun,
  onStatus: (status: string) => void
): {
  cells: Record<string, Cell>
  setCells: React.Dispatch<React.SetStateAction<Record<string, Cell>>>
  status: string
  /** The clock a live row's age is measured against; moves on each poll. */
  now: number
  apply: (fresh: BuildWebRun, merge?: boolean) => void
  /** Poll for at least `ms` from now — after a build or a push was started. */
  watch: (ms: number) => void
  watching: boolean
} {
  const [cells, setCells] = useState(() => cellsOf(run.builds))
  const [status, setStatus] = useState(run.status)
  const [now, setNow] = useState(() => Date.now())
  const [watchUntil, setWatchUntil] = useState(0)
  const statusRef = useRef(run.status)
  const onStatusRef = useRef(onStatus)
  onStatusRef.current = onStatus

  const apply = useCallback((fresh: BuildWebRun, merge = true) => {
    setCells((shown) => (merge ? mergeCells(shown, cellsOf(fresh.builds)) : cellsOf(fresh.builds)))
    const before = statusRef.current
    if (fresh.status === before) {
      return
    }
    statusRef.current = fresh.status
    setStatus(fresh.status)
    onStatusRef.current(fresh.status)
    if (before === 'building' && ENDED.has(fresh.status)) {
      const ok = fresh.builds.filter((b) => b.status === 'SUCCESS').length
      toast.message(
        translate('buildWeb.run.ended', 'Build {{status}} — {{key}}', {
          status: fresh.status,
          key: fresh.ticket ?? fresh.branch
        }),
        {
          description: translate(
            'buildWeb.run.endedTally',
            '{{ok}} / {{total}} image builds succeeded',
            {
              ok,
              total: fresh.builds.length
            }
          )
        }
      )
    }
  }, [])

  const watching = watchUntil > now
  const polling = status === 'building' || watching
  useEffect(() => {
    if (!polling) {
      return
    }
    let alive = true
    const pull = async (): Promise<void> => {
      try {
        const fresh = await callBuildWeb(target, 'getRun', { runId: run.id })
        if (alive && fresh) {
          apply(fresh)
        }
      } catch {
        // A blip: the next beat reads it again.
      }
      if (alive) {
        setNow(Date.now())
      }
    }
    void pull()
    const timer = window.setInterval(() => void pull(), POLL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [apply, polling, run.id, target])

  const watch = useCallback((ms: number) => {
    const at = Date.now()
    setNow(at)
    setWatchUntil((until) => Math.max(until, at + ms))
  }, [])

  return { cells, setCells, status, now, apply, watch, watching }
}
