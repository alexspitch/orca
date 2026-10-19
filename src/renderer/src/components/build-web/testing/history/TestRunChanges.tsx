import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type {
  BuildWebTestDelta,
  BuildWebTestDeltaRow
} from '../../../../../../shared/build-web-test-history-types'
import { TransitionMark } from './test-marks'

function flakyNote(f: NonNullable<BuildWebTestDeltaRow['flaky']>): string {
  return [
    f.retries > 0
      ? translate('buildWeb.testHistory.flakyRetries', '{{count}} retry(ies) inside the run', {
          count: f.retries
        })
      : null,
    f.flips > 0
      ? translate(
          'buildWeb.testHistory.flakyFlips',
          '{{count}} status change(s) at the same commit',
          {
            count: f.flips
          }
        )
      : null
  ]
    .filter((part) => part !== null)
    .join(' · ')
}

/** What changed since the run before: the delta rows, broken first. A row opens its test's card. */
export function TestRunChanges({
  delta,
  cardKey,
  onOpenCase
}: {
  delta: BuildWebTestDelta
  cardKey: string | null
  onOpenCase: (key: string) => void
}): React.JSX.Element {
  const unchanged = delta.counts.unchanged ?? 0
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-y border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
        <span className="w-32 shrink-0">
          {translate('buildWeb.testHistory.col.change', 'Change')}
        </span>
        <span className="min-w-0 flex-1">{translate('buildWeb.testHistory.col.test', 'Test')}</span>
        <span className="w-44 shrink-0">
          {translate('buildWeb.testHistory.col.workspace', 'Workspace')}
        </span>
        <span className="w-16 shrink-0 text-right">
          {translate('buildWeb.testHistory.col.was', 'Was')}
        </span>
        <span className="w-16 shrink-0 text-right">
          {translate('buildWeb.testHistory.col.now', 'Now')}
        </span>
      </div>
      <ul className="scrollbar-sleek min-h-0 flex-1 overflow-auto">
        {delta.rows.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              onClick={() => onOpenCase(r.key)}
              aria-pressed={cardKey === r.key}
              className={cn(
                'flex w-full items-center gap-2 border-b border-border/60 px-3 py-1 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
                cardKey === r.key && 'bg-accent'
              )}
            >
              <span className="flex w-32 shrink-0 items-center gap-1.5">
                <TransitionMark kind={r.kind} />
                <span className="font-mono text-2xs">{r.kind}</span>
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate font-mono text-xs',
                  r.change === 'disappeared' && 'text-muted-foreground line-through'
                )}
                title={r.name}
              >
                {r.name}
                {r.flaky ? (
                  <span className="text-2xs text-chip-tone-amber"> — {flakyNote(r.flaky)}</span>
                ) : null}
              </span>
              <span
                className="w-44 shrink-0 truncate text-2xs text-muted-foreground"
                title={r.workspace}
              >
                {r.workspace}
              </span>
              <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground">
                {r.was ?? '—'}
              </span>
              <span className="w-16 shrink-0 text-right font-mono text-xs">{r.now ?? '—'}</span>
            </button>
          </li>
        ))}
        {delta.rows.length === 0 ? (
          <li className="p-3 text-sm text-muted-foreground">
            {translate(
              'buildWeb.testHistory.nothingChanged',
              'Nothing changed since the previous run.'
            )}
          </li>
        ) : null}
        {delta.omitted > 0 ? (
          <li className="p-3 text-xs text-muted-foreground">
            {translate(
              'buildWeb.testHistory.omitted',
              '{{count}} more changed test(s) are not listed; By test shows every test.',
              { count: delta.omitted }
            )}
          </li>
        ) : null}
        {unchanged > 0 ? (
          <li className="p-3 text-xs text-muted-foreground">
            {translate(
              'buildWeb.testHistory.unchangedNote',
              '{{count}} unchanged test(s) are under By test.',
              { count: unchanged }
            )}
          </li>
        ) : null}
      </ul>
    </div>
  )
}
