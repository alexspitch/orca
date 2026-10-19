import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { BuildWebTestRun } from '../../../../../../shared/build-web-test-history-types'
import { TEST_RUN_KINDS, type TestRunKind } from '../testing-view-prefs'
import { TestStatusMark } from './test-marks'
import { runCommit, runDays, runPlace, runTitle, summarize } from './test-run-rows'

// Why a portion: rows are revealed as the list scrolls, not all of them drawn at once.
const PORTION = 20

const KIND_LABEL: Record<TestRunKind, () => string> = {
  all: () => translate('buildWeb.testHistory.kind.all', 'All'),
  nightly: () => translate('buildWeb.testHistory.kind.nightly', 'Nightly'),
  manual: () => translate('buildWeb.testHistory.kind.manual', 'Manual')
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(getIntlLocale(), { hour: '2-digit', minute: '2-digit' })

function RunRow({
  run,
  current,
  onSelect
}: {
  run: BuildWebTestRun
  current: boolean
  onSelect: (id: string) => void
}): React.JSX.Element {
  const { title, sub } = runTitle(run)
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(run.id)}
        aria-current={current ? 'true' : undefined}
        className={cn(
          'flex w-full flex-col gap-0.5 border-b border-border/60 px-3 py-1.5 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
          current && 'bg-accent'
        )}
      >
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium" title={title}>
            {title}
          </span>
          <TestStatusMark status={run.status} />
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {sub} · {summarize(run)}
        </span>
        <span className="truncate font-mono text-2xs text-muted-foreground">
          {timeOf(run.created_at)} · {runPlace(run)} · {runCommit(run)} · {run.id.slice(0, 8)}
        </span>
      </button>
    </li>
  )
}

/** The runs, newest first by day, narrowed to nightly or manual ones; rows come in as it scrolls. */
export function TestRunList({
  runs,
  total,
  kind,
  onKind,
  selectedId,
  onSelect,
  loading,
  onReload
}: {
  runs: BuildWebTestRun[]
  /** Every run the console sent, before the kind filter. */
  total: number
  kind: TestRunKind
  onKind: (kind: TestRunKind) => void
  selectedId: string | null
  onSelect: (id: string) => void
  loading: boolean
  onReload: () => void
}): React.JSX.Element {
  const [shown, setShown] = useState(PORTION)
  const scroller = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setShown(PORTION)
    scroller.current?.scrollTo({ top: 0 })
  }, [kind])
  const more = shown < runs.length
  useEffect(() => {
    const end = sentinel.current
    if (!more || !end) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown((n) => n + PORTION)
        }
      },
      // Why a margin: the next rows arrive before the end of the list is reached.
      { root: scroller.current, rootMargin: '0px 0px 200px 0px' }
    )
    observer.observe(end)
    return () => observer.disconnect()
  }, [more, shown])
  const days = useMemo(() => runDays(runs.slice(0, shown), getIntlLocale()), [runs, shown])

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={kind}
          // Why the guard: a single toggle group lets the pressed item be clicked off.
          onValueChange={(next) => {
            const picked = TEST_RUN_KINDS.find((k) => k === next)
            if (picked) {
              onKind(picked)
            }
          }}
          aria-label={translate('buildWeb.testHistory.kindLabel', 'Which runs')}
        >
          {TEST_RUN_KINDS.map((k) => (
            <ToggleGroupItem key={k} value={k}>
              {KIND_LABEL[k]()}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground tabular-nums">
          {translate('buildWeb.testHistory.runCount', '{{count}} run(s)', { count: runs.length })}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onReload}
          disabled={loading}
          aria-label={translate('buildWeb.testHistory.reload', 'Read the runs again')}
        >
          <RefreshCw className={cn(loading && 'animate-spin')} />
        </Button>
      </div>
      <div ref={scroller} className="scrollbar-sleek min-h-0 flex-1 overflow-auto">
        {days.map((day) => (
          <div key={day.label}>
            <h3 className="sticky top-0 z-10 border-b border-border/60 bg-background px-3 pt-2 pb-1 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
              {day.label}
            </h3>
            <ul>
              {day.runs.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  current={run.id === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </div>
        ))}
        {runs.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">
            {translate('buildWeb.testHistory.noneOfKind', 'No runs of this kind.')}
          </p>
        ) : more ? (
          <div ref={sentinel} className="h-8" />
        ) : (
          <p className="p-3 text-center text-2xs text-muted-foreground">
            {translate(
              'buildWeb.testHistory.listEnd',
              'End of the list: build-web sends its newest {{total}} runs.',
              { total }
            )}
          </p>
        )}
      </div>
    </section>
  )
}
