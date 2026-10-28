import { ipcMain } from 'electron'
import type { ZodTypeAny, z } from 'zod'
import {
  BuildWebAgentSessionParams,
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
  BuildWebRunParams,
  BuildWebBuildLogParams,
  BuildWebVersionBranchesParams,
  BuildWebIssueUpdateParams,
  BuildWebCommitDiffParams,
  BuildWebCommitsParams,
  BuildWebGuideParams,
  BuildWebGuideShotParams,
  BuildWebIssueFileParams,
  BuildWebLinkWorktreeSessionParams,
  BuildWebStageIssueFileParams,
  BuildWebPublishGuideParams,
  BuildWebPushRunParams,
  BuildWebProviderSessionParams,
  BuildWebSavedQueriesParams,
  BuildWebSavedQueryDeleteParams,
  BuildWebSavedQuerySaveParams,
  BuildWebSessionTranscriptParams,
  BuildWebVersionsParams,
  BuildWebWorktreeSessionParams
} from '../../shared/rpc-contract/build-web-params'
import { RuntimeBuildWebCommands } from '../runtime/runtime-build-web-commands'
import { stageBuildWebIssueFile } from '../build-web/build-web-issue-files'
import {
  linkBuildWebSessionToWorktree,
  setBuildWebAgentSessionOnHost,
  type BuildWebSessionLinkRuntime
} from '../build-web/build-web-session-link'
import { keepBuildWebWorktreeSession } from '../build-web/build-web-session-keep'
import { readBuildWebSessionTranscript } from '../build-web/build-web-session-transcript'
import { registerBuildWebStandHandlers } from './build-web-stands'
import { registerBuildWebTaskHandlers } from './build-web-task'

const commands = new RuntimeBuildWebCommands()

// The same schemas as the RPC methods: IPC and a paired client agree on every field.
function handle<S extends ZodTypeAny>(
  channel: string,
  schema: S,
  run: (args: z.infer<S>) => unknown
): void {
  ipcMain.handle(`buildWeb:${channel}`, async (_event, args: unknown) => run(schema.parse(args)))
}

