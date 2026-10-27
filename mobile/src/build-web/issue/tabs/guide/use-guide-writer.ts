import { useCallback, useEffect, useRef, useState } from 'react'
import type { BuildWebRun } from '../../../../../../src/shared/build-web-run-types'
import { useBuildWebScreen } from '../../../build-web-screen-context'
import { messageOf } from './guide-failure'

const BUSY_POLL_MS = 150
const IDLE_POLL_MS = 700
const RETRY_MS = 3000
// About a minute of dropped reads before the guide is given up as stopped.
const STREAM_RETRIES = 20

/**
 * The guide being written by the model, read piece by piece. The console saves the finished text
 * on the run; the run is read again at the end so the card agrees with it.
 */
export function useGuideWriter(args: {
  runId: string
  setGuide: React.Dispatch<React.SetStateAction<string>>
  onRun: (run: BuildWebRun) => void
  onError: (message: string | null) => void
}): { streaming: boolean; write: (feedback?: string, current?: string) => Promise<void> } {
  const { runId, setGuide, onRun, onError } = args
  const { call } = useBuildWebScreen()
  const [streaming, setStreaming] = useState(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const write = useCallback(
    async (feedback?: string, current?: string) => {
      onError(null)
      setStreaming(true)
      try {
        const started = await call('startGuide', {
          runId,
          ...(feedback ? { feedback, currentGuide: current ?? '' } : {})
        })
        if (!started.ok) {
          onError(started.error)
          return
        }
        setGuide('')
        let offset = 0
        let misses = 0
        while (alive.current) {
          // Why retried: the stream is read by offset, so a dropped read resumes where it stopped.
          const piece = await call('guideStream', {
            streamId: started.value.streamId,
            offset
          }).catch((failure: unknown) => {
            misses += 1
            if (misses > STREAM_RETRIES) {
              throw failure
            }
            return null
          })
          if (!piece) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_MS))
            continue
          }
          misses = 0
          offset = piece.next
          if (piece.text) {
            setGuide((text) => text + piece.text)
          }
          if (piece.done) {
            if (piece.error) {
              onError(piece.error)
            }
            break
          }
          await new Promise((resolve) =>
            setTimeout(resolve, piece.text ? BUSY_POLL_MS : IDLE_POLL_MS)
          )
        }
        const fresh = await call('getRun', { runId })
        if (fresh && alive.current) {
          onRun(fresh)
        }
      } catch (failure) {
        onError(messageOf(failure))
      } finally {
        if (alive.current) {
          setStreaming(false)
        }
      }
    },
    [call, onError, onRun, runId, setGuide]
  )

  return { streaming, write }
}
