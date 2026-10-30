import type { SecretAtRestProtection } from './secret-at-rest-protection'
import type {
  BuildWebAgentSessionRecord,
  BuildWebAgentSessionState,
  BuildWebLiveSessionState
} from './build-web-session-types'

// build-web: the internal build console whose task registry Orca shows in its Issues page.
// Shapes mirror tools/build-web's own JSON (snake_case) so nothing is renamed on the way through.

export const BUILD_WEB_PRODUCTS = ['sa', 'dc', 'ap', 'storage', 'cp', 'tools'] as const
export type BuildWebProduct = (typeof BUILD_WEB_PRODUCTS)[number]

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
  /** The console's session row (IS-147); absent from consoles before `agent-session-lifecycle`. */
  id?: string
  state?: BuildWebAgentSessionState
  agent_finished_at?: string | null
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
  /** Its subtasks, and how many of them are still open; a subtask has none. */
  children: number
  children_open: number
  favorite: boolean
  for_ai: boolean
  assignee: string
  version_id: string | null
  version_name: string | null
  jira_key: string | null
  updated_at: string
  agent_session: BuildWebAgentSession | null
  /**
   * The current session's state, kept after the skill finished (when `agent_session` is empty
   * again). Absent from consoles before `agent-session-lifecycle`.
   */
  agent_session_state?: BuildWebLiveSessionState | null
  /** Built in main from the stored base URL — never taken from the console's answer. */
  url: string
}

export type BuildWebStep = { text?: string; action?: string; expected?: string }

export type BuildWebComment = {
  id: string
  author: string
  body: string
  created_at: string
  /** When the author last corrected it; null when never. */
  edited_at: string | null
  /** Kept in step with the task's Jira issue: an edit and the delete go there too. */
  jira_sync: boolean
  /** `telegram`: sent to the assignee in Telegram; `telegram_reply`: their answer from there; '' the console. */
  channel: BuildWebCommentChannel
}

export const BUILD_WEB_COMMENT_CHANNELS = ['', 'telegram', 'telegram_reply'] as const
export type BuildWebCommentChannel = (typeof BUILD_WEB_COMMENT_CHANNELS)[number]

/** A file of the task, or of one of its comments: a screenshot, a recording, a document. */
export type BuildWebIssueFile = {
  id: string
  name: string
  size: number
  mime: string
  /** The comment it was attached with; null for a file of the task itself. */
  comment_id: string | null
  /** The card's Plan or Mockups tab it is shown in; '' for plain evidence. Absent from older hosts. */
  role?: BuildWebIssueFileRole
  created_by: string
  created_at: string
}

export type BuildWebIssueFileRole = '' | 'plan' | 'mockup'

/** Where a mockup is shown: `base` (absolute, valid for hours) + a screen's `path`. */
export type BuildWebMockupView = { base: string; screens: { name: string; path: string }[] }

/** Files Orca opens in its own tabs; a larger one opens in the browser instead. */
export const BUILD_WEB_ISSUE_FILE_OPEN_MAX_BYTES = 3 * 1024 * 1024

export type BuildWebIssueFileContent = { mime: string; base64: string }

export type BuildWebIssueDetail = BuildWebIssueRow & {
  description: string
  steps: BuildWebStep[]
  stand_id: string | null
  stand_name: string | null
  /** The stand's mode and the product version on it, frozen when read — see refreshIssueVersion. */
  stand_mode: string
  version: string
  jira_status: string
  jira_fix_version: string
  created_by: string
  created_at: string
  updated_by: string
  /** The release branch and every newer one, down to master: what the task is built from. */
  branches: string[]
  comments: BuildWebComment[]
  /** Absent from consoles before attachments; empty then. */
  files: BuildWebIssueFile[]
  /** A comment may go to the assignee in Telegram: a bot, a linked assignee, and not the reader. */
  telegram_available: boolean
  /** In the console's archive since, and by whom; null for a live task. */
  archived_at: string | null
  archived_by: string | null
  /** In the console's trash: archived too, and taken back only from the console's Archive section. */
  deleted_at: string | null
  /** Every agent session the task had, newest first (IS-147); absent from older consoles. */
  agent_sessions?: BuildWebAgentSessionRecord[]
}

