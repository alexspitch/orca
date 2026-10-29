import { getVirtualRowKey } from '../viewport/virtual-rows'
import { USER_SCROLL_MEASUREMENT_ADJUSTMENT_SUPPRESS_MS } from '../viewport/use-scroll-suppression'

// IS-147: ↑/↓ in compact mode opens the newly selected row and closes the previous one. Keyboard
// input suspends the virtualizer's size correction, so the scroll holds the selected row where it
// stood when it was chosen until the swap settles.

export type PinnedRowGeometry = {
  scrollTop: number
  /** The row's top and height now, relative to the viewport's top. */
  rowTop: number
  rowHeight: number
  /** Where the row's top stood when it was selected. */
  pinnedTop: number
  viewportHeight: number
  /** The sticky group header's band; a row top above it is hidden. */
  topInset: number
  maxScrollTop: number
}

/** The scrollTop that puts the row back at its pinned top, then shows its bottom if it now overflows. */
export function pinnedRowScrollTop(geometry: PinnedRowGeometry): number {
  const { scrollTop, rowTop, rowHeight, pinnedTop, viewportHeight, topInset, maxScrollTop } =
    geometry
  let next = scrollTop + (rowTop - pinnedTop)
  const overflow = pinnedTop + rowHeight - viewportHeight
  if (overflow > 0) {
    // Why the cap: a row taller than the viewport keeps its title in view.
    next += Math.min(overflow, Math.max(0, pinnedTop - topInset))
  }
  return Math.min(Math.max(next, 0), Math.max(maxScrollTop, 0))
}

function findRow(scroller: HTMLElement, rowKey: string): HTMLElement | null {
  for (const row of scroller.querySelectorAll<HTMLElement>('[data-worktree-virtual-row]')) {
    if (getVirtualRowKey(row) === rowKey) {
      return row
    }
  }
  return null
}

function rowTopIn(scroller: HTMLElement, row: HTMLElement): number {
  return row.getBoundingClientRect().top - scroller.getBoundingClientRect().top
}

const USER_SCROLL_EVENTS = ['wheel', 'touchmove', 'pointerdown'] as const

/** One pin at a time: a new selection replaces it, and the user's own scrolling ends it. */
export function createSelectedRowPin(): {
  pin: (scroller: HTMLElement, rowKey: string, topInset: number) => void
  cancel: () => void
} {
  let stop: (() => void) | null = null
  const cancel = (): void => {
    stop?.()
    stop = null
  }
  const pin = (scroller: HTMLElement, rowKey: string, topInset: number): void => {
    cancel()
    const row = findRow(scroller, rowKey)
    // Why skip an unmounted row: the virtualizer's own scroll brings it in.
    if (!row) {
      return
    }
    const pinnedTop = rowTopIn(scroller, row)
    const deadline = performance.now() + USER_SCROLL_MEASUREMENT_ADJUSTMENT_SUPPRESS_MS
    let frame = 0
    const step = (): void => {
      const current = findRow(scroller, rowKey)
      if (current) {
        const next = pinnedRowScrollTop({
          scrollTop: scroller.scrollTop,
          rowTop: rowTopIn(scroller, current),
          rowHeight: current.getBoundingClientRect().height,
          pinnedTop,
          viewportHeight: scroller.clientHeight,
          topInset,
          maxScrollTop: scroller.scrollHeight - scroller.clientHeight
        })
        if (Math.abs(next - scroller.scrollTop) >= 1) {
          scroller.scrollTop = next
        }
      }
      if (performance.now() < deadline) {
        frame = requestAnimationFrame(step)
      } else {
        cancel()
      }
    }
    for (const type of USER_SCROLL_EVENTS) {
      scroller.addEventListener(type, cancel, { passive: true })
    }
    stop = () => {
      cancelAnimationFrame(frame)
      for (const type of USER_SCROLL_EVENTS) {
        scroller.removeEventListener(type, cancel)
      }
    }
    frame = requestAnimationFrame(step)
  }
  return { pin, cancel }
}
