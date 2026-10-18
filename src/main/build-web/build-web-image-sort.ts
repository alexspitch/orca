import type { BuildWebImageBuild, BuildWebImageSort } from '../../shared/build-web-image-types'

// Sorting a column of the image tables. Empty cells go last either way, so flipping the direction
// does not bury the rows that have a value under the ones that have none.

type Cell = string | number | null

const STATUS_RANK: Record<BuildWebImageBuild['status'], number> = {
  failed: 0,
  running: 1,
  success: 2
}

/** build-web's «В repo» order: not pushed, build tag only, pushed; nothing to push has no value. */
function registryRank(b: BuildWebImageBuild): number | null {
  if (b.status !== 'success' || !b.ref) {
    return null
  }
  return b.pushed_build_tag && b.pushed_main_tag ? 2 : b.pushed_build_tag ? 1 : 0
}

/** One build's value in a column; `version` reads the product version when the image has none. */
export function buildCell(b: BuildWebImageBuild | null, sort: BuildWebImageSort): Cell {
  if (!b) {
    return null
  }
  switch (sort) {
    case 'image':
      return b.image
    case 'product':
      return b.product
    case 'version':
      return b.version ?? b.product_version
    case 'dist':
      return b.dist
    case 'tag':
      return b.tag
    case 'branch':
      return b.branch
    case 'at':
      return b.at
    case 'status':
      return STATUS_RANK[b.status]
    case 'registry':
      return registryRank(b)
  }
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** A stable sort on one column; numbers compare as numbers, text naturally (3.10 after 3.9). */
export function sortByCell<T>(items: T[], cell: (item: T) => Cell, dir: 'asc' | 'desc'): T[] {
  const sign = dir === 'asc' ? 1 : -1
  return items
    .map((item, index) => ({ item, index, value: cell(item) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) {
        return a.value === b.value ? a.index - b.index : a.value === null ? 1 : -1
      }
      const order =
        typeof a.value === 'number' && typeof b.value === 'number'
          ? a.value - b.value
          : collator.compare(String(a.value), String(b.value))
      return order === 0 ? a.index - b.index : order * sign
    })
    .map(({ item }) => item)
}
