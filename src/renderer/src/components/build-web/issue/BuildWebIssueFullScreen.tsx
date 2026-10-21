import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { BuildWebIssueRow } from '../../../../../shared/build-web-types'
import {
  BUILD_WEB_TESTING_STATUSES,
  type BuildWebTestingStatus
} from '../../../../../shared/build-web-run-types'
import { callBuildWeb } from '../build-web-client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { translate } from '@/i18n/i18n'
import { BUILD_WEB_CARD_TABS, useBuildWebStore, type BuildWebCardTab } from '../build-web-store'
import { useBuildWebTarget } from '../use-build-web-data'
import { labelTaskTab } from '../build-web-task-tabs'
import { useBuildWebIssueDetail } from '../use-build-web-issue-detail'
import { BuildWebListState } from '../BuildWebListState'
import { BuildWebIssueSubtasks } from '../BuildWebIssueSubtasks'
import { IssueHeader } from './IssueHeader'
import { IssueOverviewTab } from './IssueOverviewTab'
import { IssueBuildTab } from './IssueBuildTab'
import { IssueGuideTab } from './IssueGuideTab'
import { IssueCommitsTab } from './IssueCommitsTab'
import { imageTally, readsRuns, writesRuns } from './issue-card-facts'
import { useIssueRun } from './use-issue-run'
import { useIssuePlan } from './plan/use-issue-plan'
import { IssuePlanTab } from './plan/IssuePlanTab'
import { IssueMockupsTab } from './plan/IssueMockupsTab'
import { filesWithRole, planProgress } from './plan/issue-file-roles'

type CardTab = BuildWebCardTab
const TABS: readonly CardTab[] = BUILD_WEB_CARD_TABS
const NO_PERMS: string[] = []

/** The task on the whole page, with build-web's tabs: Overview, Build, Guide & Jira, Commits, Subtasks. */
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
  const [tab, setTab] = useState<CardTab>(() => useBuildWebStore.getState().openTab)
  // Where the first build is headed: kept here until the task has a run to store it on.
  const [firstTesting, setFirstTesting] = useState<BuildWebTestingStatus>('Testing')
  // Why: a tab stays mounted once opened, so a guide draft or a comment survives a tab switch.
  const [visited, setVisited] = useState<ReadonlySet<CardTab>>(() => new Set(['overview', tab]))
  const runsVisible = readsRuns(perms)
  const {
    run,
    error: runError,
    setRun,
    reload: reloadRun
  } = useIssueRun(target, issueId ?? '', Boolean(issueId) && runsVisible)
  const detail = state.detail
  useEffect(() => {
    if (detail) {
      labelTaskTab(detail.id, detail.key, detail.title)
    }
  }, [detail])
  const plan = useIssuePlan(target, detail)
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
    useBuildWebStore.setState({ openTab: next })
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
  const mockupCount = filesWithRole(detail.files, 'mockup').length
  // As build-web's tab: how far the plan has got once it is read, else how many plans there are.
  const planLabel = () => {
    const steps = plan.text ? planProgress(plan.text) : null
    if (steps?.total) {
      return translate('buildWeb.card.planSteps', 'Plan {{done}} / {{total}}', steps)
    }
    return plan.plans.length
      ? translate('buildWeb.card.planCount', 'Plan {{count}}', { count: plan.plans.length })
      : translate('buildWeb.card.plan', 'Plan')
  }
  const label = (t: CardTab) => {
    switch (t) {
      case 'overview':
        return translate('buildWeb.card.overview', 'Overview')
      case 'plan':
        return planLabel()
      case 'mockups':
        return mockupCount
          ? translate('buildWeb.card.mockupsCount', 'Artifacts {{count}}', { count: mockupCount })
          : translate('buildWeb.card.mockups', 'Artifacts')
      case 'build':
        return tally
          ? translate('buildWeb.card.buildCount', 'Build {{ok}} / {{total}}', tally)
          : translate('buildWeb.card.build', 'Build')
      case 'guide':
        return translate('buildWeb.card.guide', 'Guide & Jira')
      case 'commits':
        return translate('buildWeb.card.commits', 'Commits')
      case 'subtasks':
        return translate('buildWeb.card.subtasks', 'Subtasks {{count}}', {
          count: detail.children
        })
    }
  }
  // Why: a subtask has no subtasks of its own — the tree is two levels deep.
  const tabs = TABS.filter(
    (t) => (showRuns || (t !== 'build' && t !== 'guide')) && (t !== 'subtasks' || !detail.parent_id)
  )
  // Why: opened on Build for a task without one (a subtask, no rights), it shows Overview.
  const current = tabs.includes(tab) ? tab : 'overview'
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <IssueHeader
        detail={detail}
        saving={state.saving}
        onSave={(patch) => void state.save(patch)}
        onTakeToWork={() => onTakeToWork([detail])}
        onCollapse={collapseFullScreen}
        onBackToList={() => openIssue(null)}
        onOpenIssue={(id) => openIssue(id, true)}
      />
      <Tabs
        value={current}
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
          <TabsContent value="overview" forceMount hidden={current !== 'overview'}>
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
          {visited.has('plan') ? (
            <TabsContent value="plan" forceMount hidden={current !== 'plan'}>
              <IssuePlanTab issueKey={detail.key} plan={plan} />
            </TabsContent>
          ) : null}
          {visited.has('mockups') ? (
            <TabsContent
              value="mockups"
              forceMount
              hidden={current !== 'mockups'}
              className="h-full"
            >
              <IssueMockupsTab target={target} detail={detail} />
            </TabsContent>
          ) : null}
          {showRuns && visited.has('build') ? (
            <TabsContent value="build" forceMount hidden={current !== 'build'}>
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
            <TabsContent value="guide" forceMount hidden={current !== 'guide'}>
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
            <TabsContent value="commits" forceMount hidden={current !== 'commits'}>
              <IssueCommitsTab target={target} issueId={detail.id} />
            </TabsContent>
          ) : null}
          {!detail.parent_id && visited.has('subtasks') ? (
            <TabsContent value="subtasks" forceMount hidden={current !== 'subtasks'}>
              <BuildWebIssueSubtasks
                target={target}
                detail={detail}
                onOpen={(id) => openIssue(id, true)}
                onChanged={state.reload}
              />
            </TabsContent>
          ) : null}
        </div>
      </Tabs>
    </div>
  )
}
