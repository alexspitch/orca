import { useCallback, useEffect, useRef, useState } from 'react'
import { installWindowVisibilityInterval } from '@/lib/window-visibility-interval'
import { fetchDevServicesStatus } from '@/lib/dev-services-client'
import { refreshDevServicesAvailability } from '@/store/dev-services-availability'
import type { DevServicesAvailability } from './use-dev-services-availability'
import type { DevServicesStatus } from '../../../../shared/dev-services-contract'

const DEV_SERVICES_POLL_INTERVAL_MS = 4_000

export type DevServicesNotice = {
  /** `unverifiable`: no answer, so the last known states are shown as last known, never as stopped. */
  kind: 'failed' | 'unverifiable' | 'unavailable'
  message: string
}

export type DevServicesStatusView = {
  status: DevServicesStatus | null
  notice: DevServicesNotice | null
  refreshing: boolean
  refresh: () => void
}

type ViewState = Omit<DevServicesStatusView, 'refresh'> & { key: string | null }

const EMPTY_VIEW: ViewState = { key: null, status: null, notice: null, refreshing: false }

/**
 * Polls the services command while the panel is visible: one request in flight, and a response for
 * a worktree or command the panel no longer shows is dropped.
 */
export function useDevServicesStatus(args: {
  availability: DevServicesAvailability | null
  commandHash: string | null
  active: boolean
}): DevServicesStatusView {
  const { availability, commandHash, active } = args
  const key = availability && commandHash ? `${availability.worktreeId}\u0000${commandHash}` : null
  const [view, setView] = useState<ViewState>(EMPTY_VIEW)
  const keyRef = useRef(key)
  const inFlightRef = useRef<AbortController | null>(null)
  // Why: a refresh asked for after an action must not be swallowed by a poll that began before it.
  const queuedRef = useRef(false)
  const pollRef = useRef<(queueIfBusy: boolean) => void>(() => {})
  keyRef.current = key

  const poll = useCallback(
    (queueIfBusy: boolean) => {
      if (!availability || !commandHash || !key) {
        return
      }
      if (inFlightRef.current) {
        queuedRef.current ||= queueIfBusy
        return
      }
      const controller = new AbortController()
      inFlightRef.current = controller
      const isCurrent = (): boolean => keyRef.current === key && !controller.signal.aborted
      setView((prev) => (prev.key === key ? { ...prev, refreshing: true } : { ...EMPTY_VIEW, key }))
      fetchDevServicesStatus(
        availability.target,
        availability.worktreeId,
        commandHash,
        controller.signal
      )
        .then((response) => {
          if (!isCurrent()) {
            return
          }
          if (response.kind === 'status') {
            const { status } = response
            setView({
              key,
              status,
              notice:
                !status.ok && status.error
                  ? { kind: 'failed', message: status.error.message }
                  : null,
              refreshing: false
            })
            return
          }
          if (response.kind === 'unavailable' && response.reason !== 'unsupported-workspace') {
            // Why: orca.yaml changed under us; the tab's own view of the command must catch up.
            void refreshDevServicesAvailability({
              hostId: availability.hostId,
              repoId: availability.repoId,
              target: availability.target
            })
          }
          setView((prev) => ({
            ...(prev.key === key ? prev : { ...EMPTY_VIEW, key }),
            notice: { kind: response.kind, message: response.message },
            refreshing: false
          }))
        })
        .catch((error: unknown) => {
          if (!isCurrent()) {
            return
          }
          const message = error instanceof Error ? error.message : String(error)
          setView((prev) => ({
            ...(prev.key === key ? prev : { ...EMPTY_VIEW, key }),
            notice: { kind: 'unverifiable', message: message || 'The host did not answer.' },
            refreshing: false
          }))
        })
        .finally(() => {
          if (inFlightRef.current === controller) {
            inFlightRef.current = null
          }
          if (queuedRef.current && !controller.signal.aborted) {
            queuedRef.current = false
            pollRef.current(false)
          }
        })
    },
    [availability, commandHash, key]
  )
  pollRef.current = poll

  const refresh = useCallback(() => poll(true), [poll])

  useEffect(() => {
    if (!active || !key) {
      return
    }
    poll(false)
    const stop = installWindowVisibilityInterval({
      run: () => poll(false),
      intervalMs: DEV_SERVICES_POLL_INTERVAL_MS
    })
    return () => {
      stop()
      queuedRef.current = false
      inFlightRef.current?.abort()
      inFlightRef.current = null
    }
  }, [active, key, poll])

  const current = view.key === key ? view : EMPTY_VIEW
  return {
    status: current.status,
    notice: current.notice,
    refreshing: current.refreshing,
    refresh
  }
}
