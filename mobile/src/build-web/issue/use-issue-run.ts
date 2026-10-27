import { useCallback, useEffect, useRef, useState } from 'react'
import type { BuildWebRun } from '../../../../src/shared/build-web-run-types'
import { buildWebErrorMessage, callBuildWeb } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'

/** The task's build for the Build and Guide tabs; `undefined` while it loads, null when none. */
export function useIssueRun(
  issueId: string,
  enabled: boolean
): {
  run: BuildWebRun | null | undefined
  error: string | null
  setRun: (run: BuildWebRun | null) => void
  reload: () => void
} {
  const { client } = useBuildWebScreen()
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
      const next = await callBuildWeb(client, 'getIssueRun', { id: issueId })
      if (mine === generation.current) {
        setLoaded({ issueId, run: next })
        setFailed(null)
      }
    } catch (failure) {
      if (mine === generation.current) {
        setFailed({ issueId, message: buildWebErrorMessage(failure) })
      }
    }
  }, [client, issueId])
  useEffect(() => {
    if (enabled) {
      void load()
    }
  }, [enabled, load])
  const reload = useCallback(() => void load(), [load])
  return { run, error, setRun, reload }
}
