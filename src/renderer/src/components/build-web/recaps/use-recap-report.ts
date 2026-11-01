import { useCallback, useEffect, useState } from 'react'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { readRecapReport } from './recap-report-pieces'

// A finished report never changes: the last few read stay here, so going back to one is instant.
const KEPT = 4
const kept = new Map<string, string>()

function remember(key: string, html: string): void {
  kept.delete(key)
  kept.set(key, html)
  for (const old of kept.keys()) {
    if (kept.size <= KEPT) {
      break
    }
    kept.delete(old)
  }
}

type ReportRead = { key: string; html: string | null; error: string | null }

/** A report read whole, kept for going back to it. */
export function useRecapReport(
  target: RuntimeClientTarget,
  contextKey: string,
  runId: string | null
): { html: string | null; error: string | null; retry: () => void } {
  const key = runId ? `${contextKey}|${runId}` : null
  const [read, setRead] = useState<ReportRead | null>(null)
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => {
    setRead(null)
    setAttempt((n) => n + 1)
  }, [])
  useEffect(() => {
    if (!runId || !key || kept.has(key)) {
      return
    }
    let alive = true
    void (async () => {
      try {
        const html = await readRecapReport(
          (offset) => callBuildWeb(target, 'recapReport', { runId, offset }),
          () => alive
        )
        if (html === null) {
          return
        }
        remember(key, html)
        setRead({ key, html, error: null })
      } catch (failure) {
        if (alive) {
          setRead({
            key,
            html: null,
            error: failure instanceof Error ? failure.message : String(failure)
          })
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [attempt, key, runId, target])
  // Why from the key: a report switched to must never show the one before it, even for a render.
  const hit = key ? kept.get(key) : undefined
  if (hit !== undefined) {
    return { html: hit, error: null, retry }
  }
  return read && read.key === key
    ? { html: read.html, error: read.error, retry }
    : { html: null, error: null, retry }
}
