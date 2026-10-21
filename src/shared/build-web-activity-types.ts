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
  created_at: string
  started_at: string | null
  finished_at: string | null
  /** A console job (a stand's, a guide's, the test library's): its log is read as a job by its id. */
  has_log: boolean
}

/** What the titlebar shows; a half is null when this console has no such list or refuses it. */
export type BuildWebActivity = {
  baseUrl: string
  notifications: { items: BuildWebNotification[]; unread: number } | null
  tasks: BuildWebConsoleTask[] | null
}
