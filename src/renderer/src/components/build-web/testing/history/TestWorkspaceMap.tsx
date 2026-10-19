import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { BuildWebTestJobBreakdown } from '../../../../../../shared/build-web-test-history-types'
import { mapGroups, toneOf, type MapTone } from './run-breakdown'
import { shortWorkspace, type TestFamily } from './test-run-rows'

// A run of a hundred workspaces at a glance, after build-web's WorkspaceMap: a square per
// workspace, the red ones ringed. Skipped tests are a ring, not a fill: they are not a failure.

const TILE: Record<MapTone, string> = {
  passed: 'bg-chip-tone-green',
  skipped: 'bg-chip-tone-green ring-2 ring-chip-tone-neutral ring-offset-1 ring-offset-background',
  failed: 'bg-chip-tone-red ring-2 ring-chip-tone-red ring-offset-2 ring-offset-background',
  empty: 'bg-muted'
}

const LEGEND: [MapTone, () => string][] = [
  ['passed', () => translate('buildWeb.testHistory.map.passed', 'passed')],
  ['failed', () => translate('buildWeb.testHistory.map.failed', 'failed')],
  ['skipped', () => translate('buildWeb.testHistory.map.skipped', 'has skipped tests')],
  ['empty', () => translate('buildWeb.testHistory.map.empty', 'no tests')]
]

const FAMILY: Record<TestFamily, () => string> = {
  applications: () => translate('buildWeb.testHistory.family.applications', 'Applications'),
  packages: () => translate('buildWeb.testHistory.family.packages', 'Packages'),
  plugins: () => translate('buildWeb.testHistory.family.plugins', 'Plugins'),
  e2e: () => translate('buildWeb.testHistory.family.e2e', 'e2e'),
  other: () => translate('buildWeb.testHistory.family.other', 'Other')
}

const tip = (j: BuildWebTestJobBreakdown) =>
  `${j.workspace} — ${j.passed} passed · ${j.failed} failed · ${j.skipped} skipped`

export function TestWorkspaceMap({
  jobs,
  onPick
}: {
  jobs: BuildWebTestJobBreakdown[]
  /** A square was clicked: show that workspace in By test. */
  onPick: (workspace: string) => void
}): React.JSX.Element {
  return (
    <section className="shrink-0 rounded-md border border-border px-3 py-2">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-sm font-medium">
          {translate('buildWeb.testHistory.map.title', 'Workspace map')}
        </h3>
        <span className="text-xs text-muted-foreground">
          {translate('buildWeb.testHistory.map.hint', 'a square opens its workspace in By test')}
        </span>
        <span className="flex-1" />
        {LEGEND.map(([tone, label]) => (
          <span key={tone} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('size-2.5 rounded-sm', TILE[tone])} />
            {label()}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {mapGroups(jobs).map((g) => (
          <div key={g.family} className="flex items-start gap-4">
            <div className="w-28 shrink-0">
              <p className="text-xs font-medium">{FAMILY[g.family]()}</p>
              <p
                className={cn('text-2xs', g.failed ? 'text-destructive' : 'text-muted-foreground')}
              >
                {g.jobs.length}
                {g.failed
                  ? ` · ${translate('buildWeb.testHistory.map.failedCount', '{{count}} failed', { count: g.failed })}`
                  : ''}
                {g.skipped
                  ? ` · ${translate('buildWeb.testHistory.map.skippedCount', '{{count}} with skips', { count: g.skipped })}`
                  : ''}
              </p>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5 pt-1">
              {g.jobs.map((j) => (
                <button
                  key={j.jobId}
                  type="button"
                  title={tip(j)}
                  aria-label={shortWorkspace(j.workspace)}
                  onClick={() => onPick(j.workspace)}
                  className={cn(
                    'size-4 rounded-sm transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    TILE[toneOf(j)]
                  )}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
