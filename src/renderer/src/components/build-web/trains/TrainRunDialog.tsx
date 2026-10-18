import { useEffect, useRef, useState } from 'react'
import { ExternalLink, List, Loader2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type {
  BuildWebTrain,
  BuildWebTrainAction,
  BuildWebTrainRun
} from '../../../../../shared/build-web-train-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { BuildWebToneChip } from '../BuildWebToneChip'
import type { ChipTone } from '../build-web-tones'
import {
  isProblem,
  ticketsSummary,
  windowReport,
  windowSummary,
  type WindowTicket
} from './train-window'
import { trainActionLine } from './train-action-line'
import { trainRunTone } from './train-tones'
import { TrainRunImages } from './TrainRunImages'

const hhmm = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

/** A task that stayed where it was is amber: nothing broke, but it did not move. */
function ticketTone(t: WindowTicket): ChipTone {
  if (t.problem) {
    return 'red'
  }
  switch (t.outcome) {
    case 'moved':
      return 'green'
    case 'delivered':
      return 'blue'
    case 'failed':
      return 'red'
    case 'skipped':
    case 'pending':
      return 'amber'
  }
}

function SectionTitle({ title, n, danger }: { title: string; n?: number; danger?: boolean }) {
  return (
    <h3 className="flex items-center gap-2 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
      {title}
      {n !== undefined ? (
        <span
          className={cn(
            'rounded-full px-1.5 leading-[18px] tabular-nums',
            danger ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
          )}
        >
          {n}
        </span>
      ) : null}
    </h3>
  )
}

/** What one window did, after build-web's «Прогон …» dialog: errors, images, tasks, journal. */
export function TrainRunDialog({
  target,
  train,
  run,
  onClose,
  onOpenIssue
}: {
  target: RuntimeClientTarget
  train: BuildWebTrain
  run: BuildWebTrainRun
  onClose: () => void
  onOpenIssue: (id: string) => void
}): React.JSX.Element {
  const [actions, setActions] = useState<BuildWebTrainAction[] | null>(null)
  const [journal, setJournal] = useState(false)
  const journalRef = useRef<HTMLElement>(null)

  // The history is read again while a window is going; the journal follows each new read.
  useEffect(() => {
    let alive = true
    void callBuildWeb(target, 'trainActions', { trainId: train.id, runId: run.id }).then(
      (next) => alive && setActions(next),
      () => alive && setActions([])
    )
    return () => {
      alive = false
    }
  }, [run.id, run.updated_at, run.live_builds.length, target, train.id])

  // Why: the journal opens below everything else; bring it into view rather than leave it unseen.
  useEffect(() => {
    if (journal) {
      journalRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [journal])

  const report = actions ? windowReport(run, actions) : null
  // A task left in place for a routine reason is noise here; it stays in the journal.
  const tickets = report ? report.tickets.filter((t) => t.outcome !== 'skipped' || t.buildTask) : []
  const skipped = report ? report.tickets.length - tickets.length : 0
  const at = new Date(run.window_at)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-3">
            <DialogTitle>
              {translate('buildWeb.trains.runOf', 'Run {{date}}', {
                date: at.toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })
              })}
              <span className="ml-2.5 font-mono text-base font-medium text-muted-foreground">
                {at.toLocaleTimeString()}
              </span>
            </DialogTitle>
            <BuildWebToneChip label={run.status} tone={trainRunTone(run.status)} />
          </div>
          <DialogDescription>
            <span className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-semibold text-foreground">{train.name}</span>
              <span aria-hidden>·</span>
              <span className="font-mono text-xs">{train.branch}</span>
              <span aria-hidden>·</span>
              <span>
                {translate('buildWeb.trains.onStand', 'stand {{stand}}', {
                  stand: train.stand_name
                })}
              </span>
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 overflow-hidden rounded-md border border-border bg-muted/40 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5 px-4 py-3 sm:border-r sm:border-border">
            <span className="text-xs text-muted-foreground">
              {translate('buildWeb.trains.images', 'Images')}
            </span>
            <span className="text-sm font-medium">
              {windowSummary({ ...run, problems: 0 })}
              {run.problems > 0 ? (
                <span className="text-destructive">
                  {' · '}
                  {translate('buildWeb.trains.errorsCount', 'errors {{n}}', {
                    n: String(run.problems)
                  })}
                </span>
              ) : null}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {translate('buildWeb.trains.tasks', 'Tasks')}
            </span>
            <span className="text-sm font-medium">{ticketsSummary(run)}</span>
          </div>
        </div>
        <div className="scrollbar-sleek flex max-h-[60vh] min-h-0 flex-col gap-5 overflow-y-auto pr-1">
          {!report ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : null}
          {report && report.problems.length > 0 ? (
            <section className="flex flex-col gap-2">
              <SectionTitle
                title={translate('buildWeb.trains.errorsTitle', 'Errors')}
                n={report.problems.length}
                danger
              />
              {report.problems.map((p, n) => (
                <div
                  key={`${p.at ?? ''}-${n}`}
                  className="flex items-start gap-3 rounded-md border border-destructive/35 bg-destructive/5 px-4 py-3"
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                  <span className="min-w-0 flex-1 text-sm break-words">{p.text}</span>
                  {p.at ? (
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {hhmm(p.at)}
                    </span>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}
          {report ? (
            <section className="flex flex-col gap-2">
              <SectionTitle
                title={translate('buildWeb.trains.images', 'Images')}
                n={report.images.length}
              />
              <TrainRunImages images={report.images} />
            </section>
          ) : null}
          {report ? (
            <section className="flex flex-col gap-2">
              <SectionTitle
                title={translate('buildWeb.trains.tasks', 'Tasks')}
                n={tickets.length}
              />
              {tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {translate('buildWeb.trains.noneMoved', 'no task moved')}
                </p>
              ) : null}
              {tickets.map((t) => {
                const tone = ticketTone(t)
                return (
                  <div
                    key={t.key}
                    className="flex items-start gap-3 rounded-md border border-border px-4 py-3"
                  >
                    <BuildWebToneChip label={t.label} tone={tone} />
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-baseline gap-x-2.5">
                        {t.issueId ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-primary hover:underline"
                            onClick={() => t.issueId && onOpenIssue(t.issueId)}
                          >
                            {t.key}
                            <ExternalLink className="size-3" aria-hidden />
                          </button>
                        ) : (
                          <span className="font-mono text-sm font-semibold">{t.key}</span>
                        )}
                        {t.summary ? (
                          <span className="text-sm font-medium">{t.summary}</span>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          'text-sm',
                          tone === 'red' ? 'text-destructive' : 'text-muted-foreground'
                        )}
                      >
                        {t.line}
                      </span>
                      {t.buildTask ? (
                        <span className="text-xs text-muted-foreground">{t.buildTask}</span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
              {skipped > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {translate(
                    'buildWeb.trains.moreLeft',
                    '{{n}} more tasks left in place — the reasons are in the journal',
                    { n: String(skipped) }
                  )}
                </p>
              ) : null}
            </section>
          ) : null}
          {report && report.other.length > 0 ? (
            <section className="flex flex-col gap-1.5">
              <SectionTitle
                title={translate('buildWeb.trains.publishing', 'Publishing and the stand')}
                n={report.other.length}
              />
              {report.other.map((line, n) => (
                <span key={`${n}-${line}`} className="text-sm">
                  {line}
                </span>
              ))}
            </section>
          ) : null}
          {journal && actions ? (
            <section ref={journalRef} className="flex flex-col gap-1.5">
              <SectionTitle
                title={translate('buildWeb.trains.journalTitle', 'Journal')}
                n={actions.length}
              />
              {actions.toReversed().map((a) => (
                <div key={a.id} className="flex gap-2 text-sm">
                  <span className="w-32 shrink-0 font-mono text-xs leading-5 text-muted-foreground">
                    {hhmm(a.at)}
                  </span>
                  <span className={isProblem(a) ? 'text-destructive' : undefined}>
                    {trainActionLine(a)}
                  </span>
                </div>
              ))}
            </section>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={!actions}
            onClick={() => setJournal((v) => !v)}
          >
            <List />
            {journal
              ? translate('buildWeb.trains.hideJournal', 'Hide the journal')
              : translate('buildWeb.trains.journal', 'Whole journal ({{n}})', {
                  n: String(actions?.length ?? 0)
                })}
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            {translate('buildWeb.trains.close', 'Close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
