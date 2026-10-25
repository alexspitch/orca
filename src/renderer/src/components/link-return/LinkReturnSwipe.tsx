import { useEffect } from 'react'
import { canGoBackFromLink, goBackFromLink } from './link-return'

// Two fingers moving right on a trackpad, as Back in Safari: horizontal wheel past the left edge.

const BACK_DISTANCE = 120
// Why: a gesture's momentum keeps sending wheel events; a pause this long starts a new one.
const GESTURE_GAP_MS = 250

/** Something under the pointer would scroll left instead: the gesture is that scroll. */
function canScrollLeft(target: EventTarget | null): boolean {
  for (let el = target instanceof Element ? target : null; el; el = el.parentElement) {
    // Why the slider: Monaco scrolls by transform and always consumes the wheel.
    if (el.classList.contains('monaco-scrollable-element')) {
      const slider = el.querySelector(':scope > .scrollbar.horizontal > .slider')
      if (slider instanceof HTMLElement && Number.parseFloat(slider.style.left) > 0) {
        return true
      }
    } else if (el.scrollLeft > 0) {
      return true
    }
  }
  return false
}

/** Goes back from a file or task a link opened when two fingers swipe right. */
export function LinkReturnSwipe(): null {
  useEffect(() => {
    let travelled = 0
    let lastAt = 0
    let fired = false
    const onWheel = (event: WheelEvent): void => {
      const now = event.timeStamp
      if (now - lastAt > GESTURE_GAP_MS) {
        travelled = 0
        fired = false
      }
      lastAt = now
      // Why ctrlKey: a pinch arrives as a wheel event with it set.
      if (fired || event.ctrlKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
        return
      }
      if (!canGoBackFromLink() || canScrollLeft(event.target)) {
        travelled = 0
        return
      }
      travelled += event.deltaX
      if (travelled <= -BACK_DISTANCE) {
        fired = true
        goBackFromLink()
      }
    }
    window.addEventListener('wheel', onWheel, { capture: true, passive: true })
    return () => window.removeEventListener('wheel', onWheel, { capture: true })
  }, [])
  return null
}
