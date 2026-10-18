import { useState } from 'react'
import { toast } from 'sonner'
import type { BuildWebIssueRow } from '../../../../../shared/build-web-types'
import {
  BUILD_WEB_TESTING_STATUSES,
  type BuildWebTestingStatus
} from '../../../../../shared/build-web-run-types'
import { callBuildWeb } from '../build-web-client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { translate } from '@/i18n/i18n'
import { useBuildWebStore } from '../build-web-store'
import { useBuildWebTarget } from '../use-build-web-data'
import { useBuildWebIssueDetail } from '../use-build-web-issue-detail'
import { BuildWebListState } from '../BuildWebListState'
import { IssueHeader } from './IssueHeader'
import { IssueOverviewTab } from './IssueOverviewTab'
import { IssueBuildTab } from './IssueBuildTab'
import { IssueGuideTab } from './IssueGuideTab'
import { IssueCommitsTab } from './IssueCommitsTab'
import { imageTally, readsRuns, writesRuns } from './issue-card-facts'
import { useIssueRun } from './use-issue-run'

type CardTab = 'overview' | 'build' | 'guide' | 'commits'
const TABS: readonly CardTab[] = ['overview', 'build', 'guide', 'commits']
const NO_PERMS: string[] = []

/** The task on the whole page, with build-web's tabs: Overview, Build, Guide & Jira, Commits. */
export function BuildWebIssueFullScreen({
  onTakeToWork
}: {
  onTakeToWork: (issues: BuildWebIssueRow[]) => void
}) {
  const { target } = useBuildWebTarget()
  const issueId = useBuildWebStore((s) => s.openIssueId)
  const perms = useBuildWebStore((s) => s.status?.perms ?? NO_PERMS)
  const collapseFullScreen = useBuildWebStore((s) => s.collapseFullScreen)
  const openIssue = useBuildWebStore((s) => s.openIssue)
  const state = useBuildWebIssueDetail(issueId)
  const [tab, setTab] = useState<CardTab>('overview')
  // Where the first build is headed: kept here until the task has a run to store it on.
  const [firstTesting, setFirstTesting] = useState<BuildWebTestingStatus>('Testing')
  // Why: a tab stays mounted once opened, so a guide draft or a comment survives a tab switch.
  const [visited, setVisited] = useState<ReadonlySet<CardTab>>(() => new Set(['overview']))
  const runsVisible = readsRuns(perms)
  const {
    run,
    error: runError,
    setRun,
    reload: reloadRun
  } = useIssueRun(target, issueId ?? '', Boolean(issueId) && runsVisible)
  const detail = state.detail
  if (!issueId || state.error) {
    return <BuildWebListState kind="error" error={state.error} />
  }
  if (!detail) {
    return <BuildWebListState kind="loading" />
  }
  const tally = run ? imageTally(run) : null
  // A subtask's build is its parent's: it has no Build or Guide of its own.
  const showRuns = runsVisible && !detail.parent_id
  const open = (next: CardTab) => {
    setTab(next)
    setVisited((seen) => (seen.has(next) ? seen : new Set([...seen, next])))
  }
  const testing = {
    value: run
      ? (BUILD_WEB_TESTING_STATUSES.find((s) => s === run.testing_status) ?? 'Testing')
      : firstTesting,
    onChange: (next: BuildWebTestingStatus) => {
      if (!run) {
        setFirstTesting(next)
        return
      }
      void callBuildWeb(target, 'setTestingStatus', { runId: run.id, testingStatus: next }).then(
        (result) => (result.ok ? setRun(result.value ?? run) : toast.error(result.error)),
        (failure) => toast.error(failure instanceof Error ? failure.message : String(failure))
      )
    }
  }
  const label = (t: CardTab) => {
    switch (t) {
      case 'overview':
        return translate('buildWeb.card.overview', 'Overview')
      case 'build':
        return tally
          ? translate('buildWeb.card.buildCount', 'Build {{ok}} / {{total}}', tally)
          : translate('buildWeb.card.build', 'Build')
      case 'guide':
        return translate('buildWeb.card.guide', 'Guide & Jira')
      case 'commits':
        return translate('buildWeb.card.commits', 'Commits')
    }
  }
  const tabs = TABS.filter((t) => showRuns || (t !== 'build' && t !== 'guide'))
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <IssueHeader
        detail={detail}
        saving={state.saving}
        onSave={(patch) => void state.save(patch)}
        onTakeToWork={() => onTakeToWork([detail])}
        onCollapse={collapseFullScreen}
        onBackToList={() => openIssue(null)}
      />
      <Tabs
        value={tab}
        onValueChange={(v) => open(TABS.find((t) => t === v) ?? 'overview')}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="px-3 md:px-5">
          <TabsList variant="line">
            {tabs.map((t) => (
              <TabsTrigger key={t} value={t}>
                {label(t)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-5">
          <TabsContent value="overview" forceMount hidden={tab !== 'overview'}>
            <IssueOverviewTab
              target={target}
              state={state}
              run={run}
              showRuns={showRuns}
              testing={testing}
              onOpenBuild={() => open('build')}
              onOpenIssue={(id) => openIssue(id, true)}
            />
          </TabsContent>
          {showRuns && visited.has('build') ? (
            <TabsContent value="build" forceMount hidden={tab !== 'build'}>
              <IssueBuildTab
                target={target}
                detail={detail}
                run={run}
                error={runError}
                canWrite={writesRuns(perms)}
                testing={testing.value}
                onChanged={reloadRun}
              />
            </TabsContent>
          ) : null}
          {showRuns && visited.has('guide') ? (
            <TabsContent value="guide" forceMount hidden={tab !== 'guide'}>
              <IssueGuideTab
                target={target}
                detail={detail}
                run={run}
                error={runError}
                canWrite={writesRuns(perms)}
                onRun={setRun}
                onOpenBuild={() => open('build')}
              />
            </TabsContent>
          ) : null}
          {visited.has('commits') ? (
            <TabsContent value="commits" forceMount hidden={tab !== 'commits'}>
              <IssueCommitsTab target={target} issueId={detail.id} />
            </TabsContent>
          ) : null}
        </div>
      </Tabs>
    </div>
  )
}
