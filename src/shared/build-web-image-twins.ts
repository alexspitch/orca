import type { BuildWebImageBuild, BuildWebImagePair } from './build-web-image-types'

// IS-230.23, after build-web's web/src/image-twins.ts: a redos twin in the image catalog and the rhel
// build it was made for — the same image and branch, `twin_of` naming the rhel build's number.

// Why the fallback: a derived twin carries its rhel build's number, and an older host has no `twin_of`.
const sourceNumberOf = (t: BuildWebImageBuild): number | null =>
  t.twin_of ?? (t.twin === 'derive' ? t.number : null)

/** A rhel build's twin, or a twin's rhel build. */
export function pairOfBuild(
  builds: readonly BuildWebImageBuild[],
  b: BuildWebImageBuild
): BuildWebImageBuild | undefined {
  const same = (x: BuildWebImageBuild) => x.image === b.image && x.branch === b.branch
  if (b.twin) {
    const n = sourceNumberOf(b)
    return builds.find((x) => same(x) && !x.twin && x.dist === 'rhel' && x.number === n)
  }
  if (b.dist !== 'rhel') {
    return undefined
  }
  return builds.find((x) => same(x) && x.twin && sourceNumberOf(x) === b.number)
}

const pairOf = (b: BuildWebImageBuild): BuildWebImagePair => ({
  dist: b.dist,
  number: b.number,
  status: b.status,
  ref: b.ref,
  pushed_build_tag: b.pushed_build_tag,
  twin: b.twin ?? null
})

/** The page's builds with their pairs, looked up over the whole catalog: a pair may be on another page. */
export function withPairs<T extends BuildWebImageBuild | null>(
  builds: readonly BuildWebImageBuild[],
  page: T
): T {
  if (!page) {
    return page
  }
  const pair = pairOfBuild(builds, page)
  return pair ? { ...page, pair: pairOf(pair) } : page
}

/** Where a twin is: on its way, failed, built and not published, published. */
export function twinStateOf(t: BuildWebImagePair): 'running' | 'failed' | 'built' | 'pushed' {
  if (t.status !== 'success') {
    return t.status
  }
  return t.pushed_build_tag ? 'pushed' : 'built'
}

/** What a build's dist cell says of its redos: a rhel build its twin's state, a twin its rhel build. */
export type ImageTwinCell =
  | { kind: 'source'; full: boolean; of: number | null; ref: string | null }
  | {
      kind: 'twin'
      state: ReturnType<typeof twinStateOf>
      full: boolean
      number: number
      ref: string | null
    }

export function imageTwinCellOf(b: BuildWebImageBuild): ImageTwinCell | null {
  if (b.twin) {
    return {
      kind: 'source',
      full: b.twin === 'full',
      of: sourceNumberOf(b),
      ref: b.pair?.ref ?? null
    }
  }
  const t = b.pair
  if (!t?.twin) {
    return null
  }
  return {
    kind: 'twin',
    state: twinStateOf(t),
    full: t.twin === 'full',
    number: t.number,
    ref: t.ref
  }
}
