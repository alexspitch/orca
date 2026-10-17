import type {
  BuildWebImageBuild,
  BuildWebImageHistory,
  BuildWebImageHistoryArgs,
  BuildWebImagePage,
  BuildWebImagePageArgs,
  BuildWebImagePushArgs,
  BuildWebImageSummary
} from '../../shared/build-web-image-types'
import type { BuildWebMutationResult } from '../../shared/build-web-types'
import { requireBuildWebCredential } from './build-web-connection'
import { buildWebMutation, buildWebRequest, type BuildWebResponseLimit } from './build-web-request'
import { BUILD_WEB_CATALOG_TIMEOUT_MS } from '../../shared/build-web-timeouts'
import { numberOf, recordOf, textOf, textOrNull } from './build-web-response-fields'
import {
  imageHistory,
  imagePage,
  runningImageCount,
  type ImageCatalog
} from './build-web-image-model'

// Why a cache: /api/image-builds returns every build the console recorded; paging and the
// sidebar badge both read it, and neither should refetch it on every click. The badge accepts
// an older copy, so on its own it downloads the catalog rarely.
const CATALOG_TTL_MS = 30_000
const SUMMARY_TTL_MS = 120_000
// Why larger than a page: main digests the catalog and only pages of it cross RPC.
const CATALOG_LIMIT: BuildWebResponseLimit = {
  bytes: 64 * 1024 * 1024,
  structuralTokens: 16_000_000
}

let cached: { baseUrl: string; at: number; catalog: ImageCatalog } | null = null
let inflight: { baseUrl: string; promise: Promise<ImageCatalog> } | null = null

const STATUSES: readonly BuildWebImageBuild['status'][] = ['success', 'failed', 'running']

function buildOf(value: unknown): BuildWebImageBuild | null {
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
    url: textOrNull(v.url)
  }
}

export function imageCatalogOf(value: unknown): ImageCatalog {
  const v = recordOf(value)
  const images = (Array.isArray(v?.images) ? v.images : [])
    .map(recordOf)
    .filter((i): i is Record<string, unknown> => i !== null && typeof i.image === 'string')
    .map((i) => ({ image: textOf(i.image), product: textOf(i.product) || 'other' }))
  const builds = (Array.isArray(v?.builds) ? v.builds : [])
    .map(buildOf)
    .filter((b): b is BuildWebImageBuild => b !== null)
  const versions: Record<string, string[]> = {}
  for (const [product, list] of Object.entries(recordOf(v?.versions) ?? {})) {
    versions[product] = Array.isArray(list)
      ? list.filter((x): x is string => typeof x === 'string')
      : []
  }
  return { images, builds, versions }
}

async function catalog(
  options: { force?: boolean; maxAgeMs?: number; background?: true } = {}
): Promise<ImageCatalog> {
  const credential = requireBuildWebCredential(options.background ? { background: true } : {})
  const maxAgeMs = options.maxAgeMs ?? CATALOG_TTL_MS
  if (
    !options.force &&
    cached?.baseUrl === credential.baseUrl &&
    Date.now() - cached.at < maxAgeMs
  ) {
    return cached.catalog
  }
  if (inflight?.baseUrl === credential.baseUrl) {
    return inflight.promise
  }
  const promise = buildWebRequest({
    ...credential,
    path: '/api/image-builds',
    timeoutMs: BUILD_WEB_CATALOG_TIMEOUT_MS,
    responseLimit: CATALOG_LIMIT
  })
    .then(imageCatalogOf)
    .then((next) => {
      cached = { baseUrl: credential.baseUrl, at: Date.now(), catalog: next }
      return next
    })
    .finally(() => {
      inflight = null
    })
  inflight = { baseUrl: credential.baseUrl, promise }
  return promise
}

export async function buildWebImageSummary(): Promise<BuildWebImageSummary> {
  return {
    running: runningImageCount(await catalog({ maxAgeMs: SUMMARY_TTL_MS, background: true }))
  }
}

export async function listBuildWebImages(
  args: BuildWebImagePageArgs & { refresh?: boolean }
): Promise<BuildWebImagePage> {
  return imagePage(await catalog({ force: args.refresh === true }), args)
}

export async function listBuildWebImageBuilds(
  args: BuildWebImageHistoryArgs & { refresh?: boolean }
): Promise<BuildWebImageHistory> {
  return imageHistory(await catalog({ force: args.refresh === true }), args)
}

/** Publish builds of one run to the registry; the main tag only when asked (build tag by default). */
export async function pushBuildWebImages(
  args: BuildWebImagePushArgs
): Promise<BuildWebMutationResult<true>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    await buildWebRequest({
      ...credential,
      method: 'POST',
      path: `/api/runs/${encodeURIComponent(args.runId)}/push`,
      body: { combos: args.combos, moveMainTag: args.moveMainTag }
    })
    cached = null
    return true as const
  })
}

/** @internal - tests start from an empty cache. */
export function _resetBuildWebImageCache(): void {
  cached = null
  inflight = null
}
