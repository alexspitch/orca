import { Fragment, useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PaginationBar } from '@/components/task-page/PaginationBar'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { BuildWebTrain, BuildWebTrainRun } from '../../../../../shared/build-web-train-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { useBuildLogViewer } from '../images/build-log-viewer'
import { buildsInFlight, isWindowOver, ticketsSummary, windowSummary } from './train-window'
import { TrainWindowDetails } from './TrainWindowDetails'
import { trainRunTone } from './train-tones'

const PAGE = 25
// How often the history is read again while one of its windows is still going.
const LIVE_POLL_MS = 4000
const when = (iso: string) => new Date(iso).toLocaleString()
const GRID =
  'grid grid-cols-[32px_170px_110px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)] items-center gap-x-3'

/** One train's windows, newest first; the windows that did nothing are folded away by default. */
export function TrainHistory({
  target,
  train,
  reloadKey,
  onOpenIssue
}: {
  target: RuntimeClientTarget
  train: BuildWebTrain
  /** Bumped by a departure by hand, so the history reads it at once. */
  reloadKey: number
  onOpenIssue: (id: string) => void
}): React.JSX.Element {
  const [runs, setRuns] = useState<BuildWebTrainRun[]>([])
  const [total, setTotal] = useState(0)
  const [empty, setEmpty] = useState(0)
  const [showEmpty, setShowEmpty] = useState(false)
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const answer = await callBuildWeb(target, 'trainRuns', {
        trainId: train.id,
        limit: PAGE,
        offset: page * PAGE,
        withActions: !showEmpty
      })
      setRuns(answer.runs)
      setTotal(answer.total)
      setEmpty(answer.empty)
      setError(null)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadKey asks for a fresh read.
  }, [page, reloadKey, showEmpty, target, train.id])
  useEffect(() => {
    void load()
  }, [load])

  // A window that has not ended changes on its own: its builds start and finish, it deploys.
  const going = runs.some((r) => !isWindowOver(r))
  useEffect(() => {
    if (!going) {
      return
    }
    const timer = window.setInterval(() => void load(), LIVE_POLL_MS)
    return () => window.clearInterval(timer)
  }, [going, load])

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">
          {translate('buildWeb.trains.history', 'History — {{name}}', { name: train.name })}
        </h2>
        <div className="flex-1" />
        {empty > 0 || showEmpty ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setShowEmpty((v) => !v)
              setPage(0)
            }}
          >
            {showEmpty
              ? translate('buildWeb.trains.hideEmpty', 'Hide empty windows')
              : translate('buildWeb.trains.showEmpty', 'Show {{n}} empty windows', {
                  n: String(empty)
                })}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={loading}
          aria-label={translate('buildWeb.page.refresh', 'Refresh')}
          onClick={() => void load()}
        >
          <RefreshCw />
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-auto rounded-md border border-border">
        <div className="min-w-[860px] text-sm">
          <div
            className={`${GRID} sticky top-0 z-10 min-h-8 border-b border-border bg-muted px-2 text-2xs font-semibold tracking-wide text-muted-foreground uppercase`}
          >
            <span />
            <span>{translate('buildWeb.trains.window', 'Window')}</span>
            <span>{translate('buildWeb.trains.status', 'Status')}</span>
            <span>{translate('buildWeb.trains.images', 'Images')}</span>
            <span>{translate('buildWeb.trains.tasks', 'Tasks')}</span>
            <span>{translate('buildWeb.trains.reason', 'Reason')}</span>
          </div>
          {runs.map((r) => (
            <Fragment key={r.id}>
              <div
                className={cn(
                  GRID,
                  'min-h-10 border-b border-border/60 px-2',
                  r.status === 'failed' && 'bg-destructive/5'
                )}
              >
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-expanded={open === r.id}
                  aria-label={translate(
                    'buildWeb.trains.whatHappened',
                    'What happened in this window'
                  )}
                  onClick={() => setOpen(open === r.id ? null : r.id)}
                >
                  {open === r.id ? <ChevronDown /> : <ChevronRight />}
                </Button>
                <span className="font-mono text-xs">{when(r.window_at)}</span>
                <span>
                  <BuildWebToneChip label={r.status} tone={trainRunTone(r.status)} />
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn('truncate', r.problems > 0 && 'text-destructive')}
                    title={r.images.map((i) => `${i.image} (${i.dist})`).join('\n')}
                  >
                    {windowSummary(r)}
                  </span>
                  {buildsInFlight(r.live_builds).map((b) =>
                    b.build_url ? (
                      <button
                        key={`${b.image}|${b.dist}`}
                        type="button"
                        className="text-xs text-primary hover:underline"
                        title={`${b.image} (${b.dist})`}
                        onClick={() =>
                          b.build_url &&
                          useBuildLogViewer
                            .getState()
                            .show(b.build_url, `${b.image} (${b.dist}) #${b.build_number ?? ''}`)
                        }
                      >
                        #{b.build_number ?? '…'}
                      </button>
                    ) : null
                  )}
                </span>
                <span className="truncate text-xs">{ticketsSummary(r)}</span>
                <span
                  className={cn(
                    'truncate text-xs',
                    r.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'
                  )}
                  title={r.error ?? undefined}
                >
                  {r.error ?? ''}
                </span>
              </div>
              {open === r.id ? (
                <div className="border-b border-border bg-muted/30">
                  <TrainWindowDetails
                    target={target}
                    trainId={train.id}
                    run={r}
                    onOpenIssue={onOpenIssue}
                  />
                </div>
              ) : null}
            </Fragment>
          ))}
          {runs.length === 0 && !loading ? (
            <p className="p-3 text-xs text-muted-foreground">
              {total > 0
                ? translate('buildWeb.trains.emptyPage', 'Nothing on this page')
                : empty > 0
                  ? translate(
                      'buildWeb.trains.onlyEmpty',
                      'The train ran {{n}} times but had nothing to do',
                      { n: String(empty) }
                    )
                  : translate('buildWeb.trains.neverRan', 'The train has not run yet')}
            </p>
          ) : null}
        </div>
      </div>
      {total > PAGE ? (
        <PaginationBar
          currentPage={page}
          totalPages={Math.ceil(total / PAGE)}
          loadingTarget={loading ? page : null}
          onPageChange={setPage}
        />
      ) : null}
    </section>
  )
}
