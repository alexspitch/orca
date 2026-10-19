import type { BuildWebIssueProduct, BuildWebProduct } from './build-web-types'

// build-web's automation reports as Orca's «Recaps» page shows them: the finished ones only.

/** Every report frame's name starts with this, so the host keeps it from navigating. */
export const BUILD_WEB_REPORT_FRAME_NAME_PREFIX = 'orca-build-web-report:'

export type BuildWebRecapVersion = { id: string; product: BuildWebProduct; name: string }

export type BuildWebRecapAutomation = {
  id: string
  name: string
  product: BuildWebProduct
  version_id: string
}

/** One finished run. Product and version are its automation's as they are now. */
export type BuildWebRecap = {
  /** The run; its report is read by this id. */
  id: string
  automation_id: string
  /** The automation's name. */
  name: string
  product: BuildWebIssueProduct
  version: { id: string; name: string; branch: string } | null
  commit: string | null
  trigger: 'manual' | 'scheduled'
  /** Who ran it by hand; null for a scheduled run. */
  started_by: string | null
  finished_at: string
}

export type BuildWebRecapPage = {
  results: BuildWebRecap[]
  /** How many match the filter. */
  total: number
  /** Every product, version and automation that has a report, whatever the filter. */
  facets: {
    products: BuildWebProduct[]
    versions: BuildWebRecapVersion[]
    /** By name; null from a console that cannot narrow to one automation yet. */
    automations: BuildWebRecapAutomation[] | null
  }
}

export type BuildWebRecapQuery = {
  product: BuildWebProduct | null
  versionId: string | null
  /** Absent from a client older than the automation filter. */
  automationId?: string | null
  /** ISO time, inclusive. */
  from: string | null
  /** ISO time, exclusive. */
  to: string | null
  limit: number
  offset: number
}

/** A slice of a report's HTML, from `offset` up to `next`, of `total` characters. */
export type BuildWebRecapReportPiece = { text: string; next: number; total: number }
