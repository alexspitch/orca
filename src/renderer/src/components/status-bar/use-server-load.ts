import { useEffect, useRef, useState } from 'react'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { readServerLoad, type ServerLoadResult } from './server-load'

const SERVER_LOAD_POLL_MS = 10_000
const SERVER_LOAD_TIMEOUT_MS = 5_000
const EMPTY_RESULTS: Readonly<Record<string, ServerLoadResult>> = {}

function callServer(environmentId: string, method: string): Promise<unknown> {
  return callRuntimeRpc<unknown>({ kind: 'environment', environmentId }, method, undefined, {
    timeoutMs: SERVER_LOAD_TIMEOUT_MS,
    reuseRecentCompatibilityFailure: true
  })
}

/** Polls each connected server's CPU and memory while the window is visible. */
export function useServerLoad(
  environmentIds: readonly string[],
  pollMs = SERVER_LOAD_POLL_MS
): Readonly<Record<string, ServerLoadResult>> {
  const key = environmentIds.join('\n')
  // Why a ref: which servers predate `diagnostics.host` outlives one host set.
  const legacy = useRef(new Set<string>())
  // Why keyed: a changed host set never shows a removed server's reading.
  const [state, setState] = useState<{
    key: string
    results: Readonly<Record<string, ServerLoadResult>>
  }>({ key: '', results: {} })

  useEffect(() => {
    if (key === '') {
      return
    }
    let cancelled = false
    const inFlight = new Set<string>()
    const poll = (): void => {
      // Why: a hidden window shows nothing, so it costs the servers nothing either.
      if (document.hidden) {
        return
      }
      for (const environmentId of key.split('\n')) {
        // Why: a slow server must not stack requests or hold back another server's reading.
        if (inFlight.has(environmentId)) {
          continue
        }
        inFlight.add(environmentId)
        void readServerLoad(environmentId, callServer, legacy.current).then((result) => {
          inFlight.delete(environmentId)
          if (!cancelled) {
            setState((prev) => ({
              key,
              results: { ...(prev.key === key ? prev.results : {}), [environmentId]: result }
            }))
          }
        })
      }
    }
    poll()
    const timer = window.setInterval(poll, pollMs)
    document.addEventListener('visibilitychange', poll)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [key, pollMs])

  return state.key === key ? state.results : EMPTY_RESULTS
}
