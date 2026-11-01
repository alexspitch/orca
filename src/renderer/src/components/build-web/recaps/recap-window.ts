import type { BuildWebRecap } from '../../../../../shared/build-web-recap-types'

// Where a report stands in time, and the window of commits it covers (IS-342).

/** Its window's end, else when it finished: an older host sends only `finished_at`. */
export function recapReportedAt(recap: BuildWebRecap): string {
  return recap.reported_at || recap.finished_at
}

/** The window as local dates, as in `19.09 – 26.09`; '' for a run without one. */
export function recapWindowLabel(recap: BuildWebRecap): string {
  const from = new Date(recap.report_from ?? '')
  const to = new Date(recap.report_to ?? '')
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return ''
  }
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit' }).formatRange(
    from,
    to
  )
}
