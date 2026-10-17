import { defineMethod } from '../core'
import {
  BuildWebAgentSessionParams,
  BuildWebClearSessionParams,
  BuildWebCommentParams,
  BuildWebConnect,
  BuildWebFavoriteParams,
  BuildWebIssueId,
  BuildWebIssueQueryParams,
  BuildWebImageHistoryParams,
  BuildWebImagePageParams,
  BuildWebImagePushParams,
  BuildWebIssueUpdateParams,
  BuildWebCommitDiffParams,
  BuildWebCommitsParams,
  BuildWebGuideParams,
  BuildWebGuideShotParams,
  BuildWebPublishGuideParams,
  BuildWebPushRunParams,
  BuildWebProviderSessionParams,
  BuildWebVersionsParams
} from '../../../../shared/rpc-contract/build-web-params'

// The token lives on the host that runs these, and every paired client acts as its owner.
export const BUILD_WEB_METHODS = [
  defineMethod({
    name: 'buildWeb.connect',
    permission: 'accounts-admin',
    params: BuildWebConnect,
    handler: async (params, { runtime }) => runtime.buildWebConnect(params)
  }),
  defineMethod({
    name: 'buildWeb.disconnect',
    permission: 'accounts-admin',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebDisconnect()
  }),
  defineMethod({
    name: 'buildWeb.status',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebStatus()
  }),
  defineMethod({
    name: 'buildWeb.testConnection',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebTestConnection()
  }),
  defineMethod({
    name: 'buildWeb.listIssues',
    permission: 'workspace',
    params: BuildWebIssueQueryParams,
    handler: async (params, { runtime, signal }) => runtime.buildWebListIssues(params, signal)
  }),
  defineMethod({
    name: 'buildWeb.getIssue',
    permission: 'workspace',
    params: BuildWebIssueId,
    handler: async (params, { runtime, signal }) => runtime.buildWebGetIssue(params, signal)
  }),
  defineMethod({
    name: 'buildWeb.listAssignees',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebListAssignees()
  }),
  defineMethod({
    name: 'buildWeb.listVersions',
    permission: 'workspace',
    params: BuildWebVersionsParams,
    handler: async (params, { runtime }) => runtime.buildWebListVersions(params)
  }),
  defineMethod({
    name: 'buildWeb.updateIssue',
    permission: 'workspace',
    params: BuildWebIssueUpdateParams,
    handler: async (params, { runtime }) => runtime.buildWebUpdateIssue(params)
  }),
  defineMethod({
    name: 'buildWeb.setFavorite',
    permission: 'workspace',
    params: BuildWebFavoriteParams,
    handler: async (params, { runtime }) => runtime.buildWebSetFavorite(params)
  }),
  defineMethod({
    name: 'buildWeb.addComment',
    permission: 'workspace',
    params: BuildWebCommentParams,
    handler: async (params, { runtime }) => runtime.buildWebAddComment(params)
  }),
  defineMethod({
    name: 'buildWeb.setAgentSession',
    permission: 'workspace',
    params: BuildWebAgentSessionParams,
    handler: async (params, { runtime }) => runtime.buildWebSetAgentSession(params)
  }),
  defineMethod({
    name: 'buildWeb.noteProviderSession',
    permission: 'workspace',
    params: BuildWebProviderSessionParams,
    handler: async (params, { runtime }) => runtime.buildWebNoteProviderSession(params)
  }),
  defineMethod({
    name: 'buildWeb.clearAgentSession',
    permission: 'workspace',
    params: BuildWebClearSessionParams,
    handler: async (params, { runtime }) => runtime.buildWebClearAgentSession(params)
  }),
  defineMethod({
    name: 'buildWeb.imageSummary',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.buildWebImageSummary()
  }),
  defineMethod({
    name: 'buildWeb.listImages',
    permission: 'workspace',
    params: BuildWebImagePageParams,
    handler: async (params, { runtime }) => runtime.buildWebListImages(params)
  }),
  defineMethod({
    name: 'buildWeb.listImageBuilds',
    permission: 'workspace',
    params: BuildWebImageHistoryParams,
    handler: async (params, { runtime }) => runtime.buildWebListImageBuilds(params)
  }),
  defineMethod({
    name: 'buildWeb.pushImages',
    permission: 'workspace',
    params: BuildWebImagePushParams,
    handler: async (params, { runtime }) => runtime.buildWebPushImages(params)
  }),
  defineMethod({
    name: 'buildWeb.getIssueRun',
    permission: 'workspace',
    params: BuildWebIssueId,
    handler: async (params, { runtime }) => runtime.buildWebGetIssueRun(params)
  }),
  defineMethod({
    name: 'buildWeb.pushRun',
    permission: 'workspace',
    params: BuildWebPushRunParams,
    handler: async (params, { runtime }) => runtime.buildWebPushRun(params)
  }),
  defineMethod({
    name: 'buildWeb.saveGuide',
    permission: 'workspace',
    params: BuildWebGuideParams,
    handler: async (params, { runtime }) => runtime.buildWebSaveGuide(params)
  }),
  defineMethod({
    name: 'buildWeb.refreshGuideImages',
    permission: 'workspace',
    params: BuildWebGuideParams,
    handler: async (params, { runtime }) => runtime.buildWebRefreshGuideImages(params)
  }),
  defineMethod({
    name: 'buildWeb.publishGuide',
    permission: 'workspace',
    params: BuildWebPublishGuideParams,
    handler: async (params, { runtime }) => runtime.buildWebPublishGuide(params)
  }),
  defineMethod({
    name: 'buildWeb.issueCommits',
    permission: 'workspace',
    params: BuildWebCommitsParams,
    handler: async (params, { runtime }) => runtime.buildWebIssueCommits(params)
  }),
  defineMethod({
    name: 'buildWeb.commitDiff',
    permission: 'workspace',
    params: BuildWebCommitDiffParams,
    handler: async (params, { runtime }) => runtime.buildWebCommitDiff(params)
  }),
  defineMethod({
    name: 'buildWeb.guideShot',
    permission: 'workspace',
    params: BuildWebGuideShotParams,
    handler: async (params, { runtime }) => runtime.buildWebGuideShot(params)
  })
]
