import { useEffect, useState } from 'react'
import type { BuildWebStandLogTail } from '../../../../../shared/build-web-stand-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { cleanLogPiece } from '../images/use-build-log'
import { EMPTY_LOG_LINES, appendLogText, type LogLines } from '../log-viewer/log-lines'

const BUSY_POLL_MS = 150
const IDLE_POLL_MS = 700
// Why: a followed log keeps more than the tail it opened with, but never without end.
const FOLLOW_MIN_LINES = 10_000

export type StandLogRequest = {
  standId: string
  service: string
  tail: BuildWebStandLogTail
  follow: boolean
}

export type StandLogState = {
  log: LogLines
  done: boolean
  /** Earlier lines were dropped, here or on the host. */
  trimmed: boolean
  error: string | null
  /** The console has no log route yet. */
  routeMissing: boolean
}

const EMPTY: StandLogState = {
  log: EMPTY_LOG_LINES,
  done: false,
  trimmed: false,
  error: null,
  routeMissing: false
}

/** A service's log, read from the host's buffer until it ends; a new request starts afresh. */
export function useStandLog(
  target: RuntimeClientTarget,
  request: StandLogRequest | null,
  attempt: number
): StandLogState {
  const [state, setState] = useState<StandLogState>(EMPTY)
  const standId = request?.standId
  const service = request?.service
  const tail = request?.tail
  const follow = request?.follow
  useEffect(() => {
    setState(EMPTY)
    if (!standId || !service || !tail) {
      return
    }
    const maxLines = follow ? Math.max(tail, FOLLOW_MIN_LINES) : tail
    let alive = true
    let timer = 0
    let streamId: string | null = null
    let offset = 0
    let carry = ''
    const fail = (error: string, routeMissing = false): void => {
      if (alive) {
        setState((current) => ({ ...current, done: true, error, routeMissing }))
      }
    }
    const read = async (): Promise<void> => {
      if (!streamId) {
        return
      }
      try {
        const piece = await callBuildWeb(target, 'standLogs', { streamId, offset })
        if (!alive) {
          return
        }
        offset = piece.next
        const next = cleanLogPiece(carry, piece.text, piece.done)
        carry = next.carry
        setState((current) => {
          const log = appendLogText(current.log, next.text, maxLines, piece.done)
          return {
            log,
            done: piece.done,
            trimmed: current.trimmed || piece.trimmed || log.first > 0,
            error: piece.error,
            routeMissing: false
          }
        })
        if (!piece.done) {
          timer = window.setTimeout(() => void read(), piece.text ? BUSY_POLL_MS : IDLE_POLL_MS)
        }
      } catch (failure) {
        fail(failure instanceof Error ? failure.message : String(failure))
      }
    }
    void (async () => {
      try {
        const started = await callBuildWeb(target, 'startStandLogs', {
          standId,
          service,
          tail,
          follow: follow === true
        })
        if (!started.ok) {
          fail(started.error, started.routeMissing === true)
          return
        }
        streamId = started.value.streamId
        if (!alive) {
          void callBuildWeb(target, 'stopStandLogs', { streamId }).catch(() => {})
          return
        }
        await read()
      } catch (failure) {
        fail(failure instanceof Error ? failure.message : String(failure))
      }
    })()
    return () => {
      alive = false
      window.clearTimeout(timer)
      if (streamId) {
        void callBuildWeb(target, 'stopStandLogs', { streamId }).catch(() => {})
      }
    }
  }, [attempt, follow, service, standId, tail, target])
  return state
}
