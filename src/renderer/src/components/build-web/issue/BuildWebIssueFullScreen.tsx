import { useState } from 'react'
import type { BuildWebIssueRow } from '../../../../../shared/build-web-types'
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
  const setFullScreen = useBuildWebStore((s) => s.setFullScreen)
  const state = useBuildWebIssueDetail(issueId)
  const [tab, setTab] = useState<CardTab>('overview')
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
  const tabs = TABS.filter((t) => runsVisible || (t !== 'build' && t !== 'guide'))
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <IssueHeader
        detail={detail}
        saving={state.saving}
        onSave={(patch) => void state.save(patch)}
        onTakeToWork={() => onTakeToWork([detail])}
        onCollapse={() => setFullScreen(false)}
      />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = TABS.find((t) => t === v) ?? 'overview'
          setTab(next)
          setVisited((seen) => (seen.has(next) ? seen : new Set([...seen, next])))
        }}
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
            <IssueOverviewTab target={target} state={state} />
          </TabsContent>
          {runsVisible && visited.has('build') ? (
            <TabsContent value="build" forceMount hidden={tab !== 'build'}>
              <IssueBuildTab
                target={target}
                detail={detail}
                run={run}
                error={runError}
                canWrite={writesRuns(perms)}
                onPushed={reloadRun}
              />
            </TabsContent>
          ) : null}
          {runsVisible && visited.has('guide') ? (
            <TabsContent value="guide" forceMount hidden={tab !== 'guide'}>
              <IssueGuideTab
                target={target}
                detail={detail}
                run={run}
                error={runError}
                canWrite={writesRuns(perms)}
                onRun={setRun}
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
