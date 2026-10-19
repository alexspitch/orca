import { randomUUID } from 'node:crypto'
import type { BuildWebLogPiece } from '../../shared/build-web-stand-types'

// A text answer the console streams for minutes (a guide being written, a followed log). Main reads
// it into a buffer and the page reads the buffer piece by piece, so a paired client sees the text
// arrive the same way this window does.

export type TextStreamOptions = {
  maxChars: number
  /** `cut` stops at the cap (a document); `roll` drops the oldest lines and keeps reading (a log). */
  overflow: 'cut' | 'roll'
  cutMessage?: string
  /** Abort the request when nobody read for this long; unset, the stream runs to its own end. */
  readerIdleMs?: number
}

type TextStream = {
  text: string
  /** Absolute offset of `text[0]`; grows as a rolling stream drops its head. */
  base: number
  done: boolean
  error: string | null
  touched: number
  read: number
  abort: AbortController
  options: TextStreamOptions
}

// Why: a reader that went away leaves its buffer; it is dropped this long after it last moved.
const KEEP_MS = 10 * 60_000
const PRUNE_EVERY_MS = 15_000
// Why: one piece must fit an RPC reply on its way to a paired client.
const MAX_PIECE_CHARS = 256 * 1024
const streams = new Map<string, TextStream>()
let pruneTimer: ReturnType<typeof setInterval> | null = null

function prune(now: number): void {
  for (const [id, stream] of streams) {
    const idle = stream.options.readerIdleMs
    if (!stream.done && idle !== undefined && now - stream.read > idle) {
      stream.abort.abort()
    }
    if (now - stream.touched > KEEP_MS || (idle !== undefined && now - stream.read > idle)) {
      streams.delete(id)
    }
  }
  if (streams.size === 0 && pruneTimer) {
    clearInterval(pruneTimer)
    pruneTimer = null
  }
}

function append(stream: TextStream, chunk: string): boolean {
  stream.text += chunk
  const over = stream.text.length - stream.options.maxChars
  if (over <= 0) {
    return true
  }
  if (stream.options.overflow === 'cut') {
    stream.text = stream.text.slice(0, stream.options.maxChars)
    stream.error =
      stream.options.cutMessage ?? 'The text is longer than Orca reads; the rest was cut.'
    return false
  }
  // Why: drop whole lines, so a reader never starts mid-line after a trim.
  const newline = stream.text.indexOf('\n', over)
  const cut = newline === -1 ? over : newline + 1
  stream.text = stream.text.slice(cut)
  stream.base += cut
  return true
}

async function pump(response: Response, stream: TextStream): Promise<void> {
  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  try {
    while (reader) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      stream.touched = Date.now()
      if (!append(stream, decoder.decode(value, { stream: true }))) {
        await reader.cancel().catch(() => {})
        break
      }
    }
    append(stream, decoder.decode())
  } catch (error) {
    // Why: a stop or an idle abort is the reader's choice, not a failure of the stream.
    if (!stream.abort.signal.aborted) {
      stream.error = error instanceof Error ? error.message : String(error)
    }
  } finally {
    stream.done = true
    stream.touched = Date.now()
  }
}

/** Start buffering an open response; the id is what the page reads it by. */
export function openTextStream(
  response: Response,
  abort: AbortController,
  options: TextStreamOptions
): string {
  const now = Date.now()
  prune(now)
  const id = randomUUID()
  const stream: TextStream = {
    text: '',
    base: 0,
    done: false,
    error: null,
    touched: now,
    read: now,
    abort,
    options
  }
  streams.set(id, stream)
  pruneTimer ??= setInterval(() => prune(Date.now()), PRUNE_EVERY_MS)
  pruneTimer.unref?.()
  void pump(response, stream)
  return id
}

/** The text since `offset`. Done only once the reader has caught up with a finished stream. */
export function readTextStream(id: string, offset: number): BuildWebLogPiece | null {
  const stream = streams.get(id)
  if (!stream) {
    return null
  }
  const now = Date.now()
  stream.touched = now
  stream.read = now
  const end = stream.base + stream.text.length
  const from = Math.min(Math.max(offset, stream.base), end)
  const text = stream.text.slice(from - stream.base, from - stream.base + MAX_PIECE_CHARS)
  const next = from + text.length
  return {
    text,
    next,
    done: stream.done && next >= end,
    error: stream.error,
    trimmed: offset < stream.base
  }
}

export function stopTextStream(id: string): boolean {
  const stream = streams.get(id)
  if (!stream) {
    return false
  }
  stream.abort.abort()
  streams.delete(id)
  return true
}
