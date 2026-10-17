import type {
  BuildWebConnectArgs,
  BuildWebConnectResult,
  BuildWebConnectionStatus,
  BuildWebIssueDetail,
  BuildWebIssuePage,
  BuildWebIssuePatch,
  BuildWebIssueQuery,
  BuildWebIssueRow,
  BuildWebMutationResult,
  BuildWebProduct,
  BuildWebUser,
  BuildWebVersion
} from '../../shared/build-web-types'

export type BuildWebSessionArgs = {
  surface_kind: 'terminal' | 'structured' | 'unknown'
  surface_id: string
  worktree_name: string
  execution_host_id: string
  agent: string
  started_at: string
}

// Why one object per method: the web client proxies `buildWeb.<name>(args)` to the
// RPC method of the same name, so the shape must match the RPC params exactly.
export type BuildWebApi = {
  status: () => Promise<BuildWebConnectionStatus>
  connect: (args: BuildWebConnectArgs) => Promise<BuildWebConnectResult>
  disconnect: () => Promise<BuildWebConnectionStatus>
  testConnection: () => Promise<BuildWebConnectResult>
  listIssues: (args: BuildWebIssueQuery) => Promise<BuildWebIssuePage>
  getIssue: (args: { id: string }) => Promise<BuildWebIssueDetail>
  listAssignees: () => Promise<BuildWebUser[]>
  listVersions: (args: { product: BuildWebProduct }) => Promise<BuildWebVersion[]>
  updateIssue: (args: {
    id: string
    patch: BuildWebIssuePatch
  }) => Promise<BuildWebMutationResult<{ issue: BuildWebIssueRow | null; jira: string | null }>>
  setFavorite: (args: { id: string; on: boolean }) => Promise<BuildWebMutationResult<boolean>>
  addComment: (args: {
    id: string
    body: string
    jira: boolean
  }) => Promise<BuildWebMutationResult<{ id: string }>>
  setAgentSession: (args: {
    id: string
    session: BuildWebSessionArgs
  }) => Promise<BuildWebMutationResult<true>>
  noteProviderSession: (args: {
    id: string
    surfaceId: string
    providerSessionId: string
  }) => Promise<BuildWebMutationResult<true>>
  clearAgentSession: (args: {
    id: string
    surfaceId: string
  }) => Promise<BuildWebMutationResult<true>>
}
