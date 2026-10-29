import { useCallback, useEffect, useRef, useState } from 'react'
import type { BuildWebRun } from '../../../../../../src/shared/build-web-run-types'
import {
  cellsOf,
  hasLiveTwin,
  mergeCells,
  type Cell
} from '../../../../../../src/renderer/src/components/build-web/issue/build/run-cells'
import { useCardTabActive } from '../../../build-web-card-tabs'
import { useBuildWebScreen } from '../../../build-web-screen-context'
import { useBuildTabCall } from './build-tab-call'
import { withoutTwins } from '../../../../../../src/shared/build-web-redos-twin'

const POLL_MS = 5000
const ENDED = new Set(['success', 'failed', 'partial'])

/**
 * The run's rows as they move: the stored run is read again every few seconds while it builds,
 * and for a while after a build or a push is started, before the console writes it down.
 */
export function useRunProgress(
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
  const { notify } = useBuildWebScreen()
  const { call } = useBuildTabCall()
  const [cells, setCells] = useState(() => cellsOf(run.builds))
  const [status, setStatus] = useState(run.status)
  const [now, setNow] = useState(() => Date.now())
  const [watchUntil, setWatchUntil] = useState(0)
  const statusRef = useRef(run.status)
  const onStatusRef = useRef(onStatus)
  onStatusRef.current = onStatus
  const notifyRef = useRef(notify)
  notifyRef.current = notify

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
      // Why without twins: the console's run status leaves them out too.
      const own = withoutTwins(fresh.builds)
      const ok = own.filter((b) => b.status === 'SUCCESS').length
      notifyRef.current(
        `Build ${fresh.status} — ${fresh.ticket ?? fresh.branch}: ${ok} / ${own.length} image builds succeeded`,
        fresh.status === 'success' ? 'success' : fresh.status === 'failed' ? 'error' : 'info'
      )
    }
  }, [])

  const active = useCardTabActive()
  const watching = watchUntil > now
  // Why the twins too: the console leaves them out of the run's status while they go.
  const twinGoing = hasLiveTwin(Object.values(cells))
  const polling = active && (status === 'building' || watching || twinGoing)
  const pollingRef = useRef(polling)
  pollingRef.current = polling
  useEffect(() => {
    if (!polling) {
      return
    }
    let alive = true
    const pull = async (): Promise<void> => {
      try {
        const fresh = await call('getRun', { runId: run.id })
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
    const timer = setInterval(() => void pull(), POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [apply, call, polling, run.id])

  const watch = useCallback((ms: number) => {
    const at = Date.now()
    setNow(at)
    setWatchUntil((until) => Math.max(until, at + ms))
  }, [])

  const runStatus = run.status
  // The card's own reading says the run moved elsewhere (a build started or ended): read it here
  // too. Why not lay that reading over the rows: it may predate a row this view just removed.
  useEffect(() => {
    if (active && !pollingRef.current && runStatus !== statusRef.current) {
      watch(POLL_MS)
    }
  }, [active, runStatus, watch])

  return { cells, setCells, status, now, apply, watch, watching }
}
