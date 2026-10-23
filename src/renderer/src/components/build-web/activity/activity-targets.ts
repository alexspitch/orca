import type {
  BuildWebConsoleTask,
  BuildWebNotificationRef
} from '../../../../../shared/build-web-activity-types'
import type { BuildWebCardTab } from '../build-web-store'
import type { ChipTone } from '../build-web-tones'

// Where a row of the titlebar's bell or task list leads: a task card in Orca when there is one,
// a console job's live log, else the console's own page in the browser.

export type ActivityTarget =
  | { kind: 'issue'; issueId: string; tab: BuildWebCardTab }
  /** A run: its task's card when it has a task, else its train window or image in Orca. */
  | { kind: 'run'; runId: string; tab: BuildWebCardTab }
  /** A train's window that failed at `at`, on Orca's Trains page; no name, just the page. */
  | { kind: 'train'; trainName: string | null; at: string }
  /** A console job: its log and Cancel, as the console's task list opens them. */
  | { kind: 'job'; jobId: string }
  /** A console path, opened in the browser. */
  | { kind: 'console'; path: string }

/** A target that is a page, in Orca or the browser — everything but a job's log. */
export type PageTarget = Exclude<ActivityTarget, { kind: 'job' }>

// The console's train row: `Поезд «<name>»: не удался шаг «<step>»`.
const TRAIN_NAME = /«([^»]+)»/

/** A build or a push is about the task's build, so the card opens on that tab. */
export function notificationTarget(n: BuildWebNotificationRef): PageTarget | null {
  if (n.kind === 'train' && !n.issue_id && !n.run_id) {
    return {
      kind: 'train',
      trainName: n.title?.match(TRAIN_NAME)?.[1] ?? null,
      at: n.last_at ?? ''
    }
  }
  const tab: BuildWebCardTab = n.kind === 'build' || n.kind === 'push' ? 'build' : 'overview'
  if (n.issue_id) {
    return { kind: 'issue', issueId: n.issue_id, tab }
  }
  return n.run_id ? { kind: 'run', runId: n.run_id, tab: 'build' } : null
}

export function taskTarget(task: BuildWebConsoleTask): ActivityTarget | null {
  if (task.source === 'build') {
    return { kind: 'run', runId: task.id, tab: 'build' }
  }
  if (task.source === 'test') {
    return { kind: 'console', path: `/tests/runs/${encodeURIComponent(task.id)}` }
  }
  return task.has_log ? { kind: 'job', jobId: task.id } : null
}

/** The console's chip colours; `stale` — the worker went quiet — is a thing to look at. */
export function taskTone(status: BuildWebConsoleTask['status']): ChipTone {
  switch (status) {
    case 'success':
      return 'green'
    case 'failed':
      return 'red'
    case 'partial':
    case 'stale':
      return 'amber'
    case 'cancelled':
      return 'neutral'
    case 'queued':
    case 'running':
      return 'blue'
  }
}
