import { translate } from '@/i18n/i18n'
import type {
  BuildWebTrainAction,
  BuildWebTrainLiveBuild,
  BuildWebTrainRun,
  BuildWebTrainTicket
} from '../../../../../shared/build-web-train-types'
import { trainActionLine } from './train-action-line'

// What one window did, laid out for a person, after build-web's train-window.ts: its images,
// its tasks and its errors — from the run row (final states) and its journal (what happened).

export type WindowImageState = 'built' | 'failed' | 'aborted' | 'kept' | 'building' | 'waiting'

export type WindowImage = {
  /** `image (dist)` — the journal's own build target. */
  target: string
  state: WindowImageState
  build_number: number | null
  build_url: string | null
  tags: string[]
  note: string
}

export type WindowTicket = {
  key: string
  issueId: string | null
  summary: string
  outcome: BuildWebTrainTicket['outcome']
  line: string
  buildTask: string | null
  label: string
  problem: boolean
}

export type WindowReport = {
  images: WindowImage[]
  tickets: WindowTicket[]
  problems: { at: string | null; text: string }[]
  /** Publication, deployment and Jira reports, in the journal's own words. */
  other: string[]
}

const ENDED: ReadonlySet<BuildWebTrainRun['status']> = new Set(['done', 'failed', 'skipped'])
const IN_FLIGHT = new Set(['pending', 'queued', 'building'])

export const isWindowOver = (run: Pick<BuildWebTrainRun, 'status'>): boolean =>
  ENDED.has(run.status)

/** A reason to leave a task alone is not an error; everything else with one is. */
export function isProblem(a: BuildWebTrainAction): boolean {
  if (!a.error) {
    return false
  }
  if (a.kind !== 'ticket_skipped') {
    return true
  }
  return a.outcome === 'failed' || a.outcome === 'retry' || 'want' in a.detail
}

function ticketLabel(t: BuildWebTrainTicket, run: BuildWebTrainRun): string {
  switch (t.outcome) {
    case 'moved':
      return translate('buildWeb.trains.moved', 'moved')
    case 'delivered':
      return translate('buildWeb.trains.delivered', 'delivered')
    case 'skipped':
      return translate('buildWeb.trains.left', 'left')
    case 'failed':
      return translate('buildWeb.trains.notMovedShort', 'not moved')
    case 'pending':
      // A pending task of an ended window is not queued any more: that window will not move it.
      return isWindowOver(run)
        ? translate('buildWeb.trains.notMovedShort', 'not moved')
        : translate('buildWeb.trains.queued', 'queued')
  }
}

function ticketLine(
  t: BuildWebTrainTicket,
  move: BuildWebTrainAction | undefined,
  run: BuildWebTrainRun
): string {
  const reason = t.reason ?? translate('buildWeb.trains.noReason', 'no reason given')
  switch (t.outcome) {
    case 'moved': {
      const from = typeof move?.detail.from === 'string' ? move.detail.from : (t.from ?? '?')
      const to = typeof move?.detail.to === 'string' ? move.detail.to : (t.to ?? '?')
      return from === to
        ? translate('buildWeb.trains.alreadyIn', 'already in «{{to}}»', { to })
        : `«${from}» → «${to}»${t.reason ? ` — ${t.reason}` : ''}`
    }
    case 'delivered':
      return translate('buildWeb.trains.waitsFor', 'delivered, waits for {{branches}}', {
        branches: t.waiting.join(', ') || '—'
      })
    case 'skipped':
      return translate('buildWeb.trains.leftWhy', 'left{{where}}: {{reason}}', {
        where: t.from ? ` in «${t.from}»` : '',
        reason
      })
    case 'failed':
      return translate('buildWeb.trains.failedWhy', 'not moved{{tries}}: {{reason}}', {
        tries: t.attempts ? ` after ${t.attempts} attempts` : '',
        reason
      })
    case 'pending': {
      const tries = t.attempts ? `, ${t.attempts}× — ${t.reason ?? ''}` : ''
      if (isWindowOver(run)) {
        return translate(
          'buildWeb.trains.endedFirst',
          'not moved: the window ended before the Jira step{{tries}}',
          { tries }
        )
      }
      return t.attempts
        ? translate('buildWeb.trains.waitsRetry', 'waits for a retry{{tries}}', { tries })
        : translate('buildWeb.trains.waitsJira', 'waits for the Jira step')
    }
  }
}

function fromBuild(target: string, b: BuildWebTrainAction | undefined, why: string): WindowImage {
  if (!b) {
    return { target, state: 'waiting', build_number: null, build_url: null, tags: [], note: why }
  }
  const tags = Array.isArray(b.detail.tags)
    ? b.detail.tags.filter((t): t is string => typeof t === 'string')
    : []
  return {
    target,
    state: b.outcome === 'SUCCESS' ? 'built' : b.outcome === 'ABORTED' ? 'aborted' : 'failed',
    build_number: typeof b.detail.build_number === 'number' ? b.detail.build_number : null,
    build_url: typeof b.detail.build_url === 'string' ? b.detail.build_url : null,
    // Why: a failed build's tags are the ones it would have made.
    tags: b.outcome === 'SUCCESS' ? tags : [],
    note: why
  }
}

