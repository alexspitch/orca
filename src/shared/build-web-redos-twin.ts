import type { BuildWebRepo, DistRules } from './build-web-repos'

// IS-230: a redos twin is the row the console adds beside a published rhel row of the monorepo —
// derived from that image (`derive`) or, for an older version, a full build (`full`). It never
// decides a run's fate and is not work: no bulk action builds or publishes it.

export type BuildWebRedosTwin = 'derive' | 'full'

export function twinOf(value: unknown): BuildWebRedosTwin | null {
  return value === 'derive' || value === 'full' ? value : null
}

// Why `!= null`: a row from an older runtime has no `twin` key at all.
export const isTwin = (row: { twin?: BuildWebRedosTwin | null }): boolean => row.twin != null

export function withoutTwins<T extends { twin?: BuildWebRedosTwin | null }>(rows: T[]): T[] {
  return rows.filter((row) => !isTwin(row))
}

export type TwinChipRow = {
  twin: BuildWebRedosTwin | null
  dist: string
  state: 'pending' | 'queued' | 'building' | 'done'
  status: string | null
  pushed: boolean
  /** A twin's reason to wait or its failure; on a rhel row, why it has no twin. */
  note: string | null
}

/**
 * The chip a row shows about its redos, as build-web's Progress draws it. `failed` and `unpublished`
 * offer «Retry»: the console publishes a twin through it, never through a push of its own.
 */
export type TwinChip =
  | { kind: 'deriving' | 'full-building' | 'unpublished' }
  | { kind: 'waiting' | 'failed' | 'no-redos'; tip: string }

export function twinChipOf(row: TwinChipRow): TwinChip | null {
  if (!row.twin) {
    return row.dist === 'rhel' && row.note ? { kind: 'no-redos', tip: row.note } : null
  }
  if (row.state === 'queued' || row.state === 'building') {
    return { kind: row.twin === 'derive' ? 'deriving' : 'full-building' }
  }
  if (row.state === 'pending') {
    return row.note ? { kind: 'waiting', tip: row.note } : null
  }
  if (row.status !== 'SUCCESS') {
    return { kind: 'failed', tip: row.note ?? row.status ?? '' }
  }
  return row.pushed ? null : { kind: 'unpublished' }
}

/**
 * The distribution a run's chip names. A monorepo run from before IS-230 still stores `both`: it reads
 * rhel once its redos rows are all twins, and as stored while it holds a redos build of its own.
 */
export function runDistOf(
  run: {
    repo: BuildWebRepo
    dist_type: string
    builds: { dist: string; twin?: BuildWebRedosTwin | null }[]
  },
  rules: DistRules
): string {
  const ownRedos = run.builds.some((b) => b.dist === 'redos' && !isTwin(b))
  return rules.productsRhelOnly && run.repo === 'products' && !ownRedos ? 'rhel' : run.dist_type
}
