// build-web's Images section, as Orca shows it: the console's own records (snake_case), plus the
// page model main computes so a remote client receives one page, never the whole history.

export type BuildWebImageBuildStatus = 'success' | 'failed' | 'running'

export type BuildWebImageBuild = {
  image: string
  dist: string
  branch: string
  number: number
  status: BuildWebImageBuildStatus
  raw_status: string
  ref: string | null
  tag: string | null
  version: string | null
  product: string
  product_version: string | null
  at: string | null
  pushed_build_tag: boolean
  pushed_main_tag: boolean
  main_tag_on: string | null
  run_id: string
  /** The build's log in build-web or Jenkins; opened in the browser. */
  url: string | null
}

export type BuildWebImageRow = { image: string; product: string; last: BuildWebImageBuild | null }

/** Columns the image tables sort by; main sorts the whole catalog before it cuts a page. */
export const BUILD_WEB_IMAGE_SORTS = [
  'image',
  'product',
  'version',
  'dist',
  'tag',
  'branch',
  'at',
  'status',
  'registry'
] as const
export type BuildWebImageSort = (typeof BUILD_WEB_IMAGE_SORTS)[number]

export type BuildWebImageFilters = {
  sort?: BuildWebImageSort
  dir?: 'asc' | 'desc'
  q?: string
  products?: string[]
  dists?: string[]
  /** A product version (`3.1`); absent for all. */
  version?: string
}

export type BuildWebImagePageArgs = BuildWebImageFilters & { page: number; pageSize: number }

export type BuildWebImagePage = {
  rows: BuildWebImageRow[]
  /** Rows matching the filters, and all rows. */
  total: number
  of: number
  counts: { products: Record<string, number>; dists: Record<string, number> }
  versions: string[]
}

export type BuildWebImageHistoryArgs = BuildWebImageFilters & {
  image: string
  pushed?: ('yes' | 'no')[]
  statuses?: BuildWebImageBuildStatus[]
  page: number
  pageSize: number
}

export type BuildWebImageHistory = {
  builds: BuildWebImageBuild[]
  total: number
  of: number
  counts: {
    dists: Record<string, number>
    pushed: Record<string, number>
    statuses: Record<string, number>
  }
  versions: string[]
}

/** What the sidebar badge shows: images building right now. */
export type BuildWebImageSummary = { running: number }

export type BuildWebImagePushArgs = {
  runId: string
  combos: { image: string; dist: string; branch: string }[]
  moveMainTag: boolean
}
