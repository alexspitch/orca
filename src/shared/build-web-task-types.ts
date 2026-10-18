// A task's guide, its screenshots, its stands and its Jira issue, after build-web's Guide,
// JiraPanel, JobPanel and the «Свойства» card.

/** A piece of a guide being written, from `offset`; `next` is where the following read starts. */
export type BuildWebGuidePiece = {
  text: string
  next: number
  done: boolean
  /** Why the generation stopped early; the text written so far stays. */
  error: string | null
}

/** A stand the guide's screenshots can be taken from. `products` are the UIs its card names. */
export type BuildWebStand = { id: string; name: string; products: string[]; enabled: boolean }

/** A login on a stand's UI. A password is never read back — only whether one works. */
export type BuildWebUiAccount = {
  id: string
  description: string
  email: string
  password: 'set' | 'missing' | 'broken'
}

/** A job on the console: a screenshot run of a guide, or the guide's own generation. */
export type BuildWebJob = {
  id: string
  kind: string
  status: 'queued' | 'running' | 'success' | 'partial' | 'failed' | 'cancelled'
  error: string | null
  can_cancel: boolean
}

export type BuildWebJobView = { job: BuildWebJob; log: string }

/** What the guide's Jira issue says now, and whether the guide is already a comment on it. */
export type BuildWebJiraInfo = {
  summary: string
  status: string
  guideComment: boolean
  url: string
}

export type BuildWebJiraTransition = { id: string; name: string; to: string }

/** A stand a task can be pinned to, with the mode its card is set up in. */
export type BuildWebTmsStand = { id: string; name: string; mode: string }

/** What a stand runs right now, read over SSH. */
export type BuildWebStandVersion = { version: string | null; mode: string; error: string | null }

/** The Jira issue the console would file for a task, shown and edited before it goes. */
export type BuildWebJiraDraft = {
  type: string
  summary: string
  description: string
  product: string
  project: string
  versions: { id: string; name: string; released: boolean }[]
  fix_versions_required: boolean
  attachments: number
}

export type BuildWebJiraCreateArgs = {
  issueId: string
  summary: string
  description: string
  fixVersionIds: string[]
}
