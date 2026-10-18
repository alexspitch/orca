import { getMainHttpClient } from '../network/http-client'
import type { BuildWebPushProgress } from '../../shared/build-web-image-types'
import { requireBuildWebCredential } from './build-web-connection'
import { invalidateBuildWebImageCatalog } from './build-web-images'
import { recordOf, textOf } from './build-web-response-fields'

// A push runs in the console's background; its progress exists only on the run's event stream
// (the docker log, an OK or FAIL line per image, the end of the push). Main follows that stream
// after a push starts, so Images can show it and re-read the table once the push lands.

type Watch = {
  runId: string
  state: BuildWebPushProgress['state']
  lines: string[]
  ok: Set<string>
  failed: Set<string>
  error: string | null
  touched: number
  stop: AbortController
}

const LINES_KEPT = 300
const LINES_SENT = 200
// Why: a stream that replays nothing belongs to a console process that does not hold this push.
const QUIET_MS = 15_000
const MAX_MS = 60 * 60_000
const KEEP_MS = 15 * 60_000
const RESULT = /^\[push\] (OK|FAIL)\s+(\S+) \(([^)]+)\)/
const watches = new Map<string, Watch>()

function prune(now: number): void {
  for (const [runId, watch] of watches) {
    if (watch.state !== 'pushing' && now - watch.touched > KEEP_MS) {
      watches.delete(runId)
    }
  }
}

/** One stream event; true once the push is over. */
function onEvent(watch: Watch, raw: string): boolean {
  let event: Record<string, unknown> | null
  try {
    event = recordOf(JSON.parse(raw))
  } catch {
    return false
  }
  const data = recordOf(event?.data)
  switch (event?.type) {
    case 'log': {
      const line = textOf(data?.line)
      const result = RESULT.exec(line)
      if (result) {
        ;(result[1] === 'OK' ? watch.ok : watch.failed).add(`${result[2]}|${result[3]}`)
      } else if (line.startsWith('[push] ERROR')) {
        watch.error = line.slice('[push] ERROR'.length).trim()
      }
      watch.lines.push(data?.stderr === true ? `· ${line}` : line)
      if (watch.lines.length > LINES_KEPT) {
        watch.lines.splice(0, watch.lines.length - LINES_KEPT)
      }
      return false
    }
    case 'push-status':
      return data?.pushing === false
    case 'done':
      return true
    default:
      return false
  }
}

async function follow(watch: Watch): Promise<void> {
  let heard = false
  let ended = false
  const quiet = setTimeout(() => !heard && watch.stop.abort(), QUIET_MS)
  try {
    const credential = requireBuildWebCredential()
    const response = await getMainHttpClient().fetch(
      `${credential.baseUrl}/api/runs/${encodeURIComponent(watch.runId)}/stream`,
      {
        headers: { authorization: `Bearer ${credential.token}`, accept: 'text/event-stream' },
        // Why: a redirect would carry the bearer token to wherever the console points.
        redirect: 'error',
        signal: AbortSignal.any([watch.stop.signal, AbortSignal.timeout(MAX_MS)])
      }
    )
    if (!response.ok || !response.body) {
      await response.body?.cancel().catch(() => {})
      throw new Error(`build-web answered ${response.status} for the push's progress`)
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (!ended) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      buffer += decoder.decode(value, { stream: true })
      let cut = buffer.indexOf('\n\n')
      while (cut >= 0 && !ended) {
        const data = buffer
          .slice(0, cut)
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n')
        buffer = buffer.slice(cut + 2)
        if (data) {
          heard = true
          watch.touched = Date.now()
          ended = onEvent(watch, data)
        }
        cut = buffer.indexOf('\n\n')
      }
    }
    await reader.cancel().catch(() => {})
  } catch (error) {
    if (heard || !watch.stop.signal.aborted) {
      watch.error ??= error instanceof Error ? error.message : String(error)
    }
  } finally {
    clearTimeout(quiet)
    watch.state = ended || watch.ok.size > 0 || watch.failed.size > 0 ? 'done' : 'unknown'
    watch.touched = Date.now()
    // Why: the pushed flags changed on the console; the table must read them anew.
    invalidateBuildWebImageCatalog()
  }
}

/** Follow the push just started on the run; a push queued onto one in progress rides its stream. */
export function followBuildWebPush(runId: string): void {
  const now = Date.now()
  prune(now)
  if (watches.get(runId)?.state === 'pushing') {
    return
  }
  const watch: Watch = {
    runId,
    state: 'pushing',
    lines: [],
    ok: new Set(),
    failed: new Set(),
    error: null,
    touched: now,
    stop: new AbortController()
  }
  watches.set(runId, watch)
  void follow(watch)
}

/** How the pushes of these runs stand; a run nobody follows reads as unknown. */
export function buildWebPushProgress(runIds: string[]): BuildWebPushProgress[] {
  return runIds.map((runId) => {
    const watch = watches.get(runId)
    if (!watch) {
      return { runId, state: 'unknown', lines: [], ok: [], failed: [], error: null }
    }
    return {
      runId,
      state: watch.state,
      lines: watch.lines.slice(-LINES_SENT),
      ok: [...watch.ok],
      failed: [...watch.failed],
      error: watch.error
    }
  })
}

/** @internal - tests start with no pushes followed. */
export function _resetBuildWebPushProgress(): void {
  for (const watch of watches.values()) {
    watch.stop.abort()
  }
  watches.clear()
}
