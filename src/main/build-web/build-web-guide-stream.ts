import { randomUUID } from 'node:crypto'
import { getMainHttpClient } from '../network/http-client'
import { readFetchResponseJsonWithinLimit } from '../../shared/fetch-response-body'
import type { BuildWebMutationResult } from '../../shared/build-web-types'
import type { BuildWebGuidePiece } from '../../shared/build-web-task-types'
import { BUILD_WEB_GUIDE_TIMEOUT_MS } from '../../shared/build-web-timeouts'
import { requireBuildWebCredential } from './build-web-connection'
import { BuildWebApiError, BuildWebUnreachableError, buildWebMutation } from './build-web-request'
import { recordOf, textOf, textsOf } from './build-web-response-fields'

// A guide is written by the model on the console and streamed back as plain text for minutes.
// Main reads that stream into a buffer, and the card reads the buffer piece by piece — the same
// shape as a build log, so a paired client sees the text arrive as well as this window does.

type GuideStream = { text: string; done: boolean; error: string | null; touched: number }

// Why a cap: a runaway answer must not grow main's memory without end.
const MAX_CHARS = 400_000
// Why: a reader that went away leaves its buffer; it is dropped this long after it last moved.
const KEEP_MS = 10 * 60_000
const streams = new Map<string, GuideStream>()

function prune(now: number): void {
  for (const [id, stream] of streams) {
    if (now - stream.touched > KEEP_MS) {
      streams.delete(id)
    }
  }
}

async function pump(response: Response, stream: GuideStream): Promise<void> {
  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  try {
    while (reader) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      stream.text += decoder.decode(value, { stream: true })
      stream.touched = Date.now()
      if (stream.text.length > MAX_CHARS) {
        stream.text = stream.text.slice(0, MAX_CHARS)
        stream.error = 'The guide is longer than Orca reads; the rest was cut.'
        await reader.cancel().catch(() => {})
        break
      }
    }
    stream.text += decoder.decode()
  } catch (error) {
    stream.error = error instanceof Error ? error.message : String(error)
  } finally {
    stream.done = true
    stream.touched = Date.now()
  }
}

/**
 * Write the guide afresh, or revise it by a comment. The console saves the result on the run
 * itself once the stream ends, so the card only re-reads the run afterwards.
 */
export function startBuildWebGuide(args: {
  runId: string
  feedback?: string
  currentGuide?: string
}): Promise<BuildWebMutationResult<{ streamId: string }>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const revise = Boolean(args.feedback)
    const body = revise
      ? { runId: args.runId, feedback: args.feedback, currentGuide: args.currentGuide ?? '' }
      : { runId: args.runId }
    let response: Response
    try {
      response = await getMainHttpClient().fetch(
        `${credential.baseUrl}/api/guide/${revise ? 'revise' : 'generate'}`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${credential.token}`,
            accept: 'text/plain, application/json',
            'content-type': 'application/json'
          },
          body: JSON.stringify(body),
          // Why: a redirect would carry the bearer token to wherever the console points.
          redirect: 'error',
          signal: AbortSignal.timeout(BUILD_WEB_GUIDE_TIMEOUT_MS)
        }
      )
    } catch (error) {
      throw new BuildWebUnreachableError(credential.baseUrl, error, credential.token)
    }
    if (!response.ok) {
      const data = recordOf(
        await readFetchResponseJsonWithinLimit<unknown>(response, 64 * 1024).catch(() => null)
      )
      throw new BuildWebApiError(
        textOf(data?.error) || response.statusText || `HTTP ${response.status}`,
        response.status,
        textsOf(data?.needsPermission)
      )
    }
    const now = Date.now()
    prune(now)
    const streamId = randomUUID()
    const stream: GuideStream = { text: '', done: false, error: null, touched: now }
    streams.set(streamId, stream)
    void pump(response, stream)
    return { streamId }
  })
}

/** The guide written since `offset`. A stream that is gone was read to its end long ago. */
export function readBuildWebGuideStream(streamId: string, offset: number): BuildWebGuidePiece {
  const stream = streams.get(streamId)
  if (!stream) {
    throw new Error('The guide stream is gone. Read the guide from the build again.')
  }
  stream.touched = Date.now()
  const from = Math.min(offset, stream.text.length)
  return {
    text: stream.text.slice(from),
    next: stream.text.length,
    done: stream.done,
    error: stream.error
  }
}
