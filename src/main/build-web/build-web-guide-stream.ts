import type { BuildWebMutationResult } from '../../shared/build-web-types'
import type { BuildWebGuidePiece } from '../../shared/build-web-task-types'
import { BUILD_WEB_GUIDE_TIMEOUT_MS } from '../../shared/build-web-timeouts'
import { requireBuildWebCredential } from './build-web-connection'
import { buildWebMutation, buildWebStreamRequest } from './build-web-request'
import { openTextStream, readTextStream } from './build-web-text-stream'

// A guide is written by the model on the console and streamed back as plain text for minutes.
// Main reads that stream into a buffer, and the card reads the buffer piece by piece — the same
// shape as a build log, so a paired client sees the text arrive as well as this window does.

// Why a cap: a runaway answer must not grow main's memory without end.
const MAX_CHARS = 400_000

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
    const abort = new AbortController()
    const response = await buildWebStreamRequest({
      ...credential,
      method: 'POST',
      path: `/api/guide/${revise ? 'revise' : 'generate'}`,
      body: revise
        ? { runId: args.runId, feedback: args.feedback, currentGuide: args.currentGuide ?? '' }
        : { runId: args.runId },
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(BUILD_WEB_GUIDE_TIMEOUT_MS)])
    })
    const streamId = openTextStream(response, abort, {
      maxChars: MAX_CHARS,
      overflow: 'cut',
      cutMessage: 'The guide is longer than Orca reads; the rest was cut.'
    })
    return { streamId }
  })
}

/** The guide written since `offset`. A stream that is gone was read to its end long ago. */
export function readBuildWebGuideStream(streamId: string, offset: number): BuildWebGuidePiece {
  const piece = readTextStream(streamId, offset)
  if (!piece) {
    throw new Error('The guide stream is gone. Read the guide from the build again.')
  }
  return { text: piece.text, next: piece.next, done: piece.done, error: piece.error }
}