export function registerBuildWebHandlers(runtime: BuildWebSessionLinkRuntime): void {
  ipcMain.handle('buildWeb:status', () => commands.buildWebStatus())
  ipcMain.handle('buildWeb:disconnect', () => commands.buildWebDisconnect())
  ipcMain.handle('buildWeb:testConnection', () => commands.buildWebTestConnection())
  ipcMain.handle('buildWeb:consoleFeatures', () => commands.buildWebConsoleFeatures())
  ipcMain.handle('buildWeb:listAssignees', () => commands.buildWebListAssignees())
  ipcMain.handle('buildWeb:imageSummary', () => commands.buildWebImageSummary())
  ipcMain.handle('buildWeb:issueSummary', (_event, args: unknown) =>
    commands.buildWebIssueSummary(BuildWebIssueSummaryParams.parse(args ?? {}))
  )
  handle('listImages', BuildWebImagePageParams, (args) => commands.buildWebListImages(args))
  handle('listImageBuilds', BuildWebImageHistoryParams, (args) =>
    commands.buildWebListImageBuilds(args)
  )
  handle('pushImages', BuildWebImagePushParams, (args) => commands.buildWebPushImages(args))
  handle('adoptImageSuccess', BuildWebImageAdoptParams, (args) =>
    commands.buildWebAdoptImageSuccess(args)
  )
  handle('versionBranches', BuildWebVersionBranchesParams, (args) =>
    commands.buildWebVersionBranches(args)
  )
  handle('startImageBuild', BuildWebImageBuildParams, (args) =>
    commands.buildWebStartImageBuild(args)
  )
  handle('startImageGroupBuild', BuildWebImageGroupBuildParams, (args) =>
    commands.buildWebStartImageGroupBuild(args)
  )
  handle('getRun', BuildWebRunParams, (args) => commands.buildWebGetRun(args))
  handle('buildLog', BuildWebBuildLogParams, (args) => commands.buildWebBuildLog(args))
  handle('connect', BuildWebConnect, (args) => commands.buildWebConnect(args))
  handle('listIssues', BuildWebIssueQueryParams, (args) => commands.buildWebListIssues(args))
  handle('getIssue', BuildWebIssueId, (args) => commands.buildWebGetIssue(args))
  handle('listIssueChildren', BuildWebIssueId, (args) => commands.buildWebListIssueChildren(args))
  handle('listVersions', BuildWebVersionsParams, (args) => commands.buildWebListVersions(args))
  handle('updateIssue', BuildWebIssueUpdateParams, (args) => commands.buildWebUpdateIssue(args))
  handle('setFavorite', BuildWebFavoriteParams, (args) => commands.buildWebSetFavorite(args))
  handle('archiveIssue', BuildWebIssueId, (args) => commands.buildWebArchiveIssue(args))
  handle('restoreIssue', BuildWebIssueId, (args) => commands.buildWebRestoreIssue(args))
  handle('savedQueries', BuildWebSavedQueriesParams, (args) => commands.buildWebSavedQueries(args))
  handle('saveQuery', BuildWebSavedQuerySaveParams, (args) => commands.buildWebSaveQuery(args))
  handle('deleteQuery', BuildWebSavedQueryDeleteParams, (args) =>
    commands.buildWebDeleteQuery(args)
  )
  handle('addComment', BuildWebCommentParams, (args) => commands.buildWebAddComment(args))
  handle('setAgentSession', BuildWebAgentSessionParams, (args) =>
    setBuildWebAgentSessionOnHost(runtime, args)
  )
  handle('noteProviderSession', BuildWebProviderSessionParams, (args) =>
    commands.buildWebNoteProviderSession(args)
  )
  handle('clearAgentSession', BuildWebClearSessionParams, (args) =>
    commands.buildWebClearAgentSession(args)
  )
  ipcMain.handle('buildWeb:agentSessionSettings', () => commands.buildWebAgentSessionSettings())
  handle('setAgentSessionSettings', BuildWebAgentSessionSettingsParams, (args) =>
    commands.buildWebSetAgentSessionSettings(args)
  )
  handle('keepWorktreeSession', BuildWebWorktreeSessionParams, (args) =>
    keepBuildWebWorktreeSession(runtime, args.worktreeId)
  )
  handle('linkWorktreeSession', BuildWebLinkWorktreeSessionParams, async (args) => ({
    ok: true as const,
    value: await linkBuildWebSessionToWorktree(runtime, args)
  }))
  handle('sessionTranscript', BuildWebSessionTranscriptParams, (args) =>
    readBuildWebSessionTranscript(args)
  )
  handle('getIssueRun', BuildWebIssueId, (args) => commands.buildWebGetIssueRun(args))
  handle('pushRun', BuildWebPushRunParams, (args) => commands.buildWebPushRun(args))
  handle('saveGuide', BuildWebGuideParams, (args) => commands.buildWebSaveGuide(args))
  handle('refreshGuideImages', BuildWebGuideParams, (args) =>
    commands.buildWebRefreshGuideImages(args)
  )
  handle('publishGuide', BuildWebPublishGuideParams, (args) => commands.buildWebPublishGuide(args))
  handle('issueCommits', BuildWebCommitsParams, (args) => commands.buildWebIssueCommits(args))
  handle('commitDiff', BuildWebCommitDiffParams, (args) => commands.buildWebCommitDiff(args))
  handle('guideShot', BuildWebGuideShotParams, (args) => commands.buildWebGuideShot(args))
  handle('issueFile', BuildWebIssueFileParams, (args) => commands.buildWebIssueFile(args))
  handle('issueMockupView', BuildWebIssueFileParams, (args) =>
    commands.buildWebIssueMockupView(args)
  )
  // Why local only: the file is staged on this computer for its tabs, whichever host read it.
  handle('stageIssueFile', BuildWebStageIssueFileParams, (args) => stageBuildWebIssueFile(args))
  registerBuildWebTaskHandlers()
  registerBuildWebStandHandlers()
}
