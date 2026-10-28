import { ipcMain } from 'electron'
import type { ZodTypeAny, z } from 'zod'
import {
  BuildWebCommentDeleteParams,
  BuildWebCommentEditParams,
  BuildWebIssueId
} from '../../shared/rpc-contract/build-web-params'
import {
  BuildWebImageFreshnessParams,
  BuildWebAdoptParams,
  BuildWebComboParams,
  BuildWebRedosTwinParams,
  BuildWebTaskPageParams,
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
import { RuntimeBuildWebTaskCommands } from '../runtime/runtime-build-web-task-commands'

const commands = new RuntimeBuildWebTaskCommands()

// The same schemas as the RPC methods: IPC and a paired client agree on every field.
function handle<S extends ZodTypeAny>(
  channel: string,
  schema: S,
  run: (args: z.infer<S>) => unknown
): void {
  ipcMain.handle(`buildWeb:${channel}`, async (_event, args: unknown) => run(schema.parse(args)))
}

/** The task card's Build, Guide and Properties calls. */
export function registerBuildWebTaskHandlers(): void {
  handle('buildCombos', BuildWebCombosParams, (args) => commands.buildWebBuildCombos(args))
  handle('cancelBuild', BuildWebComboParams, (args) => commands.buildWebCancelBuild(args))
  handle('retryRedosTwin', BuildWebRedosTwinParams, (args) => commands.buildWebRetryRedosTwin(args))
  handle('addRunImages', BuildWebRunCombosParams, (args) => commands.buildWebAddRunImages(args))
  handle('removeRunImages', BuildWebRunCombosParams, (args) =>
    commands.buildWebRemoveRunImages(args)
  )
  handle('detectBuilt', BuildWebRunId, (args) => commands.buildWebDetectBuilt(args))
  handle('lastBuilt', BuildWebRunId, (args) => commands.buildWebLastBuilt(args))
  handle('runFreshness', BuildWebFreshnessParams, (args) => commands.buildWebRunFreshness(args))
  handle('setTestingStatus', BuildWebTestingParams, (args) =>
    commands.buildWebSetTestingStatus(args)
  )
  handle('adoptBuilt', BuildWebAdoptParams, (args) => commands.buildWebAdoptBuilt(args))
  handle('detectImages', BuildWebDetectParams, (args) => commands.buildWebDetectImages(args))
  handle('createIssueRun', BuildWebIssueRunParams, (args) => commands.buildWebCreateIssueRun(args))
  handle('issueBuildBranches', BuildWebIssueId, (args) => commands.buildWebIssueBuildBranches(args))
  handle('imageFreshness', BuildWebImageFreshnessParams, (args) =>
    commands.buildWebImageFreshness(args)
  )
  handle('imageNames', BuildWebRepoParams, (args) => commands.buildWebImageNames(args))
  handle('branches', BuildWebRepoParams, (args) => commands.buildWebBranches(args))
  handle('fetchRepo', BuildWebRepoParams, (args) => commands.buildWebFetchRepo(args))
  ipcMain.handle('buildWeb:imageTestSources', () => commands.buildWebImageTestSources())
  handle('startGuide', BuildWebGuideStartParams, (args) => commands.buildWebStartGuide(args))
  handle('guideStream', BuildWebGuideStreamParams, (args) => commands.buildWebGuideStream(args))
  handle('setGuideTarget', BuildWebGuideTargetParams, (args) =>
    commands.buildWebSetGuideTarget(args)
  )
  handle('startGuideShots', BuildWebRunId, (args) => commands.buildWebStartGuideShots(args))
  handle('shotsJob', BuildWebRunId, (args) => commands.buildWebShotsJob(args))
  handle('getJob', BuildWebJobParams, (args) => commands.buildWebGetJob(args))
  handle('cancelJob', BuildWebJobParams, (args) => commands.buildWebCancelJob(args))
  ipcMain.handle('buildWeb:listStands', () => commands.buildWebListStands())
  ipcMain.handle('buildWeb:listUiAccounts', () => commands.buildWebListUiAccounts())
  handle('resolveStand', BuildWebRunId, (args) => commands.buildWebResolveStand(args))
  handle('jiraInfo', BuildWebJiraKeyParams, (args) => commands.buildWebJiraInfo(args))
  handle('jiraTransitions', BuildWebJiraKeyParams, (args) => commands.buildWebJiraTransitions(args))
  handle('jiraTransition', BuildWebJiraTransitionParams, (args) =>
    commands.buildWebJiraTransition(args)
  )
  handle('tmsStands', BuildWebTmsStandsParams, (args) => commands.buildWebTmsStands(args))
  handle('standVersion', BuildWebStandParams, (args) => commands.buildWebStandVersion(args))
  handle('refreshIssueVersion', BuildWebIssueId, (args) =>
    commands.buildWebRefreshIssueVersion(args)
  )
  handle('jiraDraft', BuildWebIssueId, (args) => commands.buildWebJiraDraft(args))
  handle('createJiraIssue', BuildWebJiraCreateParams, (args) =>
    commands.buildWebCreateJiraIssue(args)
  )
  handle('editComment', BuildWebCommentEditParams, (args) => commands.buildWebEditComment(args))
  handle('deleteComment', BuildWebCommentDeleteParams, (args) =>
    commands.buildWebDeleteComment(args)
  )
  handle('pushProgress', BuildWebPushProgressParams, (args) => commands.buildWebPushProgress(args))
  ipcMain.handle('buildWeb:listTrains', () => commands.buildWebListTrains())
  ipcMain.handle('buildWeb:trainsRolling', () => commands.buildWebTrainsRolling())
  handle('trainRuns', BuildWebTrainRunsParams, (args) => commands.buildWebTrainRuns(args))
  handle('trainActions', BuildWebTrainActionsParams, (args) => commands.buildWebTrainActions(args))
  handle('trainPreview', BuildWebTrainParams, (args) => commands.buildWebTrainPreview(args))
  handle('runTrain', BuildWebTrainParams, (args) => commands.buildWebRunTrain(args))
  ipcMain.handle('buildWeb:watch', () => commands.buildWebWatch())
  ipcMain.handle('buildWeb:watchCheck', () => commands.buildWebWatchCheck())
  handle('recaps', BuildWebRecapsParams, (args) => commands.buildWebRecaps(args))
  handle('recapReport', BuildWebRecapReportParams, (args) => commands.buildWebRecapReport(args))
  ipcMain.handle('buildWeb:testRuns', () => commands.buildWebTestRuns())
  handle('testRun', BuildWebRunId, (args) => commands.buildWebTestRun(args))
  handle('testRunWorkspace', BuildWebTestWorkspaceParams, (args) =>
    commands.buildWebTestRunWorkspace(args)
  )
  handle('testCase', BuildWebTestCaseParams, (args) => commands.buildWebTestCase(args))
  ipcMain.handle('buildWeb:testNightly', () => commands.buildWebTestNightly())
  ipcMain.handle('buildWeb:activity', () => commands.buildWebActivity())
  handle('taskPage', BuildWebTaskPageParams, (args) => commands.buildWebTaskPage(args))
  ipcMain.handle('buildWeb:notificationsSeen', () => commands.buildWebNotificationsSeen())
  ipcMain.handle('buildWeb:notificationsClear', () => commands.buildWebNotificationsClear())
}
