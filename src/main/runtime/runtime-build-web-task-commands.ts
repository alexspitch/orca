import type { z } from 'zod'
import type {
  BuildWebCommentDeleteParams,
  BuildWebCommentEditParams,
  BuildWebIssueId
} from '../../shared/rpc-contract/build-web-params'
import { deleteBuildWebComment, editBuildWebComment } from '../build-web/build-web-issue-write'
import type {
  BuildWebAdoptParams,
  BuildWebComboParams,
  BuildWebCombosParams,
  BuildWebDetectParams,
  BuildWebRepoParams,
  BuildWebFreshnessParams,
  BuildWebGuideStartParams,
  BuildWebGuideStreamParams,
  BuildWebGuideTargetParams,
  BuildWebIssueRunParams,
  BuildWebJiraCreateParams,
  BuildWebJiraKeyParams,
  BuildWebJiraTransitionParams,
  BuildWebJobParams,
  BuildWebPushProgressParams,
  BuildWebRecapReportParams,
  BuildWebRecapsParams,
  BuildWebTrainActionsParams,
  BuildWebTrainParams,
  BuildWebTrainRunsParams,
  BuildWebRunCombosParams,
  BuildWebRunId,
  BuildWebStandParams,
  BuildWebTestCaseParams,
  BuildWebTestingParams,
  BuildWebTestWorkspaceParams,
  BuildWebTmsStandsParams
} from '../../shared/rpc-contract/build-web-task-params'
import {
  addBuildWebRunImages,
  buildBuildWebCombos,
  buildWebRunFreshness,
  cancelBuildWebBuild,
  detectBuildWebBuilt,
  lastBuildWebBuilt,
  removeBuildWebRunImages,
  setBuildWebTestingStatus
} from '../build-web/build-web-run-actions'
import {
  adoptBuildWebBuilt,
  buildWebImageTestSources,
  createBuildWebIssueRun,
  detectBuildWebImages,
  fetchBuildWebRepo,
  listBuildWebBranches,
  listBuildWebImageNames
} from '../build-web/build-web-issue-build-start'
import { readBuildWebGuideStream, startBuildWebGuide } from '../build-web/build-web-guide-stream'
import { buildWebPushProgress } from '../build-web/build-web-push-progress'
import {
  countBuildWebRollingImages,
  getBuildWebTrainPreview,
  listBuildWebTrainActions,
  listBuildWebTrainRuns,
  listBuildWebTrains,
  runBuildWebTrainNow
} from '../build-web/build-web-trains'
import { checkBuildWebWatch, getBuildWebWatch } from '../build-web/build-web-watch'
import { listBuildWebRecaps, readBuildWebRecapReport } from '../build-web/build-web-recaps'
import {
  clearBuildWebNotifications,
  markBuildWebNotificationsSeen,
  readBuildWebActivity
} from '../build-web/build-web-activity'
import {
  getBuildWebLastNightly,
  getBuildWebTestCase,
  getBuildWebTestRun,
  getBuildWebTestWorkspace,
  listBuildWebTestRuns
} from '../build-web/build-web-test-history'
import {
  cancelBuildWebJob,
  findBuildWebShotsJob,
  getBuildWebJob,
  listBuildWebStands,
  listBuildWebUiAccounts,
  resolveBuildWebStand,
  setBuildWebGuideTarget,
  startBuildWebGuideShots
} from '../build-web/build-web-guide-actions'
import {
  applyBuildWebJiraTransition,
  createBuildWebJiraIssue,
  getBuildWebJiraDraft,
  getBuildWebJiraInfo,
  listBuildWebJiraTransitions,
  listBuildWebTmsStands,
  readBuildWebStandVersion,
  refreshBuildWebIssueVersion
} from '../build-web/build-web-issue-extras'

type In<T extends z.ZodTypeAny> = z.infer<T>

// The task card's Build, Guide and Properties calls. Every name starts with `buildWeb`: the edge
// controller binds this class by that prefix, beside RuntimeBuildWebCommands.
export class RuntimeBuildWebTaskCommands {
  buildWebBuildCombos(args: In<typeof BuildWebCombosParams>) {
    return buildBuildWebCombos(args.runId, args.combos, args.pushAfter, args.skipTests)
  }

  buildWebCancelBuild(args: In<typeof BuildWebComboParams>) {
    return cancelBuildWebBuild(args.runId, args.combo)
  }

  buildWebAddRunImages(args: In<typeof BuildWebRunCombosParams>) {
    return addBuildWebRunImages(args.runId, args.combos)
  }

  buildWebRemoveRunImages(args: In<typeof BuildWebRunCombosParams>) {
    return removeBuildWebRunImages(args.runId, args.combos)
  }

  buildWebDetectBuilt(args: In<typeof BuildWebRunId>) {
    return detectBuildWebBuilt(args.runId)
  }

  buildWebLastBuilt(args: In<typeof BuildWebRunId>) {
    return lastBuildWebBuilt(args.runId)
  }

  buildWebRunFreshness(args: In<typeof BuildWebFreshnessParams>) {
    return buildWebRunFreshness(args.runId, args.fetch)
  }

  buildWebSetTestingStatus(args: In<typeof BuildWebTestingParams>) {
    return setBuildWebTestingStatus(args.runId, args.testingStatus)
  }

  buildWebAdoptBuilt(args: In<typeof BuildWebAdoptParams>) {
    return adoptBuildWebBuilt(args.id, args.testingStatus)
  }

  buildWebDetectImages(args: In<typeof BuildWebDetectParams>) {
    return detectBuildWebImages(args.branch, args.ticket, args.repo ?? 'products')
  }

