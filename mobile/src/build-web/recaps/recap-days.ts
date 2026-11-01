import type { BuildWebRecap } from '../../../../src/shared/build-web-recap-types'
import {
  dayKey,
  recapsByDay
} from '../../../../src/renderer/src/components/build-web/recaps/recap-calendar'
import { recapReportedAt } from '../../../../src/renderer/src/components/build-web/recaps/recap-window'

// SectionList requires the data field; naming it otherwise renders no rows.
export type RecapDay = { key: string; label: string; data: BuildWebRecap[] }

function dayLabel(key: string, now: Date): string {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (key === dayKey(now)) {
    return 'Today'
  }
  if (key === dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) {
    return 'Yesterday'
  }
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    ...(year === now.getFullYear() ? {} : { year: 'numeric' })
  })
}

/** The reports by the local day they stand at, as the desktop's calendar lays them out; newest first. */
export function recapDays(recaps: readonly BuildWebRecap[], now: Date): RecapDay[] {
  const byDay = recapsByDay(recaps)
  return [...byDay.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({
      key,
      label: dayLabel(key, now),
      data: (byDay.get(key) ?? []).toReversed()
    }))
}

/** The time of day a report stands at; its day is the group's. */
export function recapTime(recap: BuildWebRecap): string {
  const at = new Date(recapReportedAt(recap))
  return Number.isNaN(at.getTime())
    ? ''
    : at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
