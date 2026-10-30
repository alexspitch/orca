import type { z } from 'zod'
import type {
  BuildWebAgentSessionSettingsParams,
  BuildWebClearSessionParams,
  BuildWebCommentParams,
  BuildWebConnect,
  BuildWebFavoriteParams,
  BuildWebIssueId,
  BuildWebIssueSummaryParams,
  BuildWebIssueQueryParams,
  BuildWebImageHistoryParams,
  BuildWebImagePageParams,
  BuildWebImageBuildParams,
  BuildWebImageGroupBuildParams,
  BuildWebImageAdoptParams,
  BuildWebImagePushParams,
  BuildWebIssueUpdateParams,
  BuildWebIssueCreateParams,
  BuildWebRunParams,
  BuildWebBuildLogParams,
  BuildWebVersionBranchesParams,
  BuildWebCommitDiffParams,
  BuildWebCommitsParams,
  BuildWebGuideParams,
  BuildWebGuideShotParams,
  BuildWebIssueFileParams,
  BuildWebPublishGuideParams,
  BuildWebPushRunParams,
  BuildWebProviderSessionParams,
  BuildWebSavedQueriesParams,
  BuildWebSavedQueryDeleteParams,
  BuildWebSavedQuerySaveParams,
  BuildWebVersionsParams
} from '../../shared/rpc-contract/build-web-params'
import {
  getBuildWebAgentSessionSettings,
  setBuildWebAgentSessionSettings
} from '../build-web/build-web-agent-sessions'
import {
  deleteBuildWebSavedQuery,
  listBuildWebSavedQueries,
  saveBuildWebSavedQuery
} from '../build-web/build-web-saved-queries'
import {
  connectBuildWeb,
  disconnectBuildWeb,
  getBuildWebStatus,
  testBuildWebConnection,
  buildWebConsoleFeatures
} from '../build-web/build-web-connection'
import {
  getBuildWebIssue,
  listBuildWebAssignees,
  listBuildWebIssueChildren,
  listBuildWebIssues,
  listBuildWebVersions
} from '../build-web/build-web-issue-read'
import {
  addBuildWebComment,
  archiveBuildWebIssue,
  restoreBuildWebIssue,
  clearBuildWebAgentSession,
  createBuildWebIssue,
  noteBuildWebProviderSession,
  setBuildWebFavorite,
  updateBuildWebIssue
} from '../build-web/build-web-issue-write'
import {
  buildWebImageSummary,
  listBuildWebImageBuilds,
  listBuildWebImages,
  pushBuildWebImages,
  adoptBuildWebImageSuccess
} from '../build-web/build-web-images'
import {
  getBuildWebIssueFile,
  getBuildWebIssueMockupView
} from '../build-web/build-web-issue-files'
import {
  getBuildWebCommitDiff,
  getBuildWebGuideShot,
  getBuildWebIssueCommits,
  getBuildWebIssueRun,
  publishBuildWebGuide,
  pushBuildWebRun,
  refreshBuildWebGuideImages,
  saveBuildWebGuide
} from '../build-web/build-web-runs'
import { buildWebIssueSummary } from '../build-web/build-web-issue-summary'
import { followBuildWebPush } from '../build-web/build-web-push-progress'
import {
  getBuildWebRun,
  listBuildWebVersionBranches,
  readBuildWebBuildLog,
  startBuildWebImageBuild,
  startBuildWebImageGroupBuild
} from '../build-web/build-web-image-builds'

type In<T extends z.ZodTypeAny> = z.infer<T>

// Every method name starts with `buildWeb`: the edge controller binds by that prefix.
export class RuntimeBuildWebCommands {
  buildWebStatus() {
    return getBuildWebStatus()
  }

  buildWebConnect(args: In<typeof BuildWebConnect>) {
    return connectBuildWeb(args)
  }

  buildWebDisconnect() {
    return disconnectBuildWeb()
  }

  buildWebTestConnection() {
    return testBuildWebConnection()
  }

  buildWebConsoleFeatures() {
    return buildWebConsoleFeatures()
  }

  buildWebListIssues(args: In<typeof BuildWebIssueQueryParams>, signal?: AbortSignal) {
    return listBuildWebIssues(args, signal)
  }

  buildWebGetIssue(args: In<typeof BuildWebIssueId>, signal?: AbortSignal) {
    return getBuildWebIssue(args.id, signal)
  }

  buildWebListIssueChildren(args: In<typeof BuildWebIssueId>, signal?: AbortSignal) {
    return listBuildWebIssueChildren(args.id, signal)
  }

  buildWebListAssignees() {
    return listBuildWebAssignees()
  }

  buildWebListVersions(args: In<typeof BuildWebVersionsParams>) {
    return listBuildWebVersions(args.product)
  }

  buildWebUpdateIssue(args: In<typeof BuildWebIssueUpdateParams>) {
    return updateBuildWebIssue(args.id, args.patch)
  }

