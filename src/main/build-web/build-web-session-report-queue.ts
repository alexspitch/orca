import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { sameBuildWebConsole } from '../../shared/build-web-console-origin'
import { durableWriteTempPath, writeFileDurableSync } from '../durable-file-write'
import { BuildWebApiError } from './build-web-request'
import { recordOf, textOf } from './build-web-response-fields'

// What the host owes the console about its task worktrees (IS-147): «the worktree is gone» and
// «a person kept it». On disk until the console confirms, so a restart or an offline console loses nothing.

export type BuildWebSessionReportKind = 'worktree-removed' | 'keep'

export type BuildWebSessionReport = {
  kind: BuildWebSessionReportKind
  sessionId: string
  /** The console that holds the session; the report waits while another one is connected. */
  consoleHost: string
  note?: string
  external?: boolean
}

type QueuedReport = BuildWebSessionReport & { attempts: number; nextAt: number; queuedAt: number }

export type BuildWebSessionReportQueue = {
  /** Synchronous and durable: callers enqueue from inside a removal. */
  enqueue: (report: BuildWebSessionReport) => void
  /** The finisher holds a session's report until it knows the note (a kept branch). */
  hold: (sessionId: string) => void
  /** `external`: the removal it held cleaned up after a folder deleted behind Orca's back. */
  release: (sessionId: string, note?: string, external?: boolean) => void
  drain: () => Promise<void>
  pending: () => readonly BuildWebSessionReport[]
}

export type BuildWebSessionReportQueueDeps = {
  filePath: string
  /** The connected console's base URL, or null when none is. */
  consoleHost: () => string | null
  send: (report: BuildWebSessionReport) => Promise<unknown>
  now?: () => number
  retryBaseMs?: number
}

const KINDS: readonly BuildWebSessionReportKind[] = ['worktree-removed', 'keep']
const RETRY_MAX_MS = 60 * 60_000
const MAX_AGE_MS = 30 * 24 * 60 * 60_000
const MAX_REPORTS = 500
// Why these: the console answered about this report and will answer the same again.
const FINAL_STATUSES = new Set([400, 403, 404, 405, 410, 422])

export function isFinalBuildWebReportRefusal(error: unknown): boolean {
  return (
    error instanceof BuildWebApiError && (FINAL_STATUSES.has(error.status) || error.routeMissing)
  )
}

function queuedReportOf(value: unknown): QueuedReport | null {
  const v = recordOf(value)
  const kind = KINDS.find((k) => k === v?.kind)
  const sessionId = textOf(v?.sessionId)
  const consoleHost = textOf(v?.consoleHost)
  if (!v || !kind || !sessionId || !consoleHost) {
    return null
  }
  const note = textOf(v.note)
  const count = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0)
  return {
    kind,
    sessionId,
    consoleHost,
    ...(note ? { note } : {}),
    ...(v.external === true ? { external: true } : {}),
    attempts: count(v.attempts),
    nextAt: count(v.nextAt),
    queuedAt: count(v.queuedAt)
  }
}

function readReports(filePath: string): QueuedReport[] {
  try {
    const raw = recordOf(JSON.parse(readFileSync(filePath, 'utf-8')))
    const reports = Array.isArray(raw?.reports) ? raw.reports : []
    return reports.map(queuedReportOf).filter((r): r is QueuedReport => r !== null)
  } catch {
    return []
  }
}

function reportOf(queued: QueuedReport): BuildWebSessionReport {
  return {
    kind: queued.kind,
    sessionId: queued.sessionId,
    consoleHost: queued.consoleHost,
    ...(queued.note ? { note: queued.note } : {}),
    ...(queued.external ? { external: true } : {})
  }
}

export function createBuildWebSessionReportQueue(
  deps: BuildWebSessionReportQueueDeps
): BuildWebSessionReportQueue {
  const now = deps.now ?? Date.now
  const retryBaseMs = deps.retryBaseMs ?? 30_000
  let reports = readReports(deps.filePath)
  const held = new Map<string, number>()
  let draining: Promise<void> | null = null
  let drainAgain = false

  const persist = (): void => {
    try {
      mkdirSync(dirname(deps.filePath), { recursive: true })
      const body = { version: 1, reports }
      writeFileDurableSync(
        durableWriteTempPath(deps.filePath),
        deps.filePath,
        `${JSON.stringify(body, null, 2)}\n`
      )
    } catch (error) {
      console.warn('[build-web] could not save the session report queue:', error)
    }
  }

  const kick = (): void => {
    void drain()
  }

  const enqueue = (report: BuildWebSessionReport): void => {
    const same = reports.find((r) => r.kind === report.kind && r.sessionId === report.sessionId)
    if (same) {
      same.note ??= report.note
      // Why: a removal Orca saw itself outranks one it only inferred from a missing folder.
      if (same.external && !report.external) {
        delete same.external
      }
    } else {
      const at = now()
      reports.push({ ...report, attempts: 0, nextAt: at, queuedAt: at })
      reports = reports.slice(-MAX_REPORTS)
    }
    persist()
    kick()
  }

  const hold = (sessionId: string): void => {
    held.set(sessionId, (held.get(sessionId) ?? 0) + 1)
  }

  const release = (sessionId: string, note?: string, external?: boolean): void => {
    const count = (held.get(sessionId) ?? 1) - 1
    if (count > 0) {
      held.set(sessionId, count)
    } else {
      held.delete(sessionId)
    }
    const removal = reports.find((r) => r.kind === 'worktree-removed' && r.sessionId === sessionId)
    let changed = false
    if (note && removal && !removal.note) {
      removal.note = note
      changed = true
    }
    if (external && removal && !removal.external) {
      removal.external = true
      changed = true
    }
    if (changed) {
      persist()
    }
    kick()
  }

  const sendDue = async (): Promise<void> => {
    const host = deps.consoleHost()
    let changed = false
    for (const report of reports) {
      const at = now()
      if (at - report.queuedAt > MAX_AGE_MS) {
        reports = reports.filter((r) => r !== report)
        changed = true
        continue
      }
      if (
        !sameBuildWebConsole(report.consoleHost, host) ||
        report.nextAt > at ||
        held.has(report.sessionId)
      ) {
        continue
      }
      try {
        await deps.send(reportOf(report))
        reports = reports.filter((r) => r !== report)
      } catch (error) {
        if (isFinalBuildWebReportRefusal(error)) {
          console.warn(`[build-web] the console refused the ${report.kind} report:`, error)
          reports = reports.filter((r) => r !== report)
        } else {
          report.attempts += 1
          report.nextAt = now() + Math.min(retryBaseMs * 2 ** (report.attempts - 1), RETRY_MAX_MS)
        }
      }
      changed = true
    }
    if (changed) {
      persist()
    }
  }

  const drain = (): Promise<void> => {
    if (draining) {
      // Why: a report enqueued or released mid-pass may have missed that pass.
      drainAgain = true
      return draining
    }
    const pass = async (): Promise<void> => {
      do {
        drainAgain = false
        await sendDue()
      } while (drainAgain)
    }
    draining = pass().finally(() => {
      draining = null
    })
    return draining
  }

  return { enqueue, hold, release, drain, pending: () => reports.map(reportOf) }
}
