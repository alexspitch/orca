import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { BuildWebTestCasePoint } from '../../../../../../shared/build-web-test-history-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { durationText } from './run-breakdown'
import { testStatusLabel } from './test-marks'
import { useTestCase } from './use-test-history'

// A test over its last runs, after build-web's case card: two rows of bars answer "has it been like
// this for a while?". A failure is a tall bar and a pass a short one, so the row reads without colour.

const STATUS_BAR: Record<string, string> = {
  passed: 'h-3 bg-chip-tone-green',
  failed: 'h-full bg-chip-tone-red',
  load_error: 'h-full bg-chip-tone-red',
  empty: 'h-full bg-chip-tone-amber',
  timeout: 'h-full bg-chip-tone-amber',
  skipped: 'h-6 bg-chip-tone-neutral',
  cancelled: 'h-6 bg-chip-tone-neutral'
}

const when = (p: BuildWebTestCasePoint) =>
  p.createdAt ? new Date(p.createdAt).toLocaleString(getIntlLocale()) : '?'

function StatusBars({ points }: { points: BuildWebTestCasePoint[] }): React.JSX.Element {
  return (
    <div className="flex h-8 items-end gap-0.5">
      {points.map((p) => (
        <span
          key={p.runId}
          title={`${testStatusLabel(p.status)}${p.retries ? ` · ${translate('buildWeb.testHistory.retries', '{{count}} retry(ies)', { count: p.retries })}` : ''} — ${when(p)}${p.commitSha ? ` · ${p.commitSha.slice(0, 7)}` : ''}`}
          className={cn('w-4 rounded-t-sm', STATUS_BAR[p.status] ?? 'h-6 bg-muted')}
        />
      ))}
    </div>
  )
}

function DurationBars({ points }: { points: BuildWebTestCasePoint[] }): React.JSX.Element {
  const max = Math.max(1, ...points.map((p) => p.durationMs ?? 0))
  return (
    <div className="flex h-8 items-end gap-0.5">
      {points.map((p) => (
        <span
          key={p.runId}
          title={
            p.durationMs == null
              ? translate('buildWeb.testHistory.noDuration', 'no duration recorded')
              : `${durationText(p.durationMs)} — ${when(p)}`
          }
          // Why a sliver and a dashed box: a zero and a missing duration must not look alike.
          className={cn(
            'w-4 rounded-t-sm',
            p.durationMs == null ? 'border border-dashed border-border' : 'bg-muted-foreground/40'
          )}
          style={{
            height: p.durationMs == null ? 2 : Math.max(2, Math.round((p.durationMs / max) * 32))
          }}
        />
      ))}
    </div>
  )
}

/** The card under a run's table for the test picked in it. */
export function TestCaseCard({
  target,
  testKey,
  onClose
}: {
  target: RuntimeClientTarget
  testKey: string
  onClose: () => void
}): React.JSX.Element {
  const { data: card, error } = useTestCase(target, testKey)
  const runs = card?.points.length ?? 0
  return (
    <section className="shrink-0 rounded-md border border-border px-3 py-2">
      <div className="flex items-center gap-2">
        <h3
          className="min-w-0 flex-1 truncate font-mono text-xs font-semibold"
          title={card?.key ?? testKey}
        >
          {card?.name ?? testKey}
        </h3>
        {card?.workspace ? (
          <span className="truncate text-2xs text-muted-foreground">{card.workspace}</span>
        ) : null}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label={translate('buildWeb.testHistory.closeCard', 'Close the test card')}
        >
          <X />
        </Button>
      </div>
      {error ? <p className="py-1 text-xs text-destructive">{error}</p> : null}
      {!card && !error ? (
        <p className="py-1 text-xs text-muted-foreground">
          {translate('buildWeb.testHistory.loadingCase', 'Reading the test’s history…')}
        </p>
      ) : null}
      {card ? (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            {runs < 2
              ? translate(
                  'buildWeb.testHistory.oneRun',
                  'One run in the history — nothing to compare with.'
                )
              : [
                  translate(
                    'buildWeb.testHistory.runsInHistory',
                    '{{count}} run(s) in the history',
                    {
                      count: runs
                    }
                  ),
                  card.flips > 0
                    ? translate(
                        'buildWeb.testHistory.flips',
                        '{{count}} status change(s) at the same commit',
                        { count: card.flips }
                      )
                    : translate(
                        'buildWeb.testHistory.noFlips',
                        'no status change at an unchanged commit'
                      ),
                  card.avgDurationMs != null
                    ? translate('buildWeb.testHistory.average', '{{duration}} on average', {
                        duration: durationText(card.avgDurationMs)
                      })
                    : null
                ]
                  .filter((part) => part !== null)
                  .join(' · ')}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 text-2xs text-muted-foreground">
                {translate('buildWeb.testHistory.statusOverRuns', 'Status, oldest to newest')}
              </p>
              <StatusBars points={card.points} />
            </div>
            <div>
              <p className="mb-1 text-2xs text-muted-foreground">
                {translate('buildWeb.testHistory.durationOverRuns', 'Duration')}
              </p>
              <DurationBars points={card.points} />
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
