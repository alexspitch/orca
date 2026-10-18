import type {
  BuildWebBuildFreshness,
  BuildWebCombo,
  BuildWebRunBuild
} from '../../../../../../shared/build-web-run-types'

// The Build tab's rows, after build-web's build-cells.ts, bulk-actions.ts, image-links.ts and
// build-tests.ts: one row per image, distribution and branch, reconciled from the stored run.

export type CellState = 'pending' | 'queued' | 'building' | 'done'

export type Cell = {
  image: string
  dist: string
  branch: string
  state: CellState
  number: number | null
  url: string | null
  /** The result of a finished row; a row still going has none. */
  status: string | null
  tags: string[]
  pushed: boolean
  mainTagSkipped: boolean
  skippedTags: { ref: string; reason: string }[]
  startedAt: string | null
  testsSkipped: boolean
}

export const cellKey = (c: { image: string; dist: string; branch: string }): string =>
  `${c.image}|${c.dist}|${c.branch}`

const LIVE_STATES: Record<string, CellState> = {
  pending: 'pending',
  queued: 'queued',
  building: 'building'
}
const RANK: Record<CellState, number> = { pending: 0, queued: 1, building: 2, done: 3 }

export function cellsOf(builds: BuildWebRunBuild[]): Record<string, Cell> {
  const out: Record<string, Cell> = {}
  for (const b of builds) {
    const state = LIVE_STATES[b.status] ?? 'done'
    out[cellKey(b)] = {
      image: b.image,
      dist: b.dist,
      branch: b.branch,
      state,
      number: b.number,
      url: b.url,
      status: state === 'done' ? b.status : null,
      tags: b.tags,
      pushed: b.pushed,
      mainTagSkipped: b.main_tag_skipped,
      skippedTags: b.skipped_tags,
      startedAt: b.started_at,
      testsSkipped: b.tests_skipped
    }
  }
  return out
}

/**
 * A fresh read laid over the rows on screen, keeping whichever version of a row got further.
 * A row the read lacks was just added here; a live status for a row shown finished is a new
 * attempt (a rebuild), which is news rather than a step back.
 */
export function mergeCells(
  shown: Record<string, Cell>,
  fetched: Record<string, Cell>
): Record<string, Cell> {
  const out: Record<string, Cell> = { ...fetched }
  for (const [key, cell] of Object.entries(shown)) {
    const fresh = out[key]
    if (!fresh) {
      out[key] = cell
      continue
    }
    if (cell.state === 'done' && fresh.state !== 'done') {
      continue
    }
    if (RANK[cell.state] > RANK[fresh.state]) {
      out[key] = cell
    }
  }
  return out
}

/** How long a build has gone, coarse on purpose: Jenkins has no percentage to show. */
export function elapsedLabel(startedAt: string | null, now: number): string | null {
  if (!startedAt) {
    return null
  }
  const at = Date.parse(startedAt)
  if (Number.isNaN(at)) {
    return null
  }
  const sec = Math.floor((now - at) / 1000)
  if (sec < 0) {
    return null
  }
  if (sec < 60) {
    return `${sec}s`
  }
  const min = Math.floor(sec / 60)
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`
}

/** The row's state chip: the result, `pending`, or a live state with its age. */
export function cellLabel(cell: Cell, now: number): string {
  if (cell.state === 'done') {
    return cell.status ?? 'done'
  }
  if (cell.state === 'pending') {
    return 'pending'
  }
  const age = elapsedLabel(cell.startedAt, now)
  const head =
    cell.state === 'building' ? (cell.number ? `building #${cell.number}` : 'building') : 'queued'
  return age ? `${head} · ${age}` : head
}

/** Results that produced no image, so building again is the answer. */
export const FAILED_STATUSES: ReadonlySet<string> = new Set([
  'FAILURE',
  'ABORTED',
  'UNSTABLE',
  'trigger-failed'
])

/** A row a bulk action can act on: a finished build, whatever it finished as. */
export const isSelectable = (c: Cell): boolean => c.state === 'done'

export const comboOf = (c: Cell): BuildWebCombo => ({
  image: c.image,
  dist: c.dist,
  branch: c.branch
})

export function pickedCells(cells: Cell[], picked: ReadonlySet<string>): Cell[] {
  return cells.filter((c) => picked.has(cellKey(c)))
}

/** Rows whose image is older than its branch — badged «needs rebuild». */
export function staleCells(
  cells: Cell[],
  freshness: Record<string, BuildWebBuildFreshness>
): Cell[] {
  return cells.filter(
    (c) => isSelectable(c) && c.status === 'SUCCESS' && freshness[cellKey(c)]?.state === 'stale'
  )
}

export function failedCells(cells: Cell[]): Cell[] {
  return cells.filter((c) => isSelectable(c) && FAILED_STATUSES.has(c.status ?? ''))
}

/** Rows built and never published — badged «not pushed». */
export function unpushedCells(cells: Cell[]): Cell[] {
  return cells.filter(
    (c) => isSelectable(c) && c.status === 'SUCCESS' && c.tags.length > 0 && !c.pushed
  )
}

/** The image references of the ticked rows, in row order, each once. */
export function imageLinks(cells: Cell[], picked: ReadonlySet<string>): string[] {
  const out: string[] = []
  for (const cell of pickedCells(cells, picked)) {
    for (const tag of cell.tags) {
      if (!out.includes(tag)) {
        out.push(tag)
      }
    }
  }
  return out
}

/**
 * Whether a build started by hand runs the offline suites. A warm-tree branch goes without them
 * unless asked; Jenkins (any other branch) always runs them, so one such branch forces them on.
 */
export function testsChoice(
  branches: string[],
  treeBranches: ReadonlySet<string>,
  runTests: boolean
): { forced: boolean; skipTests: boolean } {
  const forced = branches.some((b) => !treeBranches.has(b))
  return { forced, skipTests: !forced && !runTests }
}

export const RUN_PRODUCTS = ['sa', 'dc', 'ap', 'storage'] as const
export type RunProduct = (typeof RUN_PRODUCTS)[number] | 'other'

/** Which product an image is built on, by its name — CI's own classification. */
export function productOfImage(image: string): RunProduct {
  if (image.startsWith('dc/ib-filestorage-service')) {
    return 'storage'
  }
  if (image.startsWith('dc/')) {
    return 'dc'
  }
  if (image.startsWith('auth-portal/')) {
    return 'ap'
  }
  if (image.startsWith('speechanalytics/') || image.startsWith('common/')) {
    return 'sa'
  }
  return 'other'
}
