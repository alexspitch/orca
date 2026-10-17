import { useCallback, useEffect, useState } from 'react'
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
  const [run, setRun] = useState<BuildWebRun | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      setRun(await callBuildWeb(target, 'getIssueRun', { id: issueId }))
      setError(null)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    }
  }, [issueId, target])
  useEffect(() => {
    if (enabled) {
      void load()
    }
  }, [enabled, load])
  return { run, error, setRun, reload: () => void load() }
}
