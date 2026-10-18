import type { BuildWebMutationResult } from '../../shared/build-web-types'
import type {
  BuildWebTrain,
  BuildWebTrainAction,
  BuildWebTrainActionKind,
  BuildWebTrainImage,
  BuildWebTrainPreview,
  BuildWebTrainRun,
  BuildWebTrainRunPage,
  BuildWebTrainRunStatus,
  BuildWebTrainTicket
} from '../../shared/build-web-train-types'
import { requireBuildWebCredential } from './build-web-connection'
import { buildWebMutation, buildWebRequest } from './build-web-request'
import { numberOf, recordOf, textOf, textOrNull, textsOf } from './build-web-response-fields'

// build-web's trains for Orca's «Trains» page: read, and departed by hand — never edited here.

const enc = encodeURIComponent
const RUN_STATUSES: readonly BuildWebTrainRunStatus[] = [
  'scanning',
  'building',
  'deploying',
  'reporting',
  'done',
  'skipped',
  'failed'
]
const OUTCOMES: readonly BuildWebTrainTicket['outcome'][] = [
  'pending',
  'moved',
  'delivered',
  'skipped',
  'failed'
]
const KINDS: readonly BuildWebTrainActionKind[] = [
  'build',
  'push',
  'deploy',
  'build_task',
  'jira_comment',
  'jira_transition',
  'ticket_skipped',
  'failed'
]

function records(value: unknown): Record<string, unknown>[] {
  return (Array.isArray(value) ? value : [])
    .map(recordOf)
    .filter((v): v is Record<string, unknown> => v !== null)
}

const runStatusOf = (value: unknown): BuildWebTrainRunStatus =>
  RUN_STATUSES.find((s) => s === value) ?? 'failed'

function imageOf(v: Record<string, unknown>): BuildWebTrainImage {
  const current = recordOf(v.current)
  return {
    image: textOf(v.image),
    dist: textOf(v.dist),
    why: textsOf(v.why),
    tickets: textsOf(v.tickets),
    current: current
      ? { build_number: numberOf(current.build_number), image_tags: textsOf(current.image_tags) }
      : null,
    publish: v.publish === true
  }
}

function ticketOf(v: Record<string, unknown>): BuildWebTrainTicket {
  return {
    key: textOf(v.key),
    issue_id: textOrNull(v.issue_id),
    summary: textOf(v.summary),
    outcome: OUTCOMES.find((o) => o === v.outcome) ?? 'pending',
    from: textOrNull(v.from),
    to: textOrNull(v.to),
    reason: textOrNull(v.reason),
    attempts: numberOf(v.attempts),
    waiting: textsOf(v.waiting)
  }
}

function runOf(v: Record<string, unknown>): BuildWebTrainRun {
  return {
    id: textOf(v.id),
    window_at: textOf(v.window_at),
    status: runStatusOf(v.status),
    images: records(v.images).map(imageOf),
    tickets: records(v.tickets).map(ticketOf),
    error: textOrNull(v.error),
    updated_at: textOf(v.updated_at),
    built: numberOf(v.built),
    problems: numberOf(v.problems),
    live_builds: records(v.live_builds).map((b) => ({
      image: textOf(b.image),
      dist: textOf(b.dist),
      status: textOf(b.status),
      build_number: typeof b.build_number === 'number' ? b.build_number : null,
      build_url: textOrNull(b.build_url)
    }))
  }
}

/** Every train, with the stand it serves by name. */
export async function listBuildWebTrains(): Promise<BuildWebTrain[]> {
  const credential = requireBuildWebCredential()
  const [trains, stands] = await Promise.all([
    buildWebRequest({ ...credential, path: '/api/trains' }),
    // Why tolerated: without the stands section the trains still read, by stand id.
    buildWebRequest({ ...credential, path: '/api/stands' }).catch(() => null)
  ])
  const names = new Map(
    records(recordOf(stands)?.stands).map((s) => [textOf(s.id), textOf(s.name)] as const)
  )
  return records(recordOf(trains)?.trains)
    .filter((t) => typeof t.id === 'string')
    .map((t) => {
      const last = recordOf(t.last_run)
      const standId = textOf(t.stand_id)
      return {
        id: textOf(t.id),
        name: textOf(t.name),
        branch: textOf(t.branch),
        dist: textOf(t.dist),
        stand_id: standId,
        stand_name: names.get(standId) || standId,
        hours: (Array.isArray(t.hours) ? t.hours : []).filter(
          (h): h is number => typeof h === 'number'
        ),
        enabled: t.enabled !== false,
        last_window: textOrNull(t.last_window),
        current_window: textOrNull(t.current_window),
        window_due: t.window_due === true,
        last_run: last
          ? {
              id: textOf(last.id),
              status: runStatusOf(last.status),
              error: textOrNull(last.error),
              window_at: textOf(last.window_at)
            }
          : null
      }
    })
}

/** One page of a train's windows; `withActions` leaves out the windows that did nothing. */
export async function listBuildWebTrainRuns(
  trainId: string,
  limit: number,
  offset: number,
  withActions: boolean
): Promise<BuildWebTrainRunPage> {
  const credential = requireBuildWebCredential()
  const query = `limit=${limit}&offset=${offset}${withActions ? '&withActions=1' : ''}`
  const answer = recordOf(
    await buildWebRequest({ ...credential, path: `/api/trains/${enc(trainId)}/runs?${query}` })
  )
  return {
    runs: records(answer?.runs).map(runOf),
    total: numberOf(answer?.total),
    empty: numberOf(answer?.empty)
  }
}

/** A window's journal, newest first. */
export async function listBuildWebTrainActions(
  trainId: string,
  runId: string
): Promise<BuildWebTrainAction[]> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({
      ...credential,
      path: `/api/trains/actions?trainId=${enc(trainId)}&runId=${enc(runId)}&limit=500`
    })
  )
  return records(answer?.actions)
    .filter((a) => typeof a.id === 'string')
    .map((a) => ({
      id: textOf(a.id),
      at: textOf(a.at),
      kind: KINDS.find((k) => k === a.kind) ?? 'failed',
      target: textOf(a.target),
      detail: recordOf(a.detail) ?? {},
      outcome: textOrNull(a.outcome),
      error: textOrNull(a.error)
    }))
}

export async function getBuildWebTrainPreview(trainId: string): Promise<BuildWebTrainPreview> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({ ...credential, path: `/api/trains/${enc(trainId)}/preview` })
  )
  const unbuildable = recordOf(answer?.unbuildable) ?? {}
  return {
    from_status: textOf(answer?.from_status),
    project: textOf(answer?.project),
    images: records(answer?.images).map(imageOf),
    unbuildable: Object.fromEntries(
      Object.entries(unbuildable).map(([image, reason]) => [image, textOf(reason)])
    ),
    tickets: records(answer?.tickets).map((t) => ({
      key: textOf(t.key),
      summary: textOf(t.summary),
      boards: t.boards === true,
      reason: textOrNull(t.reason)
    })),
    problems: textsOf(answer?.problems)
  }
}

/** Depart now; the schedule stays as it is. A window already going answers 409. */
export function runBuildWebTrainNow(trainId: string): Promise<BuildWebMutationResult<true>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    await buildWebRequest({
      ...credential,
      method: 'POST',
      path: `/api/trains/${enc(trainId)}/run`
    })
    return true as const
  })
}