function fromLive(target: string, l: BuildWebTrainLiveBuild, why: string): WindowImage {
  const state: WindowImageState =
    l.status === 'SUCCESS'
      ? 'built'
      : l.status === 'ABORTED'
        ? 'aborted'
        : IN_FLIGHT.has(l.status)
          ? 'building'
          : 'failed'
  return {
    target,
    state,
    build_number: l.build_number,
    build_url: l.build_url,
    tags: [],
    note: why
  }
}

export function windowReport(run: BuildWebTrainRun, journal: BuildWebTrainAction[]): WindowReport {
  const actions = journal.toSorted((a, b) => a.at.localeCompare(b.at))
  const builds = new Map<string, BuildWebTrainAction>()
  for (const a of actions) {
    if (a.kind === 'build') {
      builds.set(a.target, a)
    }
  }
  const images: WindowImage[] = run.images.map((i) => {
    const target = `${i.image} (${i.dist})`
    const b = builds.get(target)
    builds.delete(target)
    if (i.current && !b) {
      return {
        target,
        state: 'kept',
        build_number: i.current.build_number,
        build_url: null,
        tags: i.current.image_tags,
        note: translate(
          'buildWeb.trains.kept',
          'not rebuilt: the tasks’ commits are already in build #{{n}}',
          {
            n: String(i.current.build_number)
          }
        )
      }
    }
    const live = b
      ? undefined
      : run.live_builds.find((l) => l.image === i.image && l.dist === i.dist)
    return live ? fromLive(target, live, i.why.join(', ')) : fromBuild(target, b, i.why.join(', '))
  })
  // A build the journal has but the plan does not stays visible rather than dropped.
  for (const [target, b] of builds) {
    images.push(fromBuild(target, b, ''))
  }

  const moves = new Map<string, BuildWebTrainAction>()
  const tasks = new Map<string, BuildWebTrainAction>()
  for (const a of actions) {
    if (a.kind === 'jira_transition') {
      moves.set(a.target, a)
    } else if (a.kind === 'build_task') {
      tasks.set(a.target, a)
    }
  }
  const tickets = run.tickets.map((t): WindowTicket => {
    const task = tasks.get(t.key)
    return {
      key: t.key,
      issueId: t.issue_id,
      summary: t.summary,
      outcome: t.outcome,
      line: ticketLine(t, moves.get(t.key), run),
      label: ticketLabel(t, run),
      buildTask: task ? trainActionLine(task) : null,
      problem: t.outcome === 'failed' || (t.outcome === 'pending' && t.attempts > 0)
    }
  })

  const problems: WindowReport['problems'] = actions
    .filter(isProblem)
    .map((a) => ({ at: a.at, text: trainActionLine(a) }))
  if (run.status === 'failed' && run.error && !actions.some((a) => a.kind === 'failed')) {
    problems.push({ at: null, text: run.error })
  }
  const other = actions
    .filter(
      (a) =>
        (a.kind === 'push' || a.kind === 'deploy' || a.kind === 'jira_comment') && !isProblem(a)
    )
    .map(trainActionLine)
  return { images, tickets, problems, other }
}

/** The builds of a window still going, for the history row. */
export function buildsInFlight(live: BuildWebTrainLiveBuild[]): BuildWebTrainLiveBuild[] {
  return live.filter((l) => IN_FLIGHT.has(l.status))
}

/** A window's result in one line for the history table. */
export function windowSummary(run: BuildWebTrainRun): string {
  const rebuilt = run.images.filter((i) => !i.current).length
  const kept = run.images.length - rebuilt
  const parts = [
    rebuilt
      ? translate('buildWeb.trains.builtOf', 'built {{n}} of {{of}}', {
          n: String(run.built),
          of: String(rebuilt)
        })
      : '',
    kept ? translate('buildWeb.trains.keptCount', 'not rebuilt {{n}}', { n: String(kept) }) : '',
    run.problems
      ? translate('buildWeb.trains.errorsCount', 'errors {{n}}', { n: String(run.problems) })
      : ''
  ]
  return parts.filter(Boolean).join(', ') || '—'
}

/** The tasks of a window in one line: how many moved, delivered, left. */
export function ticketsSummary(run: BuildWebTrainRun): string {
  const moved = run.tickets.filter((t) => t.outcome === 'moved').length
  const delivered = run.tickets.filter((t) => t.outcome === 'delivered').length
  const left = run.tickets.length - moved - delivered
  return (
    [
      moved ? translate('buildWeb.trains.movedCount', 'moved {{n}}', { n: String(moved) }) : '',
      delivered
        ? translate('buildWeb.trains.deliveredCount', 'delivered {{n}}', { n: String(delivered) })
        : '',
      left ? translate('buildWeb.trains.leftCount', 'left {{n}}', { n: String(left) }) : ''
    ]
      .filter(Boolean)
      .join(', ') || '—'
  )
}
