import type {
  BuildWebActivity,
  BuildWebConsoleTask,
  BuildWebConsoleTaskStatus,
  BuildWebNotification,
  BuildWebNotificationSeverity
} from '../../shared/build-web-activity-types'
import type { BuildWebMutationResult } from '../../shared/build-web-types'
import { requireBuildWebCredential } from './build-web-connection'
import { BuildWebApiError, buildWebMutation, buildWebRequest } from './build-web-request'
import { numberOf, recordOf, recordsOf, textOf, textOrNull } from './build-web-response-fields'

// build-web's bell (/api/notifications) and task counter (/api/tasks) for Orca's titlebar.

const NOTIFICATION_LIMIT = 30
// Why: finished rows are capped per source by the console; active ones never are.
const TASK_LIMIT = 10
// Why: the menu shows three lines; a console error body runs to 4000 chars and is polled.
const BODY_MAX_CHARS = 600

const SEVERITIES: readonly BuildWebNotificationSeverity[] = ['error', 'warning', 'info']
const SOURCES: readonly BuildWebConsoleTask['source'][] = ['deploy', 'build', 'test']
const STATUSES: readonly BuildWebConsoleTaskStatus[] = [
  'queued',
  'running',
  'stale',
  'success',
  'partial',
  'failed',
  'cancelled'
]

const oneOf = <T extends string>(values: readonly T[], value: unknown): T | null =>
  values.find((v) => v === value) ?? null

function notificationOf(r: Record<string, unknown>): BuildWebNotification | null {
  if (typeof r.id !== 'string') {
    return null
  }
  const body = textOf(r.body)
  return {
    id: r.id,
    kind: textOf(r.kind),
    severity: oneOf(SEVERITIES, r.severity) ?? 'error',
    title: textOf(r.title),
    body: body.length > BODY_MAX_CHARS ? `${body.slice(0, BODY_MAX_CHARS - 1)}…` : body,
    issue_id: textOrNull(r.issue_id),
    issue_key: textOrNull(r.issue_key),
    run_id: textOrNull(r.run_id),
    count: Math.max(1, numberOf(r.count, 1)),
    last_at: textOf(r.last_at),
    unread: r.unread === true
  }
}

/** A row of a source or status this Orca does not know is left out: it could not open it. */
function taskOf(r: Record<string, unknown>): BuildWebConsoleTask | null {
  const source = oneOf(SOURCES, r.source)
  const status = oneOf(STATUSES, r.status)
  if (!source || !status || typeof r.id !== 'string') {
    return null
  }
  return {
    key: textOf(r.key) || `${source}:${r.id}`,
    source,
    id: r.id,
    kind: textOf(r.kind),
    title: textOf(r.title),
    detail: textOrNull(r.detail),
    status,
    active: r.active === true,
    created_at: textOf(r.created_at),
    started_at: textOrNull(r.started_at),
    finished_at: textOrNull(r.finished_at),
    has_log: r.has_log === true,
    build_url: textOrNull(r.build_url)
  }
}

/** A console without the list, or a person without the right, shows no icon — not an error. */
async function unlessRefused<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read
  } catch (error) {
    if (error instanceof BuildWebApiError && (error.status === 403 || error.routeMissing)) {
      return null
    }
    throw error
  }
}

/** The bell's rows and unread count, and the console's task list, in one round-trip. */
export async function readBuildWebActivity(): Promise<BuildWebActivity> {
  // Why background: the titlebar polls from launch; a Keychain prompt nobody asked for is worse.
  const credential = requireBuildWebCredential({ background: true })
  const [notes, tasks] = await Promise.all([
    unlessRefused(
      buildWebRequest({ ...credential, path: `/api/notifications?limit=${NOTIFICATION_LIMIT}` })
    ),
    unlessRefused(buildWebRequest({ ...credential, path: `/api/tasks?limit=${TASK_LIMIT}` }))
  ])
  const noteAnswer = recordOf(notes)
  return {
    baseUrl: credential.baseUrl,
    notifications: noteAnswer
      ? {
          items: recordsOf(noteAnswer.notifications)
            .map(notificationOf)
            .filter((n): n is BuildWebNotification => n !== null),
          unread: Math.max(0, numberOf(noteAnswer.unread))
        }
      : null,
    tasks:
      tasks === null
        ? null
        : recordsOf(recordOf(tasks)?.tasks)
            .map(taskOf)
            .filter((t): t is BuildWebConsoleTask => t !== null)
  }
}

/** Everything under the bell up to now is read — for this person only. */
export function markBuildWebNotificationsSeen(): Promise<BuildWebMutationResult<true>> {
  return buildWebMutation(async () => {
    await buildWebRequest({
      ...requireBuildWebCredential(),
      method: 'POST',
      path: '/api/notifications/seen'
    })
    return true as const
  })
}

/** Empty this person's list until the next row arrives; other people keep theirs. */
export function clearBuildWebNotifications(): Promise<BuildWebMutationResult<true>> {
  return buildWebMutation(async () => {
    await buildWebRequest({
      ...requireBuildWebCredential(),
      method: 'POST',
      path: '/api/notifications/clear'
    })
    return true as const
  })
}
