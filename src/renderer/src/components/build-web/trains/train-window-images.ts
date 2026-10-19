import { translate } from '@/i18n/i18n'
import type {
  BuildWebTrainAction,
  BuildWebTrainLiveBuild,
  BuildWebTrainRun
} from '../../../../../shared/build-web-train-types'

// The images of one window: what became of each, from its plan, its journal, the builds still
// going and the window's build run (whether each is in the registry).

export type WindowImageState =
  | 'built'
  | 'failed'
  | 'aborted'
  | 'kept'
  | 'building'
  | 'waiting'
  | 'held'

export type WindowImage = {
  /** `image (dist)` — the journal's own build target. */
  target: string
  state: WindowImageState
  build_number: number | null
  build_url: string | null
  tags: string[]
  note: string
  /** Whether the registry holds it: from the window's build run, else its journal; null if unknown. */
  pushed: boolean | null
}

const IN_FLIGHT = new Set(['pending', 'queued', 'building'])

function fromBuild(
  target: string,
  b: BuildWebTrainAction | undefined,
  why: string,
  pushed: boolean | null
): WindowImage {
  if (!b) {
    return {
      target,
      state: 'waiting',
      build_number: null,
      build_url: null,
      tags: [],
      note: why,
      pushed: null
    }
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
    note: why,
    pushed: b.outcome === 'SUCCESS' ? pushed : null
  }
}

function fromLive(
  target: string,
  l: BuildWebTrainLiveBuild,
  why: string,
  pushed: boolean | null
): WindowImage {
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
    note: why,
    pushed: state === 'built' ? pushed : null
  }
}

/**
 * `pushed`: the window's build run, by `image (dist)`. It is what a push writes, whenever it happens;
 * the journal records only the pushes made while the window was building.
 */
export function windowImages(
  run: BuildWebTrainRun,
  actions: BuildWebTrainAction[],
  pushed: ReadonlyMap<string, boolean>
): WindowImage[] {
  const builds = new Map<string, BuildWebTrainAction>()
  const published = new Set<string>()
  for (const a of actions) {
    if (a.kind === 'build') {
      builds.set(a.target, a)
    } else if (a.kind === 'push' && a.outcome === 'published') {
      published.add(a.target)
    }
  }
  const pushedOf = (target: string): boolean | null =>
    pushed.get(target) ?? (published.has(target) ? true : null)
  const images: WindowImage[] = run.images.map((i) => {
    const target = `${i.image} (${i.dist})`
    const b = builds.get(target)
    builds.delete(target)
    if (i.held) {
      return {
        target,
        state: 'held',
        build_number: null,
        build_url: null,
        tags: [],
        note: translate(
          'buildWeb.trains.held',
          'held: red tests in {{workspace}} since {{since}}',
          {
            workspace: i.held.workspace,
            since: (i.held.first_suspect ?? i.held.red_commit).slice(0, 10)
          }
        ),
        pushed: null
      }
    }
    if (i.current && !b) {
      // Why either: the build run says "published by this window"; the scan, "in the registry".
      const fromRun = pushed.get(target)
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
        ),
        pushed: fromRun === true || i.current.pushed === true ? true : (i.current.pushed ?? null)
      }
    }
    const live = b
      ? undefined
      : run.live_builds.find((l) => l.image === i.image && l.dist === i.dist)
    const why = i.why.join(', ')
    return live
      ? fromLive(target, live, why, pushedOf(target))
      : fromBuild(target, b, why, pushedOf(target))
  })
  // A build the journal has but the plan does not stays visible rather than dropped.
  for (const [target, b] of builds) {
    images.push(fromBuild(target, b, '', pushedOf(target)))
  }
  return images
}

/** The builds of a window still going, for the history row. */
export function buildsInFlight(live: BuildWebTrainLiveBuild[]): BuildWebTrainLiveBuild[] {
  return live.filter((l) => IN_FLIGHT.has(l.status))
}
