import { useEffect, useMemo, useState } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type {
  BuildWebTestJobBreakdown,
  BuildWebTestRunSummary
} from '../../../../../../shared/build-web-test-history-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import {
  BREAKDOWN_FILTERS,
  breakdownJobs,
  durationText,
  keepJob,
  type BreakdownFilter
} from './run-breakdown'
import { TestWorkspaceRow } from './TestWorkspaceRow'

const FILTER_LABEL: Record<BreakdownFilter, () => string> = {
  all: () => translate('buildWeb.testHistory.filter.all', 'All'),
  failed: () => translate('buildWeb.testHistory.filter.failed', 'Failed'),
  flaky: () => translate('buildWeb.testHistory.filter.flaky', 'Retried'),
  skipped: () => translate('buildWeb.testHistory.filter.skipped', 'Skipped')
}

function Counter({
  value,
  label,
  className
}: {
  value: number | string
  label: string
  className?: string
}): React.JSX.Element {
  return (
    <span className="flex items-baseline gap-1">
      <span className={cn('font-mono text-[13px] font-semibold tabular-nums', className)}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  )
}

/** A run laid out by test: its counts, a bar per workspace, and inside a workspace its tests. */
export function TestRunBreakdown({
  target,
  runId,
  summary,
  jobs,
  focus,
  cardKey,
  onOpenCase,
  onOpenLog,
  onOpenJunit
}: {
  target: RuntimeClientTarget
  runId: string
  summary: BuildWebTestRunSummary
  jobs: BuildWebTestJobBreakdown[]
  /** The workspace the map asked for; `n` grows with every click, so a second click scrolls again. */
  focus: { workspace: string; n: number } | null
  cardKey: string | null
  onOpenCase: (key: string) => void
  onOpenLog: (job: BuildWebTestJobBreakdown) => void
  onOpenJunit: (job: BuildWebTestJobBreakdown) => void
}): React.JSX.Element {
  const [filter, setFilter] = useState<BreakdownFilter>('all')
  // A workspace the filter hides cannot be scrolled to: the filter gives way.
  useEffect(() => {
    const picked = focus ? jobs.find((j) => j.workspace === focus.workspace) : undefined
    if (picked && !keepJob(picked, filter)) {
      setFilter('all')
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- only a new pick on the map moves the filter.
  }, [focus])
  const shown = useMemo(() => breakdownJobs(jobs, filter), [jobs, filter])
  const s = summary
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-y border-border bg-muted/40 px-3 py-1.5">
        <Counter
          value={s.passed}
          label={translate('buildWeb.testHistory.status.passed', 'passed')}
          className="text-chip-tone-green"
        />
        <Counter
          value={s.failed}
          label={translate('buildWeb.testHistory.status.failed', 'failed')}
          className={s.failed ? 'text-destructive' : 'text-muted-foreground'}
        />
        <Counter
          value={s.skipped}
          label={translate('buildWeb.testHistory.status.skipped', 'skipped')}
          className="text-muted-foreground"
        />
        <Counter
          value={s.flaky}
          label={translate('buildWeb.testHistory.retried', 'retried')}
          className={s.flaky ? 'text-chip-tone-amber' : 'text-muted-foreground'}
        />
        <Counter
          value={`${s.redWorkspaces}/${s.workspaces}`}
          label={translate('buildWeb.testHistory.redWorkspaces', 'workspaces red')}
          className={s.redWorkspaces ? 'text-destructive' : 'text-muted-foreground'}
        />
        <Counter
          value={durationText(s.durationMs)}
          label={translate('buildWeb.testHistory.inAll', 'in all')}
        />
        <span className="flex-1" />
        <ToggleGroup
          type="single"
          variant="outline"
          size="xs"
          value={filter}
          onValueChange={(next) => {
            const picked = BREAKDOWN_FILTERS.find((f) => f === next)
            if (picked) {
              setFilter(picked)
            }
          }}
          aria-label={translate('buildWeb.testHistory.filterLabel', 'Which tests')}
        >
          {BREAKDOWN_FILTERS.map((f) => (
            <ToggleGroupItem key={f} value={f}>
              {FILTER_LABEL[f]()}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-auto">
        {shown.map((job) => (
          <TestWorkspaceRow
            key={job.jobId}
            target={target}
            runId={runId}
            job={job}
            filter={filter}
            focus={focus?.workspace === job.workspace ? focus.n : null}
            cardKey={cardKey}
            onOpenCase={onOpenCase}
            onOpenLog={onOpenLog}
            onOpenJunit={onOpenJunit}
          />
        ))}
        {shown.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            {jobs.length === 0
              ? translate('buildWeb.testHistory.noJobsInRun', 'The run has no jobs.')
              : translate(
                  'buildWeb.testHistory.noWorkspaceForFilter',
                  'No workspaces for this filter.'
                )}
          </p>
        ) : null}
      </div>
    </div>
  )
}
