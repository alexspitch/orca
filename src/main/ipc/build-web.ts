import { ipcMain } from 'electron'
import type { ZodTypeAny, z } from 'zod'
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
  BuildWebImageBuildParams,
  BuildWebImagePushParams,
  BuildWebRunParams,
  BuildWebVersionBranchesParams,
  BuildWebIssueUpdateParams,
  BuildWebCommitDiffParams,
  BuildWebCommitsParams,
  BuildWebGuideParams,
  BuildWebGuideShotParams,
  BuildWebPublishGuideParams,
  BuildWebPushRunParams,
  BuildWebProviderSessionParams,
  BuildWebVersionsParams
} from '../../shared/rpc-contract/build-web-params'
import { RuntimeBuildWebCommands } from '../runtime/runtime-build-web-commands'

const commands = new RuntimeBuildWebCommands()

// The same schemas as the RPC methods: IPC and a paired client agree on every field.
function handle<S extends ZodTypeAny>(
  channel: string,
  schema: S,
  run: (args: z.infer<S>) => unknown
): void {
  ipcMain.handle(`buildWeb:${channel}`, async (_event, args: unknown) => run(schema.parse(args)))
}

export function registerBuildWebHandlers(): void {
  ipcMain.handle('buildWeb:status', () => commands.buildWebStatus())
  ipcMain.handle('buildWeb:disconnect', () => commands.buildWebDisconnect())
  ipcMain.handle('buildWeb:testConnection', () => commands.buildWebTestConnection())
  ipcMain.handle('buildWeb:listAssignees', () => commands.buildWebListAssignees())
  ipcMain.handle('buildWeb:imageSummary', () => commands.buildWebImageSummary())
  handle('listImages', BuildWebImagePageParams, (args) => commands.buildWebListImages(args))
  handle('listImageBuilds', BuildWebImageHistoryParams, (args) =>
    commands.buildWebListImageBuilds(args)
  )
  handle('pushImages', BuildWebImagePushParams, (args) => commands.buildWebPushImages(args))
  handle('versionBranches', BuildWebVersionBranchesParams, (args) =>
    commands.buildWebVersionBranches(args)
  )
  handle('startImageBuild', BuildWebImageBuildParams, (args) =>
    commands.buildWebStartImageBuild(args)
  )
  handle('getRun', BuildWebRunParams, (args) => commands.buildWebGetRun(args))
  handle('connect', BuildWebConnect, (args) => commands.buildWebConnect(args))
  handle('listIssues', BuildWebIssueQueryParams, (args) => commands.buildWebListIssues(args))
  handle('getIssue', BuildWebIssueId, (args) => commands.buildWebGetIssue(args))
  handle('listVersions', BuildWebVersionsParams, (args) => commands.buildWebListVersions(args))
  handle('updateIssue', BuildWebIssueUpdateParams, (args) => commands.buildWebUpdateIssue(args))
  handle('setFavorite', BuildWebFavoriteParams, (args) => commands.buildWebSetFavorite(args))
  handle('addComment', BuildWebCommentParams, (args) => commands.buildWebAddComment(args))
  handle('setAgentSession', BuildWebAgentSessionParams, (args) =>
    commands.buildWebSetAgentSession(args)
  )
  handle('noteProviderSession', BuildWebProviderSessionParams, (args) =>
    commands.buildWebNoteProviderSession(args)
  )
  handle('clearAgentSession', BuildWebClearSessionParams, (args) =>
    commands.buildWebClearAgentSession(args)
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
}