/** The console's own sort keys for the task list. */
export const BUILD_WEB_ISSUE_SORTS = [
  'key',
  'title',
  'priority',
  'type',
  'status',
  'updated_at',
  // The viewer's stars; ascending puts the starred first, as on the console.
  'favorite'
] as const
export type BuildWebIssueSort = (typeof BUILD_WEB_ISSUE_SORTS)[number]

/** The assignee filter's value for tasks nobody is assigned; a login is an e-mail, never this word. */
export const BUILD_WEB_UNASSIGNED = 'none'

/** The assignee filter's value for the token's owner; Orca asks for it by flag or login, never by this word. */
export const BUILD_WEB_ASSIGNEE_ME = 'me'

export type BuildWebIssueQuery = {
  /** Kept for hosts that predate the flags below; a newer host reads the flags when any is set. */
  view: BuildWebView
  /** Quick filters, combined with AND. */
  mine?: boolean
  ai?: boolean
  favorite?: boolean
  /** Only tasks linked to a Jira ticket. */
  jira?: boolean
  /** The tasks put in the archive, instead of the live ones. */
  archived?: boolean
  sort?: BuildWebIssueSort
  dir?: 'asc' | 'desc'
  q?: string
  status?: BuildWebStatus[]
  product?: BuildWebProduct[]
  /** Assignee logins, and `BUILD_WEB_UNASSIGNED` for nobody's; a task matches any of them. */
  assignee?: string[]
  limit?: number
  offset?: number
  /**
   * Families, as build-web's list reads: each task followed by its subtasks that match, `limit` and
   * `offset` counting the tasks. A host predating it drops it and lists the top-level tasks.
   */
  tree?: boolean
}

/** The statuses a task is still being worked in. */
export const BUILD_WEB_OPEN_STATUSES: readonly BuildWebStatus[] = [
  'todo',
  'planned',
  'inprogress',
  'paused',
  'awaiting_response',
  'deploying',
  'build_failed',
  'testing',
  'testing_external'
]

/** The Issues badge: tasks at the top priority (Jira's Highest, Blocker, Critical). */
export type BuildWebIssueSummary = { blockers: number; capped: boolean }

/** The list's filters the badge counts within, its search too; only open tasks are counted. */
export type BuildWebIssueSummaryQuery = Pick<
  BuildWebIssueQuery,
  'mine' | 'ai' | 'favorite' | 'jira' | 'status' | 'product' | 'assignee' | 'q'
>

export type BuildWebIssuePage = { issues: BuildWebIssueRow[]; total: number }

export type BuildWebIssuePatch = Partial<{
  title: string
  status: BuildWebStatus
  priority: number
  assignee: string
  version_id: string | null
  for_ai: boolean
  type: string
  description: string
  /** One line per step to reproduce. */
  steps: { text: string }[]
  /** Another product clears the release and the stand on the console: they were the old one's. */
  product: BuildWebProduct
  stand_id: string | null
  stand_mode: string
  version: string
}>

/** A new task as the console's create takes it: the product and the title, the rest optional. */
export type BuildWebIssueDraft = Omit<BuildWebIssuePatch, 'product' | 'title'> & {
  product: BuildWebProduct
  title: string
}

/** build-web's three kinds of task. */
export const BUILD_WEB_ISSUE_TYPES = ['bug', 'improvement', 'chore'] as const

/** The console's mirror of a status move or comment to Jira. */
export type BuildWebJiraOutcome = { ok: true; status: string } | { ok: false; error: string }

export type BuildWebUpdateOutcome = {
  /** Without `favorite`: the console works it out only for lists and answers false here. */
  issue: Omit<BuildWebIssueRow, 'favorite'> | null
  jira: BuildWebJiraOutcome | null
}
/** Whether a comment went to the assignee in Telegram, and whether the task now awaits the answer. */
export type BuildWebTelegramOutcome = { ok: true; awaiting: boolean } | { ok: false; error: string }

export type BuildWebCommentOutcome = {
  id: string
  jira: BuildWebJiraOutcome | null
  /** Null when the comment was not sent to Telegram. */
  telegram: BuildWebTelegramOutcome | null
}

export type BuildWebMutationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number; routeMissing?: boolean }

export type BuildWebUser = { email: string; name: string }
export type BuildWebVersion = { id: string; name: string; branch: string }
