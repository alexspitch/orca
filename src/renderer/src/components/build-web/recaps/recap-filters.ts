import type {
  BuildWebRecapAutomation,
  BuildWebRecapPage,
  BuildWebRecapQuery,
  BuildWebRecapVersion
} from '../../../../../shared/build-web-recap-types'
import type { BuildWebProduct } from '../../../../../shared/build-web-types'
import { productLabel } from '../build-web-labels'

// The Recaps filters: what the person picked, and the query that asks build-web for it.

export type RecapFilters = {
  product: BuildWebProduct | 'all'
  /** A version id, or 'all'. */
  versionId: string
  /** An automation id, or 'all'. */
  automationId: string
  /** `YYYY-MM-DD` from the date input, or '' for no bound. */
  from: string
  to: string
}

export const NO_RECAP_FILTERS: RecapFilters = {
  product: 'all',
  versionId: 'all',
  automationId: 'all',
  from: '',
  to: ''
}

export const hasRecapFilters = (f: RecapFilters): boolean =>
  f.product !== 'all' ||
  f.versionId !== 'all' ||
  f.automationId !== 'all' ||
  f.from !== '' ||
  f.to !== ''

/** Local midnight of a `YYYY-MM-DD` day, `days` later, as an ISO time; null when it is no day. */
export function dayStartIso(day: string, days = 0): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!m) {
    return null
  }
  const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days)
  return Number.isNaN(start.getTime()) ? null : start.toISOString()
}

/** The page's query: `to` is the start of the day after it, so the whole closing day is in. */
export function recapQuery(f: RecapFilters, page: number, pageSize: number): BuildWebRecapQuery {
  return {
    product: f.product === 'all' ? null : f.product,
    versionId: f.versionId === 'all' ? null : f.versionId,
    automationId: f.automationId === 'all' ? null : f.automationId,
    from: dayStartIso(f.from),
    to: dayStartIso(f.to, 1),
    limit: pageSize,
    offset: page * pageSize
  }
}

/** The versions to pick from: the product's own, or every one named with its product. */
export function recapVersionOptions(
  versions: readonly BuildWebRecapVersion[],
  product: RecapFilters['product']
): { value: string; label: string }[] {
  return versions
    .filter((v) => product === 'all' || v.product === product)
    .map((v) => ({
      value: v.id,
      label: product === 'all' ? `${productLabel(v.product)} ${v.name}` : v.name
    }))
}

/** The automations to pick from: those of the picked product and version, by name. */
export function recapAutomationOptions(
  automations: readonly BuildWebRecapAutomation[],
  f: RecapFilters
): BuildWebRecapAutomation[] {
  return automations.filter(
    (a) =>
      (f.product === 'all' || a.product === f.product) &&
      (f.versionId === 'all' || a.version_id === f.versionId)
  )
}

/** Drops a picked version or automation the other picks no longer offer. */
function settled(f: RecapFilters, facets: BuildWebRecapPage['facets']): RecapFilters {
  const versionKept =
    f.versionId === 'all' ||
    f.product === 'all' ||
    facets.versions.some((v) => v.id === f.versionId && v.product === f.product)
  const next = { ...f, versionId: versionKept ? f.versionId : 'all' }
  const automationKept =
    next.automationId === 'all' ||
    recapAutomationOptions(facets.automations ?? [], next).some((a) => a.id === next.automationId)
  return { ...next, automationId: automationKept ? next.automationId : 'all' }
}

export const withRecapProduct = (
  f: RecapFilters,
  product: RecapFilters['product'],
  facets: BuildWebRecapPage['facets']
): RecapFilters => settled({ ...f, product }, facets)

export const withRecapVersion = (
  f: RecapFilters,
  versionId: string,
  facets: BuildWebRecapPage['facets']
): RecapFilters => settled({ ...f, versionId }, facets)
