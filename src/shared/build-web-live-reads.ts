// IS-147: the console sends no change feed for a task, so an open card reads what it shows again.
// One reader per thing read (a task, its run, its subtasks), however many views show it: it reads
// while one of them is in sight and the page is not hidden, at once when it comes into sight or the
// window gets focus, and slower after failures. The desktop and the phone share it.

/** How often a card in sight reads its task again. */
export const LIVE_READ_MS = 10_000
const LIVE_READ_MAX_MS = 60_000
// Why a floor: a focus right after a reading has nothing new to show.
const FOCUS_READ_MIN_GAP_MS = 2_000

/** The wait before the next reading: the beat, doubled after each failure in a row, up to a minute. */
export function liveReadDelay(everyMs: number, failures: number): number {
  return Math.min(Math.max(everyMs, LIVE_READ_MAX_MS), everyMs * 2 ** failures)
}

let clock = 0
/** One clock for readings and writes alike, so a reply is known to have been asked before a write. */
export function liveReadStamp(): number {
  clock += 1
  return clock
}

/**
 * Whether a fresh reading says nothing new; the view then keeps the object it shows. The whole
 * reading and not `updated_at`: the console moves that for the task's fields only, not for a
 * comment, a file or a session.
 */
export function sameReading(shown: unknown, fresh: unknown): boolean {
  return JSON.stringify(shown) === JSON.stringify(fresh)
}

/** The task a card shows after a background reading: the fresh one only when it is news it may take. */
export function afterLiveReading<T extends { id: string }>(
  shown: T | null,
  fresh: T,
  accepted: boolean
): T | null {
  return accepted && shown && shown.id === fresh.id && !sameReading(shown, fresh) ? fresh : shown
}

/**
 * Which background replies a card takes. None while its own write is out — it would undo what the
 * write shows — and none asked before its last write or its last deliberate read, whose answer is
 * newer than theirs.
 */
export type LiveReplyGuard = {
  /** A deliberate read starts (the card opens, a write is read back). */
  mark: () => void
  /** A write starts; the returned call ends it. */
  startWrite: () => () => void
  accepts: (issuedAt: number) => boolean
}

export function createLiveReplyGuard(): LiveReplyGuard {
  let floor = 0
  let writes = 0
  return {
    mark: () => {
      floor = liveReadStamp()
    },
    startWrite: () => {
      writes += 1
      floor = liveReadStamp()
      let ended = false
      return () => {
        if (!ended) {
          ended = true
          writes -= 1
          floor = liveReadStamp()
        }
      }
    },
    accepts: (issuedAt) => writes === 0 && issuedAt > floor
  }
}

export type LiveReadPage = {
  hidden: () => boolean
  onChange: (listener: () => void) => () => void
  onFocus?: (listener: () => void) => () => void
}

export type LiveReadTimers = {
  now: () => number
  after: (ms: number, run: () => void) => () => void
}

export type LiveReadWatch = {
  setVisible: (visible: boolean) => void
  stop: () => void
}

export type LiveReads<T> = {
  /** Follows `key`; the first reading comes one beat after the first view, which has just read it. */
  watch: (
    key: string,
    view: {
      read: () => Promise<T>
      onValue: (value: T, issuedAt: number) => void
      visible: boolean
      everyMs?: number
    }
  ) => LiveReadWatch
}

// Why a page and not window focus: a card on a second monitor is still read while another app is used.
const documentPage: LiveReadPage = {
  hidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  onChange: (listener) => {
    if (typeof document === 'undefined') {
      return () => {}
    }
    document.addEventListener('visibilitychange', listener)
    return () => document.removeEventListener('visibilitychange', listener)
  },
  onFocus: (listener) => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return () => {}
    }
    window.addEventListener('focus', listener)
    return () => window.removeEventListener('focus', listener)
  }
}

const globalTimers: LiveReadTimers = {
  now: () => Date.now(),
  after: (ms, run) => {
    const timer = setTimeout(run, ms)
    return () => clearTimeout(timer)
  }
}

export function createLiveReads<T>(
  page: LiveReadPage = documentPage,
  timers: LiveReadTimers = globalTimers
): LiveReads<T> {
  type View = {
    read: () => Promise<T>
    onValue: (value: T, issuedAt: number) => void
    visible: boolean
  }
  type Reader = {
    views: Set<View>
    everyMs: number
    cancel: (() => void) | null
    busy: boolean
    failures: number
    lastAt: number
    /** In sight at the last schedule: coming into sight reads at once. */
    inSight: boolean
  }
  const readers = new Map<string, Reader>()
  let offPage: (() => void) | null = null
  let offFocus: (() => void) | null = null

  const inSight = (reader: Reader): boolean =>
    !page.hidden() && [...reader.views].some((view) => view.visible)

  const schedule = (key: string, reader: Reader): void => {
    reader.cancel?.()
    reader.cancel = null
    const seen = inSight(reader)
    const cameIntoSight = seen && !reader.inSight
    reader.inSight = seen
    if (reader.busy || readers.get(key) !== reader || !seen) {
      return
    }
    const due = cameIntoSight
      ? timers.now()
      : reader.lastAt + liveReadDelay(reader.everyMs, reader.failures)
    reader.cancel = timers.after(Math.max(0, due - timers.now()), () => {
      reader.cancel = null
      void pull(key, reader)
    })
  }

  const pull = async (key: string, reader: Reader): Promise<void> => {
    const [first] = reader.views
    if (!first || readers.get(key) !== reader || !inSight(reader)) {
      return
    }
    reader.busy = true
    reader.lastAt = timers.now()
    const issuedAt = liveReadStamp()
    try {
      const value = await first.read()
      reader.failures = 0
      for (const view of reader.views) {
        view.onValue(value, issuedAt)
      }
    } catch {
      reader.failures += 1
    } finally {
      reader.busy = false
      schedule(key, reader)
    }
  }

  const rescheduleAll = (): void => {
    for (const [key, reader] of readers) {
      schedule(key, reader)
    }
  }

  const readAllInSight = (): void => {
    for (const [key, reader] of readers) {
      if (
        !reader.busy &&
        inSight(reader) &&
        timers.now() - reader.lastAt >= FOCUS_READ_MIN_GAP_MS
      ) {
        reader.cancel?.()
        reader.cancel = null
        void pull(key, reader)
      }
    }
  }

  return {
    watch: (key, { read, onValue, visible, everyMs = LIVE_READ_MS }) => {
      let reader = readers.get(key)
      if (!reader) {
        reader = {
          views: new Set(),
          everyMs,
          cancel: null,
          busy: false,
          failures: 0,
          lastAt: timers.now(),
          // Why: the first view has just read it, so being in sight now is no news.
          inSight: visible && !page.hidden()
        }
        readers.set(key, reader)
        offPage ??= page.onChange(rescheduleAll)
        offFocus ??= page.onFocus?.(readAllInSight) ?? null
      }
      const own = reader
      const view: View = { read, onValue, visible }
      own.views.add(view)
      schedule(key, own)
      return {
        setVisible: (next) => {
          if (view.visible !== next) {
            view.visible = next
            schedule(key, own)
          }
        },
        stop: () => {
          if (!own.views.delete(view)) {
            return
          }
          if (own.views.size > 0) {
            schedule(key, own)
            return
          }
          own.cancel?.()
          readers.delete(key)
          if (readers.size === 0) {
            offPage?.()
            offPage = null
            offFocus?.()
            offFocus = null
          }
        }
      }
    }
  }
}
