import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebTrainAction,
  BuildWebTrainRun
} from '../../../../../shared/build-web-train-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { BuildWebToneChip } from '../BuildWebToneChip'
import type { ChipTone } from '../build-web-tones'
import { useBuildLogViewer } from '../images/build-log-viewer'
import { isProblem, windowReport, type WindowImageState, type WindowTicket } from './train-window'
import { trainActionLine } from './train-action-line'

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : ''

function imageChip(state: WindowImageState): { label: string; tone: ChipTone | null } {
  switch (state) {
    case 'built':
      return { label: translate('buildWeb.trains.imageBuilt', 'built'), tone: 'green' }
    case 'building':
      return { label: translate('buildWeb.trains.imageBuilding', 'building'), tone: 'blue' }
    case 'failed':
      return { label: translate('buildWeb.trains.imageFailed', 'failed'), tone: 'red' }
    case 'aborted':
      return { label: translate('buildWeb.trains.imageAborted', 'aborted'), tone: 'amber' }
    case 'kept':
      return { label: translate('buildWeb.trains.imageKept', 'not rebuilt'), tone: 'neutral' }
    case 'waiting':
      return { label: translate('buildWeb.trains.imageWaiting', 'not built'), tone: null }
  }
}

function ticketTone(t: WindowTicket): ChipTone | null {
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
      return null
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h4>
      {children}
    </div>
  )
}

/** What one window did: its images, its tasks, its errors, and the whole journal on request. */
export function TrainWindowDetails({
  target,
  trainId,
  run,
  onOpenIssue
}: {
  target: RuntimeClientTarget
  trainId: string
  run: BuildWebTrainRun
  onOpenIssue: (id: string) => void
}): React.JSX.Element {
  const [actions, setActions] = useState<BuildWebTrainAction[] | null>(null)
  const [journal, setJournal] = useState(false)

  // The history is read again while a window is going; the journal follows each new read.
  useEffect(() => {
    let alive = true
    void callBuildWeb(target, 'trainActions', { trainId, runId: run.id }).then(
      (next) => alive && setActions(next),
      () => alive && setActions([])
    )
    return () => {
      alive = false
    }
  }, [run.id, run.updated_at, run.live_builds.length, target, trainId])

  if (!actions) {
    return <Loader2 className="m-2 size-4 animate-spin text-muted-foreground" />
  }
  const report = windowReport(run, actions)
  // A task left in place for a routine reason is noise here; it stays in the journal.
  const tickets = report.tickets.filter((t) => t.outcome !== 'skipped' || t.buildTask)
  const skipped = report.tickets.length - tickets.length
  const showLog = (url: string, title: string) => useBuildLogViewer.getState().show(url, title)

  return (
    <div className="flex flex-col gap-3 px-4 py-3 text-xs">
      {report.problems.length > 0 ? (
        <Section
          title={translate('buildWeb.trains.errors', 'Errors ({{n}})', {
            n: String(report.problems.length)
          })}
        >
          {report.problems.map((p, n) => (
            <div key={`${p.at ?? ''}-${n}`} className="flex gap-2">
              <span className="w-28 shrink-0 font-mono text-muted-foreground">{when(p.at)}</span>
              <span className="text-destructive">{p.text}</span>
            </div>
          ))}
        </Section>
      ) : null}
      <Section title={translate('buildWeb.trains.images', 'Images')}>
        {report.images.length === 0 ? (
          <span className="text-muted-foreground">
            {translate('buildWeb.trains.nothingToBuild', 'nothing to build')}
          </span>
        ) : null}
        {report.images.map((i) => {
          const chip = imageChip(i.state)
          return (
            <div key={i.target} className="flex min-w-0 items-center gap-2">
              <span className="w-24 shrink-0">
                <BuildWebToneChip label={chip.label} tone={chip.tone} />
              </span>
              <span className="font-mono">{i.target}</span>
              {i.build_number !== null ? (
                i.build_url ? (
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() =>
                      i.build_url && showLog(i.build_url, `${i.target} #${i.build_number}`)
                    }
                  >
                    #{i.build_number}
                  </button>
                ) : (
                  <span>#{i.build_number}</span>
                )
              ) : null}
              <span className="truncate text-muted-foreground" title={i.tags.join('\n')}>
                {i.tags.length ? i.tags.join(', ') : i.note}
              </span>
            </div>
          )
        })}
      </Section>
      <Section title={translate('buildWeb.trains.tasks', 'Tasks')}>
        {tickets.length === 0 ? (
          <span className="text-muted-foreground">
            {translate('buildWeb.trains.noneMoved', 'no task moved')}
          </span>
        ) : null}
        {tickets.map((t) => (
          <div key={t.key} className="flex flex-col">
            <div className="flex min-w-0 items-center gap-2">
              <span className="w-24 shrink-0">
                <BuildWebToneChip label={t.label} tone={ticketTone(t)} />
              </span>
              {t.issueId ? (
                <button
                  type="button"
                  className="font-mono font-semibold text-primary hover:underline"
                  onClick={() => t.issueId && onOpenIssue(t.issueId)}
                >
                  {t.key}
                </button>
              ) : (
                <span className="font-mono font-semibold">{t.key}</span>
              )}
              <span className={t.problem ? 'text-destructive' : undefined}>{t.line}</span>
            </div>
            {t.summary || t.buildTask ? (
              <span className="pl-26 text-muted-foreground">
                {[t.summary, t.buildTask].filter(Boolean).join(' · ')}
              </span>
            ) : null}
          </div>
        ))}
        {skipped > 0 ? (
          <span className="text-muted-foreground">
            {translate(
              'buildWeb.trains.moreLeft',
              '{{n}} more tasks left in place — the reasons are in the journal',
              {
                n: String(skipped)
              }
            )}
          </span>
        ) : null}
      </Section>
      {report.other.length > 0 ? (
        <Section title={translate('buildWeb.trains.publishing', 'Publishing and the stand')}>
          {report.other.map((line, n) => (
            <span key={`${n}-${line}`}>{line}</span>
          ))}
        </Section>
      ) : null}
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="xs"
          className="self-start"
          onClick={() => setJournal((v) => !v)}
        >
          {journal
            ? translate('buildWeb.trains.hideJournal', 'Hide the journal')
            : translate('buildWeb.trains.journal', 'Whole journal ({{n}})', {
                n: String(actions.length)
              })}
        </Button>
        {journal
          ? actions.toReversed().map((a) => (
              <div key={a.id} className="flex gap-2">
                <span className="w-28 shrink-0 font-mono text-muted-foreground">{when(a.at)}</span>
                <span className={isProblem(a) ? 'text-destructive' : undefined}>
                  {trainActionLine(a)}
                </span>
              </div>
            ))
          : null}
      </div>
    </div>
  )
}
