// build-web's watch, as Orca's «Testing» page shows it: tasks in testing whose images are not
// built or not published yet, and who publishes them when the task reaches Done.

/** `jira`: the watcher, on the Jira move; `console`: a task without a Jira key, on done here. */
export type BuildWebWatchAuto = 'jira' | 'console' | 'none'

export type BuildWebWatchRun = {
  id: string
  branch: string
  created_at: string
  /** Built, not published. */
  unpushed: number
  /** Never built: built on the move to Done, then published. */
  pending: number
  /** Published under the build tag only; the version tag has not moved yet. */
  main_tag_left: number
  /** Queued or building now. */
  in_flight: number
  /** The run on the console, for a run no task of the console owns. */
  console_url: string | null
}

export type BuildWebWatchEntry = {
  /** The Jira key, or the console's own task key when the task has none. */
  ticket: string
  /** The monitored status: Testing or TESTING_EXTERNAL. */
  status: string
  status_changed_at: string
  /** Null for a task the watcher never asks Jira about. */
  checked_at: string | null
  last_action: string | null
  last_action_at: string | null
  issue_id: string | null
  issue_key: string | null
  run: BuildWebWatchRun | null
  jira_key: string | null
  /** `<jira>/browse/<key>`; null without a key or when the console did not name its Jira. */
  jira_url: string | null
  title: string | null
  /** The console's own status key; null from a console that does not send it. */
  task_status: string | null
  jira_status: string | null
  /** Null from a console that does not say. */
  auto: BuildWebWatchAuto | null
  /** The watcher holds the row already; false joins at the next check, null unknown. */
  armed: boolean | null
}

export type BuildWebWatchState = {
  enabled: boolean
  interval_ms: number
  from_statuses: string[]
  to_statuses: string[]
  entries: BuildWebWatchEntry[]
}

/** What one pass did; `busy` when another pass was running and this one did nothing. */
export type BuildWebWatchTick = {
  checked: number
  transitions: number
  images: number
  builds: number
  busy: boolean
}

export type BuildWebWatchCheck = BuildWebWatchState & {
  result: BuildWebWatchTick
}
