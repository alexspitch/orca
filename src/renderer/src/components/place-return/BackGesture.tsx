import { useEffect } from 'react'
import { canGoBack, goBack } from './place-return'
import { startPlaceRecording } from './place-return-recording'

// Back to the place before the last move: two fingers moving right on a trackpad, as in Safari
// (horizontal wheel past the left edge), or the mouse's back button.

const BACK_DISTANCE = 120
// Why: a gesture's momentum keeps sending wheel events; a pause this long starts a new one.
const GESTURE_GAP_MS = 250
const MOUSE_BACK_BUTTON = 3

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

/** Records where the user goes and goes back on a swipe right or the mouse's back button. */
export function BackGesture(): null {
  useEffect(() => startPlaceRecording(), [])
  useEffect(() => {
    let travelled = 0
    let lastAt = 0
    let spent = false
    const onWheel = (event: WheelEvent): void => {
      const now = event.timeStamp
      if (now - lastAt > GESTURE_GAP_MS) {
        travelled = 0
        spent = false
      }
      lastAt = now
      // Why ctrlKey: a pinch arrives as a wheel event with it set.
      if (spent || event.ctrlKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
        return
      }
      // Why for the rest of the gesture: momentum carries a scroll past the left edge.
      if (canScrollLeft(event.target)) {
        spent = true
        return
      }
      if (!canGoBack()) {
        travelled = 0
        return
      }
      travelled += event.deltaX
      if (travelled <= -BACK_DISTANCE) {
        spent = true
        goBack()
      }
    }
    // Why the press too: the paired web client's browser would also step its own history.
    const onMouseDown = (event: MouseEvent): void => {
      if (event.button === MOUSE_BACK_BUTTON && !event.defaultPrevented && canGoBack()) {
        event.preventDefault()
      }
    }
    // Why defaultPrevented: the editor and a remote browser page step their own history with it.
    const onMouseUp = (event: MouseEvent): void => {
      if (event.button !== MOUSE_BACK_BUTTON || event.defaultPrevented || !canGoBack()) {
        return
      }
      event.preventDefault()
      goBack()
    }
    window.addEventListener('wheel', onWheel, { capture: true, passive: true })
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('wheel', onWheel, { capture: true })
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])
  return null
}
