import type { z } from 'zod'
import type {
  BuildWebAgentSessionParams,
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
  BuildWebImagePushParams,
  BuildWebIssueUpdateParams,
  BuildWebRunParams,
  BuildWebBuildLogParams,
  BuildWebVersionBranchesParams,
  BuildWebCommitDiffParams,
  BuildWebCommitsParams,
  BuildWebGuideParams,
  BuildWebGuideShotParams,
  BuildWebPublishGuideParams,
  BuildWebPushRunParams,
  BuildWebProviderSessionParams,
  BuildWebVersionsParams
} from '../../shared/rpc-contract/build-web-params'
import {
  connectBuildWeb,
  disconnectBuildWeb,
  getBuildWebStatus,
  testBuildWebConnection
} from '../build-web/build-web-connection'
import {
  getBuildWebIssue,
  listBuildWebAssignees,
  listBuildWebIssues,
  listBuildWebVersions
} from '../build-web/build-web-issue-read'
import {
  addBuildWebComment,
  clearBuildWebAgentSession,
  noteBuildWebProviderSession,
  setBuildWebAgentSession,
  setBuildWebFavorite,
  updateBuildWebIssue
} from '../build-web/build-web-issue-write'
import {
  buildWebImageSummary,
  listBuildWebImageBuilds,
  listBuildWebImages,
  pushBuildWebImages
} from '../build-web/build-web-images'
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
  startBuildWebImageBuild
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

  buildWebListIssues(args: In<typeof BuildWebIssueQueryParams>, signal?: AbortSignal) {
    return listBuildWebIssues(args, signal)
  }

  buildWebGetIssue(args: In<typeof BuildWebIssueId>, signal?: AbortSignal) {
    return getBuildWebIssue(args.id, signal)
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

  buildWebSetFavorite(args: In<typeof BuildWebFavoriteParams>) {
    return setBuildWebFavorite(args.id, args.on)
  }

  buildWebAddComment(args: In<typeof BuildWebCommentParams>) {
    return addBuildWebComment(args.id, args.body, args.jira)
  }

  buildWebSetAgentSession(args: In<typeof BuildWebAgentSessionParams>) {
    return setBuildWebAgentSession(args.id, args.session)
  }

  buildWebNoteProviderSession(args: In<typeof BuildWebProviderSessionParams>) {
    return noteBuildWebProviderSession(args.id, args.surfaceId, args.providerSessionId)
  }

  buildWebClearAgentSession(args: In<typeof BuildWebClearSessionParams>) {
    return clearBuildWebAgentSession(args.id, args.surfaceId)
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

  buildWebVersionBranches(args: In<typeof BuildWebVersionBranchesParams>) {
    return listBuildWebVersionBranches(args.product)
  }

  buildWebStartImageBuild(args: In<typeof BuildWebImageBuildParams>) {
    return startBuildWebImageBuild(args)
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
}
