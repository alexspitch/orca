import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getIntlLocale, translate } from '@/i18n/i18n'
import {
  BUILD_WEB_TEST_DELTA_ORDER,
  type BuildWebTestDelta,
  type BuildWebTestJobBreakdown,
  type BuildWebTestRunDetail
} from '../../../../../../shared/build-web-test-history-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { readTestingViewPrefs, writeTestingViewPrefs, type TestRunTab } from '../testing-view-prefs'
import { TestStatusMark, TransitionMark, transitionLabel } from './test-marks'
import { runCommit, runPlace, runTitle, summarize } from './test-run-rows'
import { TestCaseCard } from './TestCaseCard'
import { TestRunBreakdown } from './TestRunBreakdown'
import { TestRunChanges } from './TestRunChanges'
import { TestWorkspaceMap } from './TestWorkspaceMap'

function deltaNote(delta: BuildWebTestDelta, changed: number): string {
  const previous = delta.previousRunId?.slice(0, 8)
  if (!previous) {
    return translate('buildWeb.testHistory.firstRun', 'first run of this scope — no delta')
  }
  return changed === 0
    ? translate('buildWeb.testHistory.emptyDelta', 'no change against {{previous}}', { previous })
    : translate('buildWeb.testHistory.against', 'against {{previous}}', { previous })
}

function RunHeader({ detail }: { detail: BuildWebTestRunDetail }): React.JSX.Element {
  const { run, delta } = detail
  const kinds = BUILD_WEB_TEST_DELTA_ORDER.filter((k) => (delta.counts[k] ?? 0) > 0)
  const changedKinds = kinds.filter((k) => k !== 'unchanged').length
  return (
    <section className="shrink-0 rounded-md border border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-base font-semibold">{runTitle(run).title}</h2>
        <TestStatusMark status={run.status} />
        <span className="text-xs text-muted-foreground">
          {summarize(run)} ·{' '}
          {translate('buildWeb.testHistory.jobs', '{{count}} job(s)', { count: run.jobs.length })}
        </span>
        <span className="font-mono text-2xs text-muted-foreground">
          {new Date(run.created_at).toLocaleString(getIntlLocale())} · {runPlace(run)} @{' '}
          {runCommit(run)} · {run.id.slice(0, 8)}
        </span>
        <span className="flex-1" />
        {kinds.map((k) => (
          <span
            key={k}
            title={transitionLabel(k)}
            className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5"
          >
            <TransitionMark kind={k} />
            <span className="font-mono text-xs tabular-nums">{delta.counts[k]}</span>
            <span className="text-2xs text-muted-foreground">{k}</span>
          </span>
        ))}
        <span className="text-xs text-muted-foreground">{deltaNote(delta, changedKinds)}</span>
      </div>
      {delta.previousRunId && !delta.comparable ? (
        <p className="mt-1.5 text-xs text-chip-tone-amber">
          {translate(
            'buildWeb.testHistory.notComparable',
            'Runs of a different scope: missing tests were not counted — a test absent here means its suite did not run, not that it is gone.'
          )}
        </p>
      ) : null}
    </section>
  )
}

/** One run: what ran and how, the workspace map, and its tests by change or by workspace. */
export function TestRunDetail({
  target,
  detail,
  onOpenLog,
  onOpenJunit
}: {
  target: RuntimeClientTarget
  detail: BuildWebTestRunDetail
  onOpenLog: (job: BuildWebTestJobBreakdown) => void
  onOpenJunit: (job: BuildWebTestJobBreakdown) => void
}): React.JSX.Element {
  const [tab, setTab] = useState<TestRunTab>(() => readTestingViewPrefs().runTab)
  const [focus, setFocus] = useState<{ workspace: string; n: number } | null>(null)
  const [cardKey, setCardKey] = useState<string | null>(null)
  const pickTab = (next: TestRunTab) => {
    writeTestingViewPrefs({ runTab: next })
    setTab(next)
  }
  const toggleCase = (key: string) => setCardKey((current) => (current === key ? null : key))
  const changed = Object.entries(detail.delta.counts)
    .filter(([kind]) => kind !== 'unchanged')
    .reduce((sum, [, n]) => sum + (n ?? 0), 0)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <RunHeader detail={detail} />
      {detail.breakdown.length > 1 ? (
        <TestWorkspaceMap
          jobs={detail.breakdown}
          onPick={(workspace) => {
            pickTab('tests')
            setFocus((f) => ({ workspace, n: (f?.n ?? 0) + 1 }))
          }}
        />
      ) : null}
      <div className="flex min-h-36 flex-1 flex-col overflow-hidden rounded-md border border-border">
        <Tabs
          value={tab}
          onValueChange={(value) => pickTab(value === 'tests' ? 'tests' : 'changes')}
          className="min-h-0 flex-1"
        >
          <div className="px-2 pt-1">
            <TabsList variant="line">
              <TabsTrigger value="changes">
                {translate('buildWeb.testHistory.tabs.changes', 'Changes · {{count}}', {
                  count: changed
                })}
              </TabsTrigger>
              <TabsTrigger value="tests">
                {translate('buildWeb.testHistory.tabs.tests', 'By test')}
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="changes" className="flex min-h-0 flex-1 flex-col">
            <TestRunChanges delta={detail.delta} cardKey={cardKey} onOpenCase={toggleCase} />
          </TabsContent>
          {/* Why mounted both: opened workspaces stay open while Changes is in front. */}
          <TabsContent
            value="tests"
            forceMount
            hidden={tab !== 'tests'}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TestRunBreakdown
              target={target}
              runId={detail.run.id}
              summary={detail.summary}
              jobs={detail.breakdown}
              focus={focus}
              cardKey={cardKey}
              onOpenCase={toggleCase}
              onOpenLog={onOpenLog}
              onOpenJunit={onOpenJunit}
            />
          </TabsContent>
        </Tabs>
      </div>
      {cardKey ? (
        <TestCaseCard target={target} testKey={cardKey} onClose={() => setCardKey(null)} />
      ) : null}
    </div>
  )
}
