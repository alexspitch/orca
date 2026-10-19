import type { BuildWebRecap } from '../../../../../shared/build-web-recap-types'

// The Recaps calendar: a month as weeks of local days, and the reports laid out on the day they
// finished.

export type RecapMonth = { year: number; month: number }

export function monthOf(date: Date): RecapMonth {
  return { year: date.getFullYear(), month: date.getMonth() }
}

export function shiftMonth(m: RecapMonth, delta: number): RecapMonth {
  return monthOf(new Date(m.year, m.month + delta, 1))
}

export function sameMonth(a: RecapMonth, b: RecapMonth): boolean {
  return a.year === b.year && a.month === b.month
}

/** The month as a query range: local midnight of its first day up to that of the next month's. */
export function monthRangeIso(m: RecapMonth): { from: string; to: string } {
  return {
    from: new Date(m.year, m.month, 1).toISOString(),
    to: new Date(m.year, m.month + 1, 1).toISOString()
  }
}

/** A local day as `YYYY-MM-DD`, the key reports are grouped by. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Whole weeks covering the month, each from `firstDay` (0 Sunday … 6 Saturday): the days of the
 * neighbouring months fill the first and last week.
 */
export function calendarWeeks(m: RecapMonth, firstDay: number): Date[][] {
  const first = new Date(m.year, m.month, 1)
  const lead = (first.getDay() - firstDay + 7) % 7
  const daysInMonth = new Date(m.year, m.month + 1, 0).getDate()
  const weeks = Math.ceil((lead + daysInMonth) / 7)
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => new Date(m.year, m.month, 1 - lead + w * 7 + d))
  )
}

/** The reports by the local day they finished, each day's in the order they finished. */
export function recapsByDay(recaps: readonly BuildWebRecap[]): Map<string, BuildWebRecap[]> {
  const byDay = new Map<string, BuildWebRecap[]>()
  for (const recap of recaps) {
    const finished = new Date(recap.finished_at)
    if (Number.isNaN(finished.getTime())) {
      continue
    }
    const key = dayKey(finished)
    byDay.set(key, [...(byDay.get(key) ?? []), recap])
  }
  for (const day of byDay.values()) {
    day.sort((a, b) => a.finished_at.localeCompare(b.finished_at))
  }
  return byDay
}

/** The locale's first day of the week; Monday where the runtime cannot say. */
export function localeFirstDay(locale: string): number {
  try {
    const info = new Intl.Locale(locale)
    // Why both: `getWeekInfo()` is the standard, `weekInfo` the older Chromium accessor.
    const week: unknown =
      'getWeekInfo' in info && typeof info.getWeekInfo === 'function'
        ? info.getWeekInfo()
        : 'weekInfo' in info
          ? info.weekInfo
          : null
    const firstDay =
      typeof week === 'object' && week !== null && 'firstDay' in week ? week.firstDay : null
    // Intl counts 1 Monday … 7 Sunday.
    return typeof firstDay === 'number' ? firstDay % 7 : 1
  } catch {
    return 1
  }
}
