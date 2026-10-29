import { useCallback, useEffect, useState } from 'react'
import type {
  BuildWebCommitDiff,
  BuildWebCommitList
} from '../../../../../../src/shared/build-web-run-types'
import {
  createLiveReads,
  createLiveReplyGuard,
  sameReading
} from '../../../../../../src/shared/build-web-live-reads'
import { buildWebErrorMessage } from '../../../build-web-operations'
import { useCardTabActive } from '../../../build-web-card-tabs'
import { useBuildWebScreen } from '../../../build-web-screen-context'
import { useLiveRead } from '../../../use-live-read'

// Why slower than the card: each reading runs git over the task's branches on the console.
const COMMITS_LIVE_MS = 30_000
const commitReads = createLiveReads<BuildWebCommitList>()

/**
 * The task's commits, read again from git on demand and now and then while the tab is shown, and
 * the diff of the one opened.
 */
export function useIssueCommits(issueId: string) {
  const { call, hostId } = useBuildWebScreen()
  const active = useCardTabActive()
  const [guard] = useState(createLiveReplyGuard)
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
      guard.mark()
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
    [call, guard, issueId]
  )
  useEffect(() => {
    void load(false)
  }, [load])
  useLiveRead(
    commitReads,
    `${hostId}|${issueId}`,
    active,
    () => call('issueCommits', { id: issueId, fetch: false }),
    (next, issuedAt) => {
      if (guard.accepts(issuedAt)) {
        setList((shown) => (shown && sameReading(shown, next) ? shown : next))
        setError(null)
      }
    },
    COMMITS_LIVE_MS
  )
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
