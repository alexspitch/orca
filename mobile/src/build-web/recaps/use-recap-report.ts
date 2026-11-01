import { useCallback, useEffect, useState } from 'react'
import { readRecapReport } from '../../../../src/renderer/src/components/build-web/recaps/recap-report-pieces'
import { buildWebErrorMessage } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'
import { phoneRecapDocument, type PhoneRecap } from './recap-phone-document'

// A finished report never changes: the last few read stay here, so going back to one is instant.
const KEPT = 4
const kept = new Map<string, PhoneRecap>()

function remember(key: string, report: PhoneRecap): void {
  kept.delete(key)
  kept.set(key, report)
  for (const old of kept.keys()) {
    if (kept.size <= KEPT) {
      break
    }
    kept.delete(old)
  }
}

type ReportRead = { key: string; report: PhoneRecap | null; error: string | null }

/**
 * The desktop's useRecapReport for the phone: the report read whole, without its scripts (an older
 * host sends them anyway), then made into a document the phone can show.
 */
export function useRecapReport(runId: string): {
  report: PhoneRecap | null
  error: string | null
  retry: () => void
} {
  const { call, hostId, status } = useBuildWebScreen()
  const key = `${hostId}|${status.baseUrl ?? ''}|${runId}`
  const [read, setRead] = useState<ReportRead | null>(null)
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => {
    setRead(null)
    setAttempt((n) => n + 1)
  }, [])
  useEffect(() => {
    if (kept.has(key)) {
      return
    }
    let alive = true
    void (async () => {
      try {
        const html = await readRecapReport(
          (offset) => call('recapReport', { runId, offset, inert: true }),
          () => alive
        )
        if (html === null) {
          return
        }
        const report = await phoneRecapDocument(html)
        remember(key, report)
        if (alive) {
          setRead({ key, report, error: null })
        }
      } catch (failure) {
        if (alive) {
          setRead({ key, report: null, error: buildWebErrorMessage(failure) })
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [attempt, call, key, runId])
  // Why from the key: a report switched to must never show the one before it, even for a render.
  const hit = kept.get(key)
  if (hit) {
    return { report: hit, error: null, retry }
  }
  return read && read.key === key
    ? { report: read.report, error: read.error, retry }
    : { report: null, error: null, retry }
}
