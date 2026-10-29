import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  afterLiveReading,
  createLiveReads,
  createLiveReplyGuard,
  LIVE_READ_MS,
  liveReadStamp,
  type LiveReadPage
} from './build-web-live-reads'

function fakePage(): LiveReadPage & {
  setHidden: (hidden: boolean) => void
  focus: () => void
} {
  let hidden = false
  const listeners = new Set<() => void>()
  const focusListeners = new Set<() => void>()
  return {
    hidden: () => hidden,
    onChange: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    onFocus: (listener) => {
      focusListeners.add(listener)
      return () => focusListeners.delete(listener)
    },
    setHidden: (next) => {
      hidden = next
      listeners.forEach((listener) => listener())
    },
    focus: () => focusListeners.forEach((listener) => listener())
  }
}

describe('live reads', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('reads a task shown twice once per beat, for both views', async () => {
    const reads = createLiveReads<string>(fakePage())
    const read = vi.fn(async () => 'fresh')
    const a = vi.fn()
    const b = vi.fn()
    reads.watch('host|IS-1', { read, onValue: a, visible: true })
    reads.watch('host|IS-1', { read, onValue: b, visible: true })
    await vi.advanceTimersByTimeAsync(LIVE_READ_MS - 1)
    expect(read).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(read).toHaveBeenCalledTimes(1)
    expect(a).toHaveBeenCalledWith('fresh', expect.any(Number))
    expect(b).toHaveBeenCalledWith('fresh', expect.any(Number))
  })

  it('pauses while no view is in sight or the page is hidden, and catches up on return', async () => {
    const page = fakePage()
    const reads = createLiveReads<string>(page)
    const read = vi.fn(async () => 'fresh')
    const watch = reads.watch('host|IS-1', { read, onValue: () => {}, visible: false })
    await vi.advanceTimersByTimeAsync(LIVE_READ_MS * 4)
    expect(read).not.toHaveBeenCalled()

    watch.setVisible(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(read).toHaveBeenCalledTimes(1)

    page.setHidden(true)
    await vi.advanceTimersByTimeAsync(LIVE_READ_MS * 4)
    expect(read).toHaveBeenCalledTimes(1)
    page.setHidden(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('reads at once when the card comes back into sight or the window gets focus', async () => {
    const page = fakePage()
    const reads = createLiveReads<string>(page)
    const read = vi.fn(async () => 'fresh')
    const watch = reads.watch('host|IS-1', { read, onValue: () => {}, visible: true })
    await vi.advanceTimersByTimeAsync(LIVE_READ_MS)
    expect(read).toHaveBeenCalledTimes(1)

    // Back in sight before the next beat: no wait for it.
    watch.setVisible(false)
    await vi.advanceTimersByTimeAsync(1_000)
    watch.setVisible(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(read).toHaveBeenCalledTimes(2)

    // A focus right after a reading reads nothing; a later one reads at once.
    page.focus()
    await vi.advanceTimersByTimeAsync(0)
    expect(read).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(3_000)
    page.focus()
    await vi.advanceTimersByTimeAsync(0)
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('backs off after failures and stops when the last view closes', async () => {
    const reads = createLiveReads<string>(fakePage())
    const read = vi.fn(async (): Promise<string> => {
      throw new Error('offline')
    })
    const watch = reads.watch('host|IS-1', { read, onValue: () => {}, visible: true })
    await vi.advanceTimersByTimeAsync(LIVE_READ_MS)
    expect(read).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(LIVE_READ_MS)
    expect(read).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(LIVE_READ_MS)
    expect(read).toHaveBeenCalledTimes(2)

    watch.stop()
    await vi.advanceTimersByTimeAsync(LIVE_READ_MS * 20)
    expect(read).toHaveBeenCalledTimes(2)
  })
})

describe('live reply guard', () => {
  it('drops a reply asked before the card read the task itself', () => {
    const guard = createLiveReplyGuard()
    const asked = liveReadStamp()
    guard.mark()
    expect(guard.accepts(asked)).toBe(false)
    expect(guard.accepts(liveReadStamp())).toBe(true)
  })

  it('keeps an optimistic save: no reply while it is out, nor one asked before it ended', () => {
    const guard = createLiveReplyGuard()
    const end = guard.startWrite()
    const askedDuring = liveReadStamp()
    expect(guard.accepts(askedDuring)).toBe(false)
    end()
    expect(guard.accepts(askedDuring)).toBe(false)
    expect(guard.accepts(liveReadStamp())).toBe(true)
  })
})

describe('afterLiveReading', () => {
  const shown = { id: 'a', title: 'Old', comments: [{ id: 'c1' }] }

  it('keeps the object shown when nothing changed, so nothing re-renders', () => {
    expect(afterLiveReading(shown, structuredClone(shown), true)).toBe(shown)
  })

  it('takes a new comment, which leaves updated_at as it was', () => {
    const fresh = { ...shown, comments: [{ id: 'c1' }, { id: 'c2' }] }
    expect(afterLiveReading(shown, fresh, true)).toBe(fresh)
  })

  it('ignores a reading it may not take, or of another task', () => {
    const fresh = { ...shown, title: 'New' }
    expect(afterLiveReading(shown, fresh, false)).toBe(shown)
    expect(afterLiveReading(shown, { ...fresh, id: 'b' }, true)).toBe(shown)
    expect(afterLiveReading(null, fresh, true)).toBe(null)
  })
})
