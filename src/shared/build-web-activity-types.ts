// build-web's bell and task counter, as Orca's titlebar shows them. Field names are the console's.

export type BuildWebNotificationSeverity = 'error' | 'warning' | 'info'

/** One row under the bell: a failure, or a move, assignment or comment on the person's task. */
export type BuildWebNotification = {
  id: string
  /** build | push | job | train | runtime | tests | status | assigned | comment, and later ones. */
  kind: string
  severity: BuildWebNotificationSeverity
  title: string
  body: string
  issue_id: string | null
  issue_key: string | null
  run_id: string | null
  /** Repeats folded into this row. */
  count: number
  last_at: string
  unread: boolean
}

/**
 * What a click on a row needs to open it: its task, else its run; a train's row names its train
 * only in the title, and its window only by when it failed.
 */
export type BuildWebNotificationRef = Pick<BuildWebNotification, 'kind' | 'issue_id' | 'run_id'> &
  Partial<Pick<BuildWebNotification, 'title' | 'last_at'>>

export type BuildWebConsoleTaskStatus =
  | 'queued'
  | 'running'
  | 'stale'
  | 'success'
  | 'partial'
  | 'failed'
  | 'cancelled'

/** One long-running piece of console work: a stand job, an image build run or a test run. */
export type BuildWebConsoleTask = {
  /** `${source}:${id}` — the three sources have their own id spaces. */
  key: string
  source: 'deploy' | 'build' | 'test'
  id: string
  kind: string
  title: string
  detail: string | null
  status: BuildWebConsoleTaskStatus
  active: boolean
  /** Who started it; null from a console that does not say. */
  user: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  /** A console job (a stand's, a guide's, the test library's): its log is read as a job by its id. */
  has_log: boolean
  /**
   * IS-10: the page of the build itself — a Jenkins URL for a full redos build, a console path for
   * one derived from rhel. Only a redos row has it; an older console sends none.
   */
  build_url: string | null
}

/** What the titlebar shows; a half is null when this console has no such list or refuses it. */
export type BuildWebActivity = {
  baseUrl: string
  notifications: { items: BuildWebNotification[]; unread: number } | null
  tasks: BuildWebConsoleTask[] | null
}

/** IS-10: what the console's /tasks narrows by; the lists are any-of, the days `YYYY-MM-DD`, both included. */
export type BuildWebTaskPageArgs = {
  offset: number
  limit: number
  kinds?: string[]
  /** `active` is queued or running. */
  states?: BuildWebTaskState[]
  user?: string
  from?: string
  to?: string
  q?: string
}

export const BUILD_WEB_TASK_STATES = [
  'active',
  'stale',
  'success',
  'partial',
  'failed',
  'cancelled'
] as const
export type BuildWebTaskState = (typeof BUILD_WEB_TASK_STATES)[number]

/** The kinds the console's filter offers, after its web/src/task-view.ts. */
export const BUILD_WEB_TASK_KINDS = [
  'build',
  'redos',
  'deploy',
  'generate',
  'up',
  'restart',
  'apply',
  'shots',
  'guide',
  'tms',
  'tms-script',
  'tms-scripts',
  'automation',
  'test'
] as const

export const BUILD_WEB_TASK_PAGE_SIZES = [25, 50, 100] as const

/** One page of every task, newest first; `users` are every author, for the filter. */
export type BuildWebTaskPage = {
  tasks: BuildWebConsoleTask[]
  total: number
  users: string[]
}
