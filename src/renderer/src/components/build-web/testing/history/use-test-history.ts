import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  BuildWebTestCaseHistory,
  BuildWebTestRun,
  BuildWebTestRunDetail,
  BuildWebTestWorkspace
} from '../../../../../../shared/build-web-test-history-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../../build-web-client'

const message = (failure: unknown) => (failure instanceof Error ? failure.message : String(failure))

type Loaded<T> = { data: T | null; error: string | null; loading: boolean }

/** One read keyed by `key`; a newer key drops the answer to an older one. Null key reads nothing. */
function useRead<T>(
  key: string | null,
  read: () => Promise<T>
): Loaded<T> & { reload: () => void } {
  const [state, setState] = useState<Loaded<T>>({ data: null, error: null, loading: key !== null })
  const [round, setRound] = useState(0)
  const latest = useRef(0)
  const readRef = useRef(read)
  readRef.current = read
  useEffect(() => {
    const generation = ++latest.current
    if (key === null) {
      setState({ data: null, error: null, loading: false })
      return
    }
    // Why keep the data: a reload of the same key should not blank what is on screen.
    setState((current) => ({ ...current, error: null, loading: true }))
    readRef
      .current()
      .then((data) => {
        if (generation === latest.current) {
          setState({ data, error: null, loading: false })
        }
      })
      .catch((failure: unknown) => {
        if (generation === latest.current) {
          setState({ data: null, error: message(failure), loading: false })
        }
      })
  }, [key, round])
  const reload = useCallback(() => setRound((n) => n + 1), [])
  return { ...state, reload }
}

/** The runs build-web keeps in its history, newest first. */
export function useTestRuns(
  target: RuntimeClientTarget
): Loaded<BuildWebTestRun[]> & { reload: () => void } {
  return useRead('runs', () => callBuildWeb(target, 'testRuns'))
}

/** One run's delta and breakdown; null data with no error when the console no longer has it. */
export function useTestRun(
  target: RuntimeClientTarget,
  runId: string | null
): Loaded<BuildWebTestRunDetail | null> {
  const loaded = useRead(runId, () =>
    runId ? callBuildWeb(target, 'testRun', { runId }) : Promise.resolve(null)
  )
  // Why: a different run's answer must not show while the picked one loads.
  return loaded.data && runId && loaded.data.run.id !== runId
    ? { data: null, error: null, loading: true }
    : loaded
}

/** The files and tests of one workspace, read once it is opened. */
export function useTestWorkspace(
  target: RuntimeClientTarget,
  runId: string,
  workspace: string,
  open: boolean
): Loaded<BuildWebTestWorkspace> {
  return useRead(open ? `${runId}\n${workspace}` : null, () =>
    callBuildWeb(target, 'testRunWorkspace', { runId, workspace })
  )
}

/** What one test did over its last runs. */
export function useTestCase(
  target: RuntimeClientTarget,
  key: string | null
): Loaded<BuildWebTestCaseHistory> {
  return useRead(key, () =>
    key ? callBuildWeb(target, 'testCase', { key }) : Promise.reject(new Error('no test'))
  )
}
