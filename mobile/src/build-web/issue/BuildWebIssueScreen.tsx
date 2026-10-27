import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  BUILD_WEB_TESTING_STATUSES,
  type BuildWebTestingStatus
} from '../../../../src/shared/build-web-run-types'
import {
  imageTally,
  readsRuns,
  writesRuns
} from '../../../../src/renderer/src/components/build-web/issue/issue-card-facts'
import { filesWithRole } from '../../../../src/renderer/src/components/build-web/issue/plan/issue-file-roles'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { MobileLoadErrorState } from '../../components/MobileLoadErrorState'
import { colors, spacing, typography } from '../../theme/mobile-theme'
import {
  BUILD_WEB_CARD_TABS,
  CardTabActiveContext,
  type BuildWebCardTab,
  type BuildWebIssueTabProps
} from '../build-web-card-tabs'
import { buildWebErrorMessage } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'
import { IssueHeader } from './IssueHeader'
import { IssueOverviewTab } from './IssueOverviewTab'
import { IssueSubtasksTab } from './IssueSubtasksTab'
import { IssueBuildTab } from './tabs/IssueBuildTab'
import { IssueCommitsTab } from './tabs/IssueCommitsTab'
import { IssueGuideTab } from './tabs/IssueGuideTab'
import { IssueMockupsTab } from './tabs/IssueMockupsTab'
import { IssuePlanTab } from './tabs/IssuePlanTab'
import { useIssueArchive } from './use-issue-archive'
import { useIssueConfirm } from './use-issue-confirm'
import { useIssueDetail } from './use-issue-detail'
import { usePlanTabLabel } from './use-issue-plan-progress'
import { useIssueRun } from './use-issue-run'

