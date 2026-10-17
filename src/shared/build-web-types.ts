import type { SecretAtRestProtection } from './secret-at-rest-protection'

// build-web: the internal build console whose task registry Orca shows in its Issues page.
// Shapes mirror tools/build-web's own JSON (snake_case) so nothing is renamed on the way through.

export type BuildWebProduct = 'sa' | 'dc' | 'ap' | 'storage' | 'tools'

export const BUILD_WEB_STATUSES = [
  'todo',
  'planned',
  'inprogress',
  'paused',
  'awaiting_response',
  'deploying',
  'build_failed',
  'testing',
  'testing_external',
  'done',
  'wontfix'
] as const
export type BuildWebStatus = (typeof BUILD_WEB_STATUSES)[number]
/** A status or product this Orca does not know yet: shown as is, never guessed into a known one. */
export type BuildWebIssueStatus = BuildWebStatus | 'unknown'
export type BuildWebIssueProduct = BuildWebProduct | 'unknown'

/** What a subtask may move to — the console refuses the rest. */
export const BUILD_WEB_SUBTASK_STATUSES: readonly BuildWebStatus[] = [
  'todo',
  'inprogress',
  'paused',
  'awaiting_response',
  'done',
  'wontfix'
]

export type BuildWebView = 'mine' | 'ai' | 'favorite' | 'all'

export type BuildWebConnectionStatus = {
  connected: boolean
  baseUrl: string | null
  /** The token owner's login (e-mail). */
  login: string | null
  /** The console sections the owner holds, as `/api/me` names them. */
  perms: string[]
  /** How the stored token sits on disk; null when nothing is stored. */
  credentialProtection?: SecretAtRestProtection | null
  credentialError?: string | null
}

export type BuildWebConnectArgs = { baseUrl: string; token: string }

export type BuildWebConnectResult =
  | { ok: true; status: BuildWebConnectionStatus }
  | { ok: false; error: string }

export type BuildWebAgentSession = {
  surface_kind: 'terminal' | 'structured' | 'unknown'
  surface_id: string
  worktree_name: string
  execution_host_id: string
  agent: string
  started_at: string
  provider_session_id: string
  by: string
}

/** A list row: no description, so a page of rows stays well under one RPC frame. */
export type BuildWebIssueRow = {
  id: string
  key: string
  product: BuildWebIssueProduct
  title: string
  type: string
  status: BuildWebIssueStatus
  priority: number
  parent_id: string | null
  parent_key: string | null
  children_open: number
  favorite: boolean
  for_ai: boolean
  assignee: string
  version_id: string | null
  version_name: string | null
  jira_key: string | null
  updated_at: string
  agent_session: BuildWebAgentSession | null
  /** Built in main from the stored base URL — never taken from the console's answer. */
  url: string
}

export type BuildWebStep = { text?: string; action?: string; expected?: string }

export type BuildWebComment = { id: string; author: string; body: string; created_at: string }

export type BuildWebIssueDetail = BuildWebIssueRow & {
  description: string
  steps: BuildWebStep[]
  stand_name: string | null
  jira_status: string
  created_by: string
  created_at: string
  updated_by: string
  /** The release branch and every newer one, down to master: what the task is built from. */
  branches: string[]
  comments: BuildWebComment[]
}

export type BuildWebIssueQuery = {
  view: BuildWebView
  q?: string
  status?: BuildWebStatus[]
  product?: BuildWebProduct[]
  limit?: number
  offset?: number
}

export type BuildWebIssuePage = { issues: BuildWebIssueRow[]; total: number }

export type BuildWebIssuePatch = Partial<{
  title: string
  status: BuildWebStatus
  priority: number
  assignee: string
  version_id: string | null
  for_ai: boolean
}>

export type BuildWebMutationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number; routeMissing?: boolean }

export type BuildWebUser = { email: string; name: string }
export type BuildWebVersion = { id: string; name: string; branch: string }
