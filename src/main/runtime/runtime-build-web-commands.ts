import type { z } from 'zod'
import type {
  BuildWebAgentSessionParams,
  BuildWebClearSessionParams,
  BuildWebCommentParams,
  BuildWebConnect,
  BuildWebFavoriteParams,
  BuildWebIssueId,
  BuildWebIssueQueryParams,
  BuildWebIssueUpdateParams,
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
}
