import { buildCell, sortByCell } from './build-web-image-sort'
import type {
  BuildWebImageBuild,
  BuildWebImageHistory,
  BuildWebImageHistoryArgs,
  BuildWebImagePage,
  BuildWebImagePageArgs,
  BuildWebImageRow
} from '../../shared/build-web-image-types'

// The Images section's model, after build-web's ImagesView (web/src/views/ImagesView.tsx) and
// image-push.ts: the newest build per image, chip counts, filters and pages. Pure, so main can
// hand a remote client one page instead of every build the console ever recorded.

// Why no sort here: the console sends builds newest first, and places a build with no start time
// (taken over from another run) by its number — re-sorting by time would sink it.
export type ImageCatalog = {
  images: { image: string; product: string }[]
  builds: BuildWebImageBuild[]
  versions: Record<string, string[]>
}

const PAGE_SIZES = [25, 50, 100, 200]

function pageOf<T>(items: T[], page: number, pageSize: number): T[] {
  const size = PAGE_SIZES.includes(pageSize) ? pageSize : 50
  const last = Math.max(0, Math.ceil(items.length / size) - 1)
  const at = Math.min(Math.max(0, page), last)
  return items.slice(at * size, at * size + size)
}

function countBy<T>(items: T[], key: (item: T) => string | null): Record<string, number> {
  const out: Record<string, number> = {}
  for (const item of items) {
    const k = key(item)
    if (k) {
      out[k] = (out[k] ?? 0) + 1
    }
  }
  return out
}

/** Images building right now — one per image and distribution, however many runs hold it. */
export function runningImageCount(catalog: ImageCatalog): number {
  return new Set(
    catalog.builds.filter((b) => b.status === 'running').map((b) => `${b.image}|${b.dist}`)
  ).size
}

/** Each image's newest build passing the version and dists; filters first, as build-web's `lastOf`. */
function newestMatching(
  newest: BuildWebImageBuild[],
  version: string | undefined,
  dists: string[]
): Map<string, BuildWebImageBuild> {
  const last = new Map<string, BuildWebImageBuild>()
  for (const build of newest) {
    if (version && build.product_version !== version) {
      continue
    }
    if (dists.length && !dists.includes(build.dist)) {
      continue
    }
    if (!last.has(build.image)) {
      last.set(build.image, build)
    }
  }
  return last
}

export function imagePage(catalog: ImageCatalog, args: BuildWebImagePageArgs): BuildWebImagePage {
  const newest = catalog.builds
  const dists = args.dists ?? []
  const q = args.q?.trim().toLowerCase()
  // A tag names one build of one image, so text matches the name or any build's ref or tag.
  const hit = q
    ? new Set([
        ...catalog.images.filter((i) => i.image.toLowerCase().includes(q)).map((i) => i.image),
        ...catalog.builds
          .filter((b) => `${b.ref ?? ''}\n${b.tag ?? ''}`.toLowerCase().includes(q))
          .map((b) => b.image)
      ])
    : null
  const textMatches = (image: string) => !hit || hit.has(image)
  const inProducts = (product: string) => !args.products?.length || args.products.includes(product)
  const last = newestMatching(newest, args.version, dists)
  const byFilters: BuildWebImageRow[] = catalog.images
    .map((i) => ({ image: i.image, product: i.product, last: last.get(i.image) ?? null }))
    .filter((row) => (!args.version && !dists.length) || row.last)
    .filter((row) => textMatches(row.image))
  const filtered = byFilters.filter((row) => inProducts(row.product))
  const sort = args.sort
  // Why the row's own name and product: an image with no matching build still has both.
  const rowCell = (row: BuildWebImageRow) =>
    sort === 'image'
      ? row.image
      : sort === 'product'
        ? row.product
        : buildCell(row.last, sort ?? 'image')
  const rows = sort ? sortByCell(filtered, rowCell, args.dir ?? 'asc') : filtered
  const distCounts: Record<string, number> = {}
  for (const dist of new Set(catalog.builds.map((b) => b.dist))) {
    const own = newestMatching(newest, args.version, [dist])
    distCounts[dist] = catalog.images.filter(
      (i) => own.has(i.image) && inProducts(i.product) && textMatches(i.image)
    ).length
  }
  const versionLists = args.products?.length
    ? args.products.map((p) => catalog.versions[p] ?? [])
    : Object.values(catalog.versions)
  return {
    rows: pageOf(rows, args.page, args.pageSize),
    total: rows.length,
    of: catalog.images.length,
    counts: { products: countBy(byFilters, (row) => row.product), dists: distCounts },
    versions: [...new Set(versionLists.flat())]
  }
}

export function imageHistory(
  catalog: ImageCatalog,
  args: BuildWebImageHistoryArgs
): BuildWebImageHistory {
  const own = catalog.builds.filter((b) => b.image === args.image)
  const q = args.q?.trim().toLowerCase()
  const base = own.filter(
    (b) =>
      (!q || (b.tag ?? '').toLowerCase().includes(q)) &&
      (!args.version || b.product_version === args.version)
  )
  const pushedOf = (b: BuildWebImageBuild) => (b.pushed_build_tag ? 'yes' : 'no')
  const filtered = base.filter(
    (b) =>
      (!args.dists?.length || args.dists.includes(b.dist)) &&
      (!args.pushed?.length || args.pushed.includes(pushedOf(b))) &&
      (!args.statuses?.length || args.statuses.includes(b.status))
  )
  const sort = args.sort
  const builds = sort
    ? sortByCell(filtered, (b) => buildCell(b, sort), args.dir ?? 'asc')
    : filtered
  return {
    builds: pageOf(builds, args.page, args.pageSize),
    total: builds.length,
    of: own.length,
    counts: {
      dists: countBy(base, (b) => b.dist),
      pushed: countBy(base, pushedOf),
      statuses: countBy(base, (b) => b.status)
    },
    versions: [...new Set(own.map((b) => b.product_version).filter((v): v is string => Boolean(v)))]
  }
}
