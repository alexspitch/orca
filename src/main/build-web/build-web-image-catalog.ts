import { twinOf } from '../../shared/build-web-redos-twin'
import type { BuildWebImageBuild } from '../../shared/build-web-image-types'
import type { ImageCatalog } from './build-web-image-model'
import {
  consoleUrlOf,
  numberOf,
  numberOrNull,
  recordOf,
  textOf,
  textOrNull
} from './build-web-response-fields'

// /api/image-builds as main keeps it: the console's records, each checked, with its log's URL made absolute.

const STATUSES: readonly BuildWebImageBuild['status'][] = ['success', 'failed', 'running']

function buildOf(value: unknown, baseUrl: string): BuildWebImageBuild | null {
  const v = recordOf(value)
  const status = STATUSES.find((s) => s === v?.status)
  if (!v || !status || typeof v.image !== 'string' || typeof v.run_id !== 'string') {
    return null
  }
  return {
    image: v.image,
    dist: textOf(v.dist),
    branch: textOf(v.branch),
    number: numberOf(v.number),
    status,
    raw_status: textOf(v.raw_status),
    ref: textOrNull(v.ref),
    tag: textOrNull(v.tag),
    version: textOrNull(v.version),
    product: textOf(v.product),
    product_version: textOrNull(v.product_version),
    at: textOrNull(v.at),
    pushed_build_tag: v.pushed_build_tag === true,
    pushed_main_tag: v.pushed_main_tag === true,
    main_tag_on: textOrNull(v.main_tag_on),
    run_id: v.run_id,
    url: consoleUrlOf(textOrNull(v.url), baseUrl),
    twin: twinOf(v.twin),
    twin_of: numberOrNull(v.twin_of)
  }
}

export function imageCatalogOf(value: unknown, baseUrl: string): ImageCatalog {
  const v = recordOf(value)
  const images = (Array.isArray(v?.images) ? v.images : [])
    .map(recordOf)
    .filter((i): i is Record<string, unknown> => i !== null && typeof i.image === 'string')
    .map((i) => ({ image: textOf(i.image), product: textOf(i.product) || 'other' }))
  const builds = (Array.isArray(v?.builds) ? v.builds : [])
    .map((b) => buildOf(b, baseUrl))
    .filter((b): b is BuildWebImageBuild => b !== null)
  const versions: Record<string, string[]> = {}
  for (const [product, list] of Object.entries(recordOf(v?.versions) ?? {})) {
    versions[product] = Array.isArray(list)
      ? list.filter((x): x is string => typeof x === 'string')
      : []
  }
  return { images, builds, versions }
}
