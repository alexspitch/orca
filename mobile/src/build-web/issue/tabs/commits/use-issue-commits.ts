import { useCallback, useEffect, useState } from 'react'
import type {
  BuildWebCommitDiff,
  BuildWebCommitList
} from '../../../../../../src/shared/build-web-run-types'
import { buildWebErrorMessage } from '../../../build-web-operations'
import { useBuildWebScreen } from '../../../build-web-screen-context'

/** The task's commits, read again from git on demand, and the diff of the one opened. */
export function useIssueCommits(issueId: string) {
  const { call } = useBuildWebScreen()
  const [list, setList] = useState<BuildWebCommitList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [sha, setSha] = useState<string | null>(null)
  const [diff, setDiff] = useState<BuildWebCommitDiff | null>(null)
  // Why its own error: a failed diff must not hide the list, and retry must fetch the diff again.
  const [diffError, setDiffError] = useState<string | null>(null)
  const [diffAttempt, setDiffAttempt] = useState(0)

  const load = useCallback(
    async (fetchFirst: boolean) => {
      setFetching(fetchFirst)
      try {
        setList(await call('issueCommits', { id: issueId, fetch: fetchFirst }))
        setError(null)
      } catch (failure) {
        setError(buildWebErrorMessage(failure))
      } finally {
        setFetching(false)
      }
    },
    [call, issueId]
  )
  useEffect(() => {
    void load(false)
  }, [load])
  useEffect(() => {
    if (!sha) {
      return
    }
    let alive = true
    setDiff(null)
    setDiffError(null)
    call('commitDiff', { id: issueId, sha }).then(
      (next) => alive && setDiff(next),
      (failure) => alive && setDiffError(buildWebErrorMessage(failure))
    )
    return () => {
      alive = false
    }
  }, [call, diffAttempt, issueId, sha])

  return {
    list,
    error,
    fetching,
    load,
    sha,
    open: setSha,
    diff,
    diffError,
    retryDiff: () => setDiffAttempt((n) => n + 1)
  }
}