  buildWebCreateIssue(args: In<typeof BuildWebIssueCreateParams>) {
    return createBuildWebIssue(args.draft)
  }

  buildWebSetFavorite(args: In<typeof BuildWebFavoriteParams>) {
    return setBuildWebFavorite(args.id, args.on)
  }

  buildWebArchiveIssue(args: In<typeof BuildWebIssueId>) {
    return archiveBuildWebIssue(args.id)
  }

  buildWebRestoreIssue(args: In<typeof BuildWebIssueId>) {
    return restoreBuildWebIssue(args.id)
  }

  buildWebSavedQueries(args: In<typeof BuildWebSavedQueriesParams>) {
    return listBuildWebSavedQueries(args.products)
  }

  buildWebSaveQuery(args: In<typeof BuildWebSavedQuerySaveParams>) {
    return saveBuildWebSavedQuery(args)
  }

  buildWebDeleteQuery(args: In<typeof BuildWebSavedQueryDeleteParams>) {
    return deleteBuildWebSavedQuery(args.id)
  }

  buildWebAddComment(args: In<typeof BuildWebCommentParams>) {
    return addBuildWebComment(args.id, args.body, args.jira, args.telegram === true)
  }

  buildWebNoteProviderSession(args: In<typeof BuildWebProviderSessionParams>) {
    return noteBuildWebProviderSession(args.id, args.surfaceId, args.providerSessionId)
  }

  buildWebClearAgentSession(args: In<typeof BuildWebClearSessionParams>) {
    return clearBuildWebAgentSession(args.id, args.surfaceId, args.abandon === true)
  }

  buildWebAgentSessionSettings() {
    return getBuildWebAgentSessionSettings()
  }

  buildWebSetAgentSessionSettings(args: In<typeof BuildWebAgentSessionSettingsParams>) {
    return setBuildWebAgentSessionSettings(args)
  }

  buildWebIssueSummary(args: In<typeof BuildWebIssueSummaryParams> = {}) {
    return buildWebIssueSummary(args)
  }

  buildWebImageSummary() {
    return buildWebImageSummary()
  }

  buildWebListImages(args: In<typeof BuildWebImagePageParams>) {
    return listBuildWebImages(args)
  }

  buildWebListImageBuilds(args: In<typeof BuildWebImageHistoryParams>) {
    return listBuildWebImageBuilds(args)
  }

  async buildWebPushImages(args: In<typeof BuildWebImagePushParams>) {
    const result = await pushBuildWebImages(args)
    if (result.ok) {
      followBuildWebPush(args.runId)
    }
    return result
  }

  buildWebAdoptImageSuccess(args: In<typeof BuildWebImageAdoptParams>) {
    return adoptBuildWebImageSuccess(args)
  }

  buildWebVersionBranches(args: In<typeof BuildWebVersionBranchesParams>) {
    return listBuildWebVersionBranches(args.product)
  }

  buildWebStartImageBuild(args: In<typeof BuildWebImageBuildParams>) {
    return startBuildWebImageBuild(args)
  }

  buildWebStartImageGroupBuild(args: In<typeof BuildWebImageGroupBuildParams>) {
    return startBuildWebImageGroupBuild(args)
  }

  buildWebGetRun(args: In<typeof BuildWebRunParams>) {
    return getBuildWebRun(args.runId)
  }

  buildWebBuildLog(args: In<typeof BuildWebBuildLogParams>) {
    return readBuildWebBuildLog(args.url, args.offset)
  }

  buildWebGetIssueRun(args: In<typeof BuildWebIssueId>) {
    return getBuildWebIssueRun(args.id)
  }

  buildWebPushRun(args: In<typeof BuildWebPushRunParams>) {
    return pushBuildWebRun(args.runId, args.moveMainTag)
  }

  buildWebSaveGuide(args: In<typeof BuildWebGuideParams>) {
    return saveBuildWebGuide(args.runId, args.guide)
  }

  buildWebRefreshGuideImages(args: In<typeof BuildWebGuideParams>) {
    return refreshBuildWebGuideImages(args.runId, args.guide)
  }

  buildWebPublishGuide(args: In<typeof BuildWebPublishGuideParams>) {
    return publishBuildWebGuide(args.jiraKey, args.runId, args.guide)
  }

  buildWebIssueCommits(args: In<typeof BuildWebCommitsParams>) {
    return getBuildWebIssueCommits(args.id, args.fetch)
  }

  buildWebCommitDiff(args: In<typeof BuildWebCommitDiffParams>) {
    return getBuildWebCommitDiff(args.id, args.sha)
  }

  buildWebGuideShot(args: In<typeof BuildWebGuideShotParams>) {
    return getBuildWebGuideShot(args.runId, args.slug)
  }

  buildWebIssueFile(args: In<typeof BuildWebIssueFileParams>) {
    return getBuildWebIssueFile(args.id, args.fileId)
  }

  buildWebIssueMockupView(args: In<typeof BuildWebIssueFileParams>) {
    return getBuildWebIssueMockupView(args.id, args.fileId)
  }
}
