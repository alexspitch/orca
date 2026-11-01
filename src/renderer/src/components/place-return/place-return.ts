import { useAppStore } from '@/store'
import { placeKey, placeOf } from './place-return-arm'
import { popStep, stepsNewestFirst } from './place-return-steps'
import { close, restorablePlace, restore } from './place-return-restore'
import { adoptNextPlace, flushPlaceRecording } from './place-return-recording'

// Back to where the user was before the last move: a page, a workspace's tab, a task's card. A file
// or task the move opened (by a link, or a task from a list) closes on the way.

/** Somewhere to go back to. */
export function canGoBack(): boolean {
  const now = placeOf(useAppStore.getState())
  return stepsNewestFirst().some((step) => restorablePlace(step.origin, now) !== null)
}

/** Closes what the last move opened, if it opened it, and shows where the move started. */
export function goBack(): boolean {
  flushPlaceRecording()
  const now = placeOf(useAppStore.getState())
  for (let step = popStep(); step; step = popStep()) {
    const origin = restorablePlace(step.origin, now)
    if (!origin) {
      continue
    }
    if (step.close && placeKey(step.target) === placeKey(now)) {
      close(step.close)
    }
    adoptNextPlace()
    restore(origin)
    return true
  }
  return false
}
