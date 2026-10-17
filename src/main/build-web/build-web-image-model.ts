import type {
  BuildWebImageBuild,
  BuildWebImageFilters,
  BuildWebImageHistory,
  BuildWebImageHistoryArgs,
  BuildWebImagePage,
  BuildWebImagePageArgs,
  BuildWebImageRow
} from '../../shared/build-web-image-types'

// The Images section's model, after build-web's ImagesView (web/src/views/ImagesView.tsx) and
// image-push.ts: the newest build per image, chip counts, filters and pages. Pure, so main can
// hand a remote client one page instead of every build the console ever recorded.

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

const newestFirst = (a: BuildWebImageBuild, b: BuildWebImageBuild) =>
  (b.at ?? '').localeCompare(a.at ?? '')

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

function matches(build: BuildWebImageBuild | null, filters: BuildWebImageFilters): boolean {
  if (filters.dists?.length && (!build || !filters.dists.includes(build.dist))) {
    return false
  }
  return (
    !filters.version ||
    build?.version === filters.version ||
    build?.product_version === filters.version
  )
}

export function imagePage(catalog: ImageCatalog, args: BuildWebImagePageArgs): BuildWebImagePage {
  const latest = new Map<string, BuildWebImageBuild>()
  for (const build of [...catalog.builds].sort(newestFirst)) {
    if (!latest.has(build.image)) {
      latest.set(build.image, build)
    }
  }
  const all: BuildWebImageRow[] = catalog.images.map((i) => ({
    image: i.image,
    product: i.product,
    last: latest.get(i.image) ?? null
  }))
  const q = args.q?.trim().toLowerCase()
  const byText = all.filter(
    (row) =>
      !q || row.image.toLowerCase().includes(q) || (row.last?.tag ?? '').toLowerCase().includes(q)
  )
  const byFilters = byText.filter((row) => matches(row.last, args))
  const rows = byFilters.filter(
    (row) => !args.products?.length || args.products.includes(row.product)
  )
  const versionLists = args.products?.length
    ? args.products.map((p) => catalog.versions[p] ?? [])
    : Object.values(catalog.versions)
  return {
    rows: pageOf(rows, args.page, args.pageSize),
    total: rows.length,
    of: all.length,
    counts: {
      products: countBy(byFilters, (row) => row.product),
      dists: countBy(
        byText.filter((row) => !args.products?.length || args.products.includes(row.product)),
        (row) => row.last?.dist ?? null
      )
    },
    versions: [...new Set(versionLists.flat())]
  }
}

export function imageHistory(
  catalog: ImageCatalog,
  args: BuildWebImageHistoryArgs
): BuildWebImageHistory {
  const own = catalog.builds.filter((b) => b.image === args.image).sort(newestFirst)
  const q = args.q?.trim().toLowerCase()
  const base = own.filter(
    (b) =>
      (!q || (b.tag ?? '').toLowerCase().includes(q)) &&
      (!args.version || b.product_version === args.version)
  )
  const pushedOf = (b: BuildWebImageBuild) => (b.pushed_build_tag ? 'yes' : 'no')
  const builds = base.filter(
    (b) =>
      (!args.dists?.length || args.dists.includes(b.dist)) &&
      (!args.pushed?.length || args.pushed.includes(pushedOf(b))) &&
      (!args.statuses?.length || args.statuses.includes(b.status))
  )
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