/** The task on the whole screen, with build-web's tabs: Overview, Plan, Artifacts, Build, Guide & Jira, Commits, Subtasks. */
export function BuildWebIssueScreen({
  issueId,
  initialTab,
  reloadToken
}: {
  issueId: string
  initialTab: BuildWebCardTab
  reloadToken: number
}) {
  const { call, status, notify } = useBuildWebScreen()
  const { confirm, confirmElement } = useIssueConfirm()
  const state = useIssueDetail(issueId, confirm)
  const perms = status.perms
  const runsVisible = readsRuns(perms)
  const run = useIssueRun(issueId, runsVisible)
  const archive = useIssueArchive(state.detail, confirm, state.reload)
  const planLabel = usePlanTabLabel(state.detail)
  const [tab, setTab] = useState<BuildWebCardTab>(initialTab)
  // Why: a tab stays mounted once opened, so a guide draft or a comment survives a tab switch.
  const [visited, setVisited] = useState<ReadonlySet<BuildWebCardTab>>(
    () => new Set(['overview', initialTab])
  )
  // Where the first build is headed: kept here until the task has a run to store it on.
  const [firstTesting, setFirstTesting] = useState<BuildWebTestingStatus>('Testing')

  const reloadDetail = state.reload
  const reloadRun = run.reload
  const firstToken = useRef(reloadToken)
  useEffect(() => {
    if (reloadToken === firstToken.current) {
      return
    }
    reloadDetail()
    if (runsVisible) {
      reloadRun()
    }
  }, [reloadDetail, reloadRun, reloadToken, runsVisible])

  const detail = state.detail
  // A failed re-read keeps the card it already shows; only a card never read is an error screen.
  if (state.error && !detail) {
    return <MobileLoadErrorState message={state.error} onRetry={state.reload} />
  }
  if (!detail) {
    return (
      <View style={styles.centered}>
        <LoadingSpinner size={18} color={colors.textMuted} />
      </View>
    )
  }

  // A subtask's build is its parent's: it has no Build or Guide of its own.
  const showRuns = runsVisible && !detail.parent_id
  const tabs = BUILD_WEB_CARD_TABS.filter(
    (t) => (showRuns || (t !== 'build' && t !== 'guide')) && (t !== 'subtasks' || !detail.parent_id)
  )
  const current = tabs.includes(tab) ? tab : 'overview'
  const open = (next: BuildWebCardTab) => {
    setTab(next)
    setVisited((seen) => (seen.has(next) ? seen : new Set([...seen, next])))
  }

  const currentRun = run.run
  const testing: BuildWebTestingStatus = currentRun
    ? (BUILD_WEB_TESTING_STATUSES.find((s) => s === currentRun.testing_status) ?? 'Testing')
    : firstTesting
  const setTesting = (next: BuildWebTestingStatus) => {
    if (!currentRun) {
      setFirstTesting(next)
      return
    }
    void call('setTestingStatus', { runId: currentRun.id, testingStatus: next }).then(
      (result) =>
        result.ok ? run.setRun(result.value ?? currentRun) : notify(result.error, 'error'),
      (failure: unknown) => notify(buildWebErrorMessage(failure), 'error')
    )
  }

  const tally = currentRun ? imageTally(currentRun) : null
  const mockupCount = filesWithRole(detail.files, 'mockup').length
  const label = (t: BuildWebCardTab): string => {
    switch (t) {
      case 'overview':
        return 'Overview'
      case 'plan':
        return planLabel
      case 'mockups':
        return mockupCount ? `Artifacts ${mockupCount}` : 'Artifacts'
      case 'build':
        return tally ? `Build ${tally.ok} / ${tally.total}` : 'Build'
      case 'guide':
        return 'Guide & Jira'
      case 'commits':
        return 'Commits'
      case 'subtasks':
        return `Subtasks ${detail.children}`
    }
  }

  const tabProps: BuildWebIssueTabProps = {
    detail,
    reloadDetail: state.reload,
    run: run.run,
    runError: run.error,
    setRun: run.setRun,
    reloadRun: run.reload,
    canWrite: writesRuns(perms),
    testing,
    setTesting,
    openTab: open
  }

  const pane = (t: BuildWebCardTab, content: ReactNode) =>
    visited.has(t) && tabs.includes(t) ? (
      <View key={t} style={current === t ? null : styles.hidden}>
        <CardTabActiveContext.Provider value={current === t}>
          {content}
        </CardTabActiveContext.Provider>
      </View>
    ) : null

  return (
    <View style={styles.root}>
      <ScrollView
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <IssueHeader
          detail={detail}
          saving={state.saving}
          onSave={(patch) => void state.save(patch)}
          archive={archive}
        />
        <View style={styles.tabBarWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.tabBar} accessibilityRole="tablist">
              {tabs.map((t) => (
                <Pressable
                  key={t}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: current === t }}
                  onPress={() => open(t)}
                  style={[styles.tab, current === t ? styles.tabActive : null]}
                >
                  <Text style={[styles.tabText, current === t ? styles.tabTextActive : null]}>
                    {label(t)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
        <View style={styles.body}>
          {pane(
            'overview',
            <IssueOverviewTab
              state={state}
              confirm={confirm}
              run={run.run}
              showRuns={showRuns}
              testing={{ value: testing, onChange: setTesting }}
              onOpenBuild={() => open('build')}
            />
          )}
          {pane('plan', <IssuePlanTab {...tabProps} />)}
          {pane('mockups', <IssueMockupsTab {...tabProps} />)}
          {pane('build', <IssueBuildTab {...tabProps} />)}
          {pane('guide', <IssueGuideTab {...tabProps} />)}
          {pane('commits', <IssueCommitsTab {...tabProps} />)}
          {pane('subtasks', <IssueSubtasksTab detail={detail} onChanged={state.reload} />)}
        </View>
      </ScrollView>
      {confirmElement}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: spacing.xl * 2 },
  hidden: { display: 'none' },
  tabBarWrap: {
    backgroundColor: colors.bgBase,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  tabBar: { flexDirection: 'row', paddingHorizontal: spacing.sm },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  tabActive: { borderBottomColor: colors.textPrimary },
  tabText: { color: colors.textMuted, fontSize: typography.bodySize },
  tabTextActive: { color: colors.textPrimary, fontWeight: '600' },
  body: { padding: spacing.md }
})
