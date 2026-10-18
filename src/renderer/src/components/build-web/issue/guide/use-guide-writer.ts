import { useCallback, useEffect, useRef, useState } from 'react'
import type { BuildWebRun } from '../../../../../../shared/build-web-run-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../../build-web-client'

const BUSY_POLL_MS = 150
const IDLE_POLL_MS = 700

const messageOf = (failure: unknown) =>
  failure instanceof Error ? failure.message : String(failure)

/**
 * The guide being written by the model, read piece by piece as main receives it. The console saves
 * the finished text on the run; the run is read again at the end so the card agrees with it.
 */
export function useGuideWriter(args: {
  target: RuntimeClientTarget
  runId: string
  setGuide: React.Dispatch<React.SetStateAction<string>>
  onRun: (run: BuildWebRun) => void
  onError: (message: string | null) => void
}): { streaming: boolean; write: (feedback?: string, current?: string) => Promise<void> } {
  const { target, runId, setGuide, onRun, onError } = args
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
        const started = await callBuildWeb(target, 'startGuide', {
          runId,
          ...(feedback ? { feedback, currentGuide: current ?? '' } : {})
        })
        if (!started.ok) {
          onError(started.error)
          return
        }
        setGuide('')
        let offset = 0
        while (alive.current) {
          const piece = await callBuildWeb(target, 'guideStream', {
            streamId: started.value.streamId,
            offset
          })
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
            window.setTimeout(resolve, piece.text ? BUSY_POLL_MS : IDLE_POLL_MS)
          )
        }
        const fresh = await callBuildWeb(target, 'getRun', { runId })
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
    [onError, onRun, runId, setGuide, target]
  )

  return { streaming, write }
}
