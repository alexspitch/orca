// build-web's build trains, as Orca's «Trains» page shows them: scheduled windows that build what
// accumulated, put it on a stand and move the tasks that rode along on to testing.

export type BuildWebTrainRunStatus =
  | 'scanning'
  | 'building'
  | 'deploying'
  | 'reporting'
  | 'done'
  | 'skipped'
  | 'failed'

export type BuildWebTrain = {
  id: string
  name: string
  branch: string
  dist: string
  stand_id: string
  /** The stand's name, looked up on the console; the id when it has none. */
  stand_name: string
  /** The hours a window opens at, in the console's own time zone. */
  hours: number[]
  enabled: boolean
  last_window: string | null
  current_window: string | null
  /** The current window has not been taken yet. */
  window_due: boolean
  last_run: {
    id: string
    status: BuildWebTrainRunStatus
    error: string | null
    window_at: string
  } | null
}

export type BuildWebTrainImage = {
  image: string
  dist: string
  why: string[]
  tickets: string[]
  /** A CI build that already holds every passenger's commits; the window does not rebuild it. */
  current: { build_number: number; image_tags: string[] } | null
  /** With `current`: the window publishes that build instead. */
  publish: boolean
}

export type BuildWebTrainTicket = {
  key: string
  issue_id: string | null
  summary: string
  outcome: 'pending' | 'moved' | 'delivered' | 'skipped' | 'failed'
  from: string | null
  to: string | null
  reason: string | null
  attempts: number
  waiting: string[]
}

export type BuildWebTrainLiveBuild = {
  image: string
  dist: string
  status: string
  build_number: number | null
  build_url: string | null
}

export type BuildWebTrainRun = {
  id: string
  window_at: string
  status: BuildWebTrainRunStatus
  images: BuildWebTrainImage[]
  tickets: BuildWebTrainTicket[]
  error: string | null
  updated_at: string
  built: number
  problems: number
  live_builds: BuildWebTrainLiveBuild[]
}

export type BuildWebTrainRunPage = { runs: BuildWebTrainRun[]; total: number; empty: number }

export type BuildWebTrainActionKind =
  | 'build'
  | 'push'
  | 'deploy'
  | 'build_task'
  | 'jira_comment'
  | 'jira_transition'
  | 'ticket_skipped'
  | 'failed'

/** One thing a train did, written when it happened. */
export type BuildWebTrainAction = {
  id: string
  at: string
  kind: BuildWebTrainActionKind
  target: string
  detail: Record<string, unknown>
  outcome: string | null
  error: string | null
}

/** What would board if the window opened now. */
export type BuildWebTrainPreview = {
  from_status: string
  project: string
  images: BuildWebTrainImage[]
  unbuildable: Record<string, string>
  tickets: { key: string; summary: string; boards: boolean; reason: string | null }[]
  problems: string[]
}
