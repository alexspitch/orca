import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { BuildWebRecap } from '../../../../../shared/build-web-recap-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { ProductChip } from '../BuildWebToneChip'
import { useBuildWebPageEscape } from '../use-build-web-page-escape'
import {
  calendarWeeks,
  dayKey,
  localeFirstDay,
  monthOf,
  recapsByDay,
  sameMonth,
  shiftMonth,
  type RecapMonth
} from './recap-calendar'
import { RecapReportPane } from './RecapReportPane'

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

function recapTitle(recap: BuildWebRecap): string {
  return [recap.name, recap.version?.name, new Date(recap.finished_at).toLocaleString()]
    .filter(Boolean)
    .join(' · ')
}

/** The month header: the month's name, a step back and forward, and a way back to this month. */
export function RecapMonthNav({
  month,
  today,
  loading,
  onMonth
}: {
  month: RecapMonth
  /** Read once by the owner: a render must not ask the clock. */
  today: Date
  loading: boolean
  onMonth: (month: RecapMonth) => void
}): React.JSX.Element {
  const thisMonth = monthOf(today)
  const title = new Date(month.year, month.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  })
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={translate('buildWeb.recaps.previousMonth', 'Previous month')}
        onClick={() => onMonth(shiftMonth(month, -1))}
      >
        <ChevronLeft />
      </Button>
      <h2 className="w-44 text-center text-sm font-semibold capitalize" aria-live="polite">
        {title}
      </h2>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={translate('buildWeb.recaps.nextMonth', 'Next month')}
        onClick={() => onMonth(shiftMonth(month, 1))}
      >
        <ChevronRight />
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={sameMonth(month, thisMonth)}
        onClick={() => onMonth(thisMonth)}
      >
        {translate('buildWeb.recaps.thisMonth', 'This month')}
      </Button>
      {loading ? (
        <span className="ml-2 text-xs text-muted-foreground">
          {translate('buildWeb.recaps.loading', 'Loading the reports…')}
        </span>
      ) : null}
    </div>
  )
}

/** The month as a grid of days; each day lists the reports that finished on it. */
export function RecapCalendar({
  month,
  today,
  recaps,
  onOpen
}: {
  month: RecapMonth
  today: Date
  recaps: readonly BuildWebRecap[]
  onOpen: (recap: BuildWebRecap) => void
}): React.JSX.Element {
  const weeks = useMemo(() => calendarWeeks(month, localeFirstDay(navigator.language)), [month])
  const byDay = useMemo(() => recapsByDay(recaps), [recaps])
  const todayKey = dayKey(today)
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border">
      <div className="grid grid-cols-7 border-b border-border">
        {weeks[0].map((day) => (
          <div
            key={day.getDay()}
            className="px-2 py-1.5 text-2xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {day.toLocaleDateString(undefined, { weekday: 'short' })}
          </div>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {weeks.map((week) => (
          <div
            key={dayKey(week[0])}
            className="grid min-h-0 flex-1 grid-cols-7 border-b border-border last:border-b-0"
          >
            {week.map((day) => {
              const key = dayKey(day)
              const inMonth = day.getMonth() === month.month
              const reports = inMonth ? (byDay.get(key) ?? []) : []
              return (
                <div
                  key={key}
                  className={cn(
                    'flex min-h-0 min-w-0 flex-col gap-0.5 border-r border-border p-1 last:border-r-0',
                    !inMonth && 'bg-muted/30'
                  )}
                >
                  <span
                    className={cn(
                      'self-start rounded-full px-1.5 text-xs tabular-nums',
                      inMonth ? 'text-foreground' : 'text-muted-foreground',
                      key === todayKey && 'bg-foreground font-semibold text-background'
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <ul className="scrollbar-sleek flex min-h-0 flex-1 flex-col gap-px overflow-y-auto">
                    {reports.map((recap) => (
                      <li key={recap.id}>
                        <button
                          type="button"
                          title={recapTitle(recap)}
                          onClick={() => onOpen(recap)}
                          className="flex w-full min-w-0 items-center gap-1 rounded-sm px-1 py-0.5 text-left text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          <ProductChip product={recap.product} />
                          <span className="min-w-0 flex-1 truncate">{recap.name}</span>
                          <span className="shrink-0 text-2xs text-muted-foreground tabular-nums">
                            {timeOf(recap.finished_at)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/** A report opened from the calendar, over it; Back or Escape returns to the same month. */
export function RecapCalendarReport({
  target,
  contextKey,
  recap,
  onBack
}: {
  target: RuntimeClientTarget
  contextKey: string
  recap: BuildWebRecap
  onBack: () => void
}): React.JSX.Element {
  useBuildWebPageEscape(onBack, { first: true })
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border">
      <div className="flex min-w-0 items-center gap-2 border-b border-border px-2 py-1.5">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft />
          {translate('buildWeb.recaps.backToCalendar', 'Calendar')}
        </Button>
        <ProductChip product={recap.product} />
        <span className="min-w-0 truncate text-sm font-medium">{recap.name}</span>
        {recap.version ? (
          <span className="shrink-0 text-xs text-muted-foreground">{recap.version.name}</span>
        ) : null}
        <div className="flex-1" />
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {new Date(recap.finished_at).toLocaleString()}
        </span>
      </div>
      <section className="flex min-h-0 flex-1 flex-col">
        <RecapReportPane target={target} contextKey={contextKey} recap={recap} />
      </section>
    </div>
  )
}
