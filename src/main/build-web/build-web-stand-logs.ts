import type { BuildWebMutationResult } from '../../shared/build-web-types'
import type { BuildWebLogPiece, BuildWebStandLogTail } from '../../shared/build-web-stand-types'
import { requireBuildWebCredential } from './build-web-connection'
import { BuildWebApiError, buildWebMutation, buildWebStreamRequest } from './build-web-request'
import { openTextStream, readTextStream, stopTextStream } from './build-web-text-stream'

// A service's log on a stand, streamed by the console from `docker compose logs [-f]`.

const enc = encodeURIComponent
// Why: 50 000 long lines of a chatty service; older text rolls off so a followed log stays bounded.
const MAX_CHARS = 24 * 1024 * 1024
// Why: the console closes the SSH session once the page stops reading.
const READER_IDLE_MS = 45_000
const FOLLOW_MAX_MS = 2 * 60 * 60_000
const READ_MAX_MS = 2 * 60_000
const MAX_OPEN = 6
const open: string[] = []

export function startBuildWebStandLogs(args: {
  standId: string
  service: string
  tail: BuildWebStandLogTail
  follow: boolean
}): Promise<BuildWebMutationResult<{ streamId: string }>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const abort = new AbortController()
    const response = await buildWebStreamRequest({
      ...credential,
      path: `/api/stands/${enc(args.standId)}/services/${enc(args.service)}/logs?tail=${args.tail}&follow=${args.follow ? 1 : 0}`,
      signal: AbortSignal.any([
        abort.signal,
        AbortSignal.timeout(args.follow ? FOLLOW_MAX_MS : READ_MAX_MS)
      ])
    })
    // Why: an older console answers an unknown path with its web app's HTML, not a refusal.
    if (!(response.headers.get('content-type') ?? '').startsWith('text/plain')) {
      await response.body?.cancel().catch(() => {})
      throw new BuildWebApiError('This build-web cannot read service logs yet', 404, [], true)
    }
    const streamId = openTextStream(response, abort, {
      maxChars: MAX_CHARS,
      overflow: 'roll',
      readerIdleMs: READER_IDLE_MS
    })
    open.push(streamId)
    while (open.length > MAX_OPEN) {
      stopTextStream(open.shift() ?? '')
    }
    return { streamId }
  })
}

export function readBuildWebStandLogs(args: {
  streamId: string
  offset: number
}): BuildWebLogPiece {
  const piece = readTextStream(args.streamId, args.offset)
  if (!piece) {
    throw new Error('The log stream is gone. Open the log again.')
  }
  return piece
}

export function stopBuildWebStandLogs(args: { streamId: string }): boolean {
  const at = open.indexOf(args.streamId)
  if (at !== -1) {
    open.splice(at, 1)
  }
  return stopTextStream(args.streamId)
}
