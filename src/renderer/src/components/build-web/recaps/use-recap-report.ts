import { useCallback, useEffect, useState } from 'react'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'

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

/** A report read piece by piece (a whole one outgrows one reply), then handed over whole. */
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
        let html = ''
        let offset = 0
        for (;;) {
          const piece = await callBuildWeb(target, 'recapReport', { runId, offset })
          if (!alive) {
            return
          }
          html += piece.text
          // Why the empty check: a piece that adds nothing would otherwise ask forever.
          if (piece.next >= piece.total || piece.text.length === 0) {
            break
          }
          offset = piece.next
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
