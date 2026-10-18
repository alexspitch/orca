import { useCallback, useEffect, useRef, useState } from 'react'
import type { BuildWebRun } from '../../../../../shared/build-web-run-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'

/** The task's build for the Build and Guide tabs; `undefined` while it loads, null when none. */
export function useIssueRun(
  target: RuntimeClientTarget,
  issueId: string,
  enabled: boolean
): {
  run: BuildWebRun | null | undefined
  error: string | null
  setRun: (run: BuildWebRun | null) => void
  reload: () => void
} {
  // Why keyed by task: another task's build must never show while this one's loads.
  const [loaded, setLoaded] = useState<{ issueId: string; run: BuildWebRun | null } | null>(null)
  const [failed, setFailed] = useState<{ issueId: string; message: string } | null>(null)
  const generation = useRef(0)
  const run = loaded?.issueId === issueId ? loaded.run : undefined
  const error = failed?.issueId === issueId ? failed.message : null
  const setRun = useCallback(
    (next: BuildWebRun | null) => setLoaded({ issueId, run: next }),
    [issueId]
  )
  const load = useCallback(async () => {
    const mine = ++generation.current
    try {
      const next = await callBuildWeb(target, 'getIssueRun', { id: issueId })
      if (mine === generation.current) {
        setLoaded({ issueId, run: next })
        setFailed(null)
      }
    } catch (failure) {
      if (mine === generation.current) {
        setFailed({
          issueId,
          message: failure instanceof Error ? failure.message : String(failure)
        })
      }
    }
  }, [issueId, target])
  useEffect(() => {
    if (enabled) {
      void load()
    }
  }, [enabled, load])
  const reload = useCallback(() => void load(), [load])
  return { run, error, setRun, reload }
}
