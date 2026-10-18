import { defineMethod } from '../core'
import {
  BuildWebCommentDeleteParams,
  BuildWebCommentEditParams,
  BuildWebIssueId
} from '../../../../shared/rpc-contract/build-web-params'
import {
  BuildWebAdoptParams,
  BuildWebComboParams,
  BuildWebCombosParams,
  BuildWebDetectParams,
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
  BuildWebTrainActionsParams,
  BuildWebTrainParams,
  BuildWebTrainRunsParams,
  BuildWebRunCombosParams,
  BuildWebRunId,
  BuildWebStandParams,
  BuildWebTestingParams,
  BuildWebTmsStandsParams
} from '../../../../shared/rpc-contract/build-web-task-params'

// The task card's Build, Guide and Properties: the same host token, the same permission as Issues.
export const BUILD_WEB_TASK_METHODS = [
  defineMethod({
    name: 'buildWeb.buildCombos',
    permission: 'workspace',
    params: BuildWebCombosParams,
    handler: async (params, { runtime }) => runtime.buildWebBuildCombos(params)
  }),
  defineMethod({
    name: 'buildWeb.cancelBuild',
    permission: 'workspace',
    params: BuildWebComboParams,
    handler: async (params, { runtime }) => runtime.buildWebCancelBuild(params)
  }),
  defineMethod({
    name: 'buildWeb.addRunImages',
    permission: 'workspace',
    params: BuildWebRunCombosParams,
    handler: async (params, { runtime }) => runtime.buildWebAddRunImages(params)
  }),
  defineMethod({
    name: 'buildWeb.removeRunImages',
    permission: 'workspace',
    params: BuildWebRunCombosParams,
    handler: async (params, { runtime }) => runtime.buildWebRemoveRunImages(params)
  }),
  defineMethod({
    name: 'buildWeb.detectBuilt',
    permission: 'workspace',
    params: BuildWebRunId,
    handler: async (params, { runtime }) => runtime.buildWebDetectBuilt(params)
  }),
  defineMethod({
    name: 'buildWeb.lastBuilt',
    permission: 'workspace',
    params: BuildWebRunId,
    handler: async (params, { runtime }) => runtime.buildWebLastBuilt(params)
  }),
  defineMethod({
    name: 'buildWeb.runFreshness',
    permission: 'workspace',
    params: BuildWebFreshnessParams,
    handler: async (params, { runtime }) => runtime.buildWebRunFreshness(params)
  }),
  defineMethod({
    name: 'buildWeb.setTestingStatus',
    permission: 'workspace',
    params: BuildWebTestingParams,
    handler: async (params, { runtime }) => runtime.buildWebSetTestingStatus(params)
  }),
  defineMethod({
    name: 'buildWeb.adoptBuilt',
    permission: 'workspace',
    params: BuildWebAdoptParams,
    handler: async (params, { runtime }) => runtime.buildWebAdoptBuilt(params)
  }),
  defineMethod({
    name: 'buildWeb.detectImages',
    permission: 'workspace',
    params: BuildWebDetectParams,
    handler: async (params, { runtime }) => runtime.buildWebDetectImages(params)
  }),
  defineMethod({
    name: 'buildWeb.createIssueRun',
    permission: 'workspace',
    params: BuildWebIssueRunParams,
    handler: async (params, { runtime }) => runtime.buildWebCreateIssueRun(params)
  }),
  defineMethod({
    name: 'buildWeb.imageNames',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebImageNames()
  }),
  defineMethod({
    name: 'buildWeb.branches',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebBranches()
  }),
  defineMethod({
    name: 'buildWeb.fetchRepo',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebFetchRepo()
  }),
  defineMethod({
    name: 'buildWeb.imageTestSources',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebImageTestSources()
  }),
  defineMethod({
    name: 'buildWeb.startGuide',
    permission: 'workspace',
    params: BuildWebGuideStartParams,
    handler: async (params, { runtime }) => runtime.buildWebStartGuide(params)
  }),
  defineMethod({
    name: 'buildWeb.guideStream',
    permission: 'workspace',
    params: BuildWebGuideStreamParams,
    handler: async (params, { runtime }) => runtime.buildWebGuideStream(params)
  }),
  defineMethod({
    name: 'buildWeb.setGuideTarget',
    permission: 'workspace',
    params: BuildWebGuideTargetParams,
    handler: async (params, { runtime }) => runtime.buildWebSetGuideTarget(params)
  }),
  defineMethod({
    name: 'buildWeb.startGuideShots',
    permission: 'workspace',
    params: BuildWebRunId,
    handler: async (params, { runtime }) => runtime.buildWebStartGuideShots(params)
  }),
  defineMethod({
    name: 'buildWeb.shotsJob',
    permission: 'workspace',
    params: BuildWebRunId,
    handler: async (params, { runtime }) => runtime.buildWebShotsJob(params)
  }),
  defineMethod({
    name: 'buildWeb.getJob',
    permission: 'workspace',
    params: BuildWebJobParams,
    handler: async (params, { runtime }) => runtime.buildWebGetJob(params)
  }),
  defineMethod({
    name: 'buildWeb.cancelJob',
    permission: 'workspace',
    params: BuildWebJobParams,
    handler: async (params, { runtime }) => runtime.buildWebCancelJob(params)
  }),
  defineMethod({
    name: 'buildWeb.listStands',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebListStands()
  }),
  defineMethod({
    name: 'buildWeb.listUiAccounts',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebListUiAccounts()
  }),
  defineMethod({
    name: 'buildWeb.resolveStand',
    permission: 'workspace',
    params: BuildWebRunId,
    handler: async (params, { runtime }) => runtime.buildWebResolveStand(params)
  }),
  defineMethod({
    name: 'buildWeb.jiraInfo',
    permission: 'workspace',
    params: BuildWebJiraKeyParams,
    handler: async (params, { runtime }) => runtime.buildWebJiraInfo(params)
  }),
  defineMethod({
    name: 'buildWeb.jiraTransitions',
    permission: 'workspace',
    params: BuildWebJiraKeyParams,
    handler: async (params, { runtime }) => runtime.buildWebJiraTransitions(params)
  }),
  defineMethod({
    name: 'buildWeb.jiraTransition',
    permission: 'workspace',
    params: BuildWebJiraTransitionParams,
    handler: async (params, { runtime }) => runtime.buildWebJiraTransition(params)
  }),
  defineMethod({
    name: 'buildWeb.tmsStands',
    permission: 'workspace',
    params: BuildWebTmsStandsParams,
    handler: async (params, { runtime }) => runtime.buildWebTmsStands(params)
  }),
  defineMethod({
    name: 'buildWeb.standVersion',
    permission: 'workspace',
    params: BuildWebStandParams,
    handler: async (params, { runtime }) => runtime.buildWebStandVersion(params)
  }),
  defineMethod({
    name: 'buildWeb.refreshIssueVersion',
    permission: 'workspace',
    params: BuildWebIssueId,
    handler: async (params, { runtime }) => runtime.buildWebRefreshIssueVersion(params)
  }),
  defineMethod({
    name: 'buildWeb.jiraDraft',
    permission: 'workspace',
    params: BuildWebIssueId,
    handler: async (params, { runtime }) => runtime.buildWebJiraDraft(params)
  }),
  defineMethod({
    name: 'buildWeb.createJiraIssue',
    permission: 'workspace',
    params: BuildWebJiraCreateParams,
    handler: async (params, { runtime }) => runtime.buildWebCreateJiraIssue(params)
  }),
  defineMethod({
    name: 'buildWeb.editComment',
    permission: 'workspace',
    params: BuildWebCommentEditParams,
    handler: async (params, { runtime }) => runtime.buildWebEditComment(params)
  }),
  defineMethod({
    name: 'buildWeb.deleteComment',
    permission: 'workspace',
    params: BuildWebCommentDeleteParams,
    handler: async (params, { runtime }) => runtime.buildWebDeleteComment(params)
  }),
  defineMethod({
    name: 'buildWeb.pushProgress',
    permission: 'workspace',
    params: BuildWebPushProgressParams,
    handler: async (params, { runtime }) => runtime.buildWebPushProgress(params)
  }),
  defineMethod({
    name: 'buildWeb.listTrains',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebListTrains()
  }),
  defineMethod({
    name: 'buildWeb.trainRuns',
    permission: 'workspace',
    params: BuildWebTrainRunsParams,
    handler: async (params, { runtime }) => runtime.buildWebTrainRuns(params)
  }),
  defineMethod({
    name: 'buildWeb.trainActions',
    permission: 'workspace',
    params: BuildWebTrainActionsParams,
    handler: async (params, { runtime }) => runtime.buildWebTrainActions(params)
  }),
  defineMethod({
    name: 'buildWeb.trainPreview',
    permission: 'workspace',
    params: BuildWebTrainParams,
    handler: async (params, { runtime }) => runtime.buildWebTrainPreview(params)
  }),
  defineMethod({
    name: 'buildWeb.runTrain',
    permission: 'workspace',
    params: BuildWebTrainParams,
    handler: async (params, { runtime }) => runtime.buildWebRunTrain(params)
  })
]
