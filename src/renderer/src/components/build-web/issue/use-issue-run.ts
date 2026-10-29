import { useCallback, useEffect, useRef, useState } from 'react'
import type { BuildWebRun } from '../../../../../shared/build-web-run-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import {
  createLiveReads,
  createLiveReplyGuard,
  sameReading
} from '../../../../../shared/build-web-live-reads'
import { callBuildWeb } from '../build-web-client'
import { useBuildWebTarget } from '../use-build-web-data'
import { useLiveRead } from '../use-live-read'

const runReads = createLiveReads<BuildWebRun | null>()

/**
 * The task's build for the Build and Guide tabs; `undefined` while it loads, null when none. Read
 * again every few seconds while `visible`, so a build started or moved elsewhere shows here.
 */
export function useIssueRun(
  target: RuntimeClientTarget,
  issueId: string,
  enabled: boolean,
  visible = true
): {
  run: BuildWebRun | null | undefined
  error: string | null
  setRun: (run: BuildWebRun | null) => void
  reload: () => void
} {
  const { contextKey } = useBuildWebTarget()
  // Why keyed by task: another task's build must never show while this one's loads.
  const [loaded, setLoaded] = useState<{ issueId: string; run: BuildWebRun | null } | null>(null)
  const [failed, setFailed] = useState<{ issueId: string; message: string } | null>(null)
  const generation = useRef(0)
  const [guard] = useState(createLiveReplyGuard)
  const run = loaded?.issueId === issueId ? loaded.run : undefined
  const error = failed?.issueId === issueId ? failed.message : null
  // Why a mark: the run handed over is a write's answer, newer than any reading still out.
  const setRun = useCallback(
    (next: BuildWebRun | null) => {
      guard.mark()
      setLoaded({ issueId, run: next })
    },
    [guard, issueId]
  )
  const load = useCallback(async () => {
    const mine = ++generation.current
    guard.mark()
    try {
      const next = await callBuildWeb(target, 'getIssueRun', { id: issueId })
      if (mine === generation.current) {
        setLoaded((shown) =>
          shown?.issueId === issueId && sameReading(shown.run, next)
            ? shown
            : { issueId, run: next }
        )
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
  }, [guard, issueId, target])
  useEffect(() => {
    if (enabled) {
      void load()
    }
  }, [enabled, load])
  useLiveRead(
    runReads,
    enabled && issueId ? `${contextKey}|${issueId}` : null,
    visible,
    () => callBuildWeb(target, 'getIssueRun', { id: issueId }),
    (next, issuedAt) => {
      if (!guard.accepts(issuedAt)) {
        return
      }
      // Why only over a run shown: a card still loading or showing an error reads it itself.
      setLoaded((shown) =>
        shown?.issueId === issueId && !sameReading(shown.run, next) ? { issueId, run: next } : shown
      )
    }
  )
  const reload = useCallback(() => void load(), [load])
  return { run, error, setRun, reload }
}
