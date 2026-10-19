import { afterEach, describe, expect, it, vi } from 'vitest'
import { openTextStream, readTextStream, stopTextStream } from './build-web-text-stream'

// A response whose body the test writes into piece by piece.
function streamedResponse(): {
  response: Response
  write: (text: string) => void
  end: () => void
} {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start: (c) => (controller = c) })
  const encoder = new TextEncoder()
  return {
    response: new Response(body),
    write: (text) => controller.enqueue(encoder.encode(text)),
    end: () => controller.close()
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  vi.useRealTimers()
})

describe('a streamed text', () => {
  it('is read from where the last read ended, and done once read to its end', async () => {
    const { response, write, end } = streamedResponse()
    const id = openTextStream(response, new AbortController(), { maxChars: 100, overflow: 'cut' })
    write('one\n')
    await settle()
    const first = readTextStream(id, 0)
    expect(first).toMatchObject({ text: 'one\n', next: 4, done: false, trimmed: false })
    write('two\n')
    end()
    await settle()
    expect(readTextStream(id, first?.next ?? 0)).toMatchObject({ text: 'two\n', done: true })
  })

  it('cuts a document at its cap and says so', async () => {
    const { response, write } = streamedResponse()
    const id = openTextStream(response, new AbortController(), {
      maxChars: 5,
      overflow: 'cut',
      cutMessage: 'cut'
    })
    write('abcdefgh')
    await settle()
    expect(readTextStream(id, 0)).toMatchObject({ text: 'abcde', done: true, error: 'cut' })
  })

  it('rolls a log: the oldest whole lines go, the offsets stay absolute', async () => {
    const { response, write } = streamedResponse()
    const id = openTextStream(response, new AbortController(), { maxChars: 8, overflow: 'roll' })
    write('aaa\nbbb\nccc\n')
    await settle()
    const piece = readTextStream(id, 0)
    expect(piece).toMatchObject({ text: 'ccc\n', next: 12, trimmed: true })
    expect(readTextStream(id, 12)).toMatchObject({ text: '', trimmed: false })
  })

  it('aborts the request when stopped, and is gone after', async () => {
    const { response } = streamedResponse()
    const abort = new AbortController()
    const id = openTextStream(response, abort, { maxChars: 10, overflow: 'roll' })
    expect(stopTextStream(id)).toBe(true)
    expect(abort.signal.aborted).toBe(true)
    expect(readTextStream(id, 0)).toBeNull()
  })

  it('aborts a log nobody reads any more', async () => {
    vi.useFakeTimers()
    // Why a fresh module: its prune timer must start under the fake clock.
    vi.resetModules()
    const { openTextStream, readTextStream } = await import('./build-web-text-stream')
    const { response } = streamedResponse()
    const abort = new AbortController()
    const id = openTextStream(response, abort, {
      maxChars: 10,
      overflow: 'roll',
      readerIdleMs: 1000
    })
    await vi.advanceTimersByTimeAsync(20_000)
    expect(abort.signal.aborted).toBe(true)
    expect(readTextStream(id, 0)).toBeNull()
  })
})