  buildWebCreateIssueRun(args: In<typeof BuildWebIssueRunParams>) {
    return createBuildWebIssueRun(args)
  }

  buildWebImageNames(args?: In<typeof BuildWebRepoParams>) {
    return listBuildWebImageNames(args?.repo ?? 'products')
  }

  buildWebBranches(args?: In<typeof BuildWebRepoParams>) {
    return listBuildWebBranches(args?.repo ?? 'products')
  }

  buildWebFetchRepo(args?: In<typeof BuildWebRepoParams>) {
    return fetchBuildWebRepo(args?.repo ?? 'products')
  }

  buildWebImageTestSources() {
    return buildWebImageTestSources()
  }

  buildWebStartGuide(args: In<typeof BuildWebGuideStartParams>) {
    return startBuildWebGuide(args)
  }

  buildWebGuideStream(args: In<typeof BuildWebGuideStreamParams>) {
    return readBuildWebGuideStream(args.streamId, args.offset)
  }

  buildWebSetGuideTarget(args: In<typeof BuildWebGuideTargetParams>) {
    const { runId, ...target } = args
    return setBuildWebGuideTarget(runId, target)
  }

  buildWebStartGuideShots(args: In<typeof BuildWebRunId>) {
    return startBuildWebGuideShots(args.runId)
  }

  buildWebShotsJob(args: In<typeof BuildWebRunId>) {
    return findBuildWebShotsJob(args.runId)
  }

  buildWebGetJob(args: In<typeof BuildWebJobParams>) {
    return getBuildWebJob(args.jobId)
  }

  buildWebCancelJob(args: In<typeof BuildWebJobParams>) {
    return cancelBuildWebJob(args.jobId)
  }

  buildWebListStands() {
    return listBuildWebStands()
  }

  buildWebListUiAccounts() {
    return listBuildWebUiAccounts()
  }

  buildWebResolveStand(args: In<typeof BuildWebRunId>) {
    return resolveBuildWebStand(args.runId)
  }

  buildWebJiraInfo(args: In<typeof BuildWebJiraKeyParams>) {
    return getBuildWebJiraInfo(args.jiraKey)
  }

  buildWebJiraTransitions(args: In<typeof BuildWebJiraKeyParams>) {
    return listBuildWebJiraTransitions(args.jiraKey)
  }

  buildWebJiraTransition(args: In<typeof BuildWebJiraTransitionParams>) {
    return applyBuildWebJiraTransition(args.jiraKey, args.transition)
  }

  buildWebTmsStands(args: In<typeof BuildWebTmsStandsParams>) {
    return listBuildWebTmsStands(args.product)
  }

  buildWebStandVersion(args: In<typeof BuildWebStandParams>) {
    return readBuildWebStandVersion(args.standId)
  }

  buildWebRefreshIssueVersion(args: In<typeof BuildWebIssueId>) {
    return refreshBuildWebIssueVersion(args.id)
  }

  buildWebJiraDraft(args: In<typeof BuildWebIssueId>) {
    return getBuildWebJiraDraft(args.id)
  }

  buildWebCreateJiraIssue(args: In<typeof BuildWebJiraCreateParams>) {
    return createBuildWebJiraIssue(args)
  }

  buildWebEditComment(args: In<typeof BuildWebCommentEditParams>) {
    return editBuildWebComment(args.id, args.commentId, args.body)
  }

  buildWebDeleteComment(args: In<typeof BuildWebCommentDeleteParams>) {
    return deleteBuildWebComment(args.id, args.commentId)
  }

  buildWebPushProgress(args: In<typeof BuildWebPushProgressParams>) {
    return buildWebPushProgress(args.runIds)
  }

  buildWebListTrains() {
    return listBuildWebTrains()
  }

  buildWebTrainsRolling() {
    return countBuildWebRollingImages()
  }

  buildWebTrainRuns(args: In<typeof BuildWebTrainRunsParams>) {
    return listBuildWebTrainRuns(args.trainId, args.limit, args.offset, args.withActions)
  }

  buildWebTrainActions(args: In<typeof BuildWebTrainActionsParams>) {
    return listBuildWebTrainActions(args.trainId, args.runId)
  }

  buildWebTrainPreview(args: In<typeof BuildWebTrainParams>) {
    return getBuildWebTrainPreview(args.trainId)
  }

  buildWebRunTrain(args: In<typeof BuildWebTrainParams>) {
    return runBuildWebTrainNow(args.trainId)
  }

  buildWebWatch() {
    return getBuildWebWatch()
  }

  buildWebWatchCheck() {
    return checkBuildWebWatch()
  }

  buildWebRecaps(args: In<typeof BuildWebRecapsParams>) {
    return listBuildWebRecaps(args)
  }

  buildWebRecapReport(args: In<typeof BuildWebRecapReportParams>) {
    return readBuildWebRecapReport(args.runId, args.offset)
  }

  buildWebTestRuns() {
    return listBuildWebTestRuns()
  }

  buildWebTestRun(args: In<typeof BuildWebRunId>) {
    return getBuildWebTestRun(args.runId)
  }

  buildWebTestRunWorkspace(args: In<typeof BuildWebTestWorkspaceParams>) {
    return getBuildWebTestWorkspace(args.runId, args.workspace)
  }

  buildWebTestCase(args: In<typeof BuildWebTestCaseParams>) {
    return getBuildWebTestCase(args.key)
  }

  buildWebTestNightly() {
    return getBuildWebLastNightly()
  }

  buildWebActivity() {
    return readBuildWebActivity()
  }

  buildWebNotificationsSeen() {
    return markBuildWebNotificationsSeen()
  }

  buildWebNotificationsClear() {
    return clearBuildWebNotifications()
  }
}
