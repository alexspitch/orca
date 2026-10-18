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
import { getBuildWebCredentialGeneration, getStoredBuildWebMetadata } from './credential-store'
import { buildWebMutation, buildWebRequest, type BuildWebResponseLimit } from './build-web-request'
import { BUILD_WEB_CATALOG_TIMEOUT_MS } from '../../shared/build-web-timeouts'
import { consoleUrlOf, numberOf, recordOf, textOf, textOrNull } from './build-web-response-fields'
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

// Why keyed by token generation: another token may not be allowed what this one read.
let cached: { key: string; at: number; catalog: ImageCatalog } | null = null
let inflight: { key: string; epoch: number; promise: Promise<ImageCatalog> } | null = null
/** Bumped by a push, so a fetch that started before it never caches the old catalog. */
let epoch = 0

/** Drop the catalog after a write that changes it (a push, from Images or a task's build). */
export function invalidateBuildWebImageCatalog(): void {
  epoch++
  cached = null
  inflight = null
}

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
    url: consoleUrlOf(textOrNull(v.url), baseUrl)
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

function currentKey(): string {
  const metadata = getStoredBuildWebMetadata()
  return `${metadata?.baseUrl ?? ''}#${getBuildWebCredentialGeneration()}`
}

async function catalog(
  options: { force?: boolean; maxAgeMs?: number; background?: true } = {}
): Promise<ImageCatalog> {
  const credential = requireBuildWebCredential(options.background ? { background: true } : {})
  const maxAgeMs = options.maxAgeMs ?? CATALOG_TTL_MS
  const key = `${credential.baseUrl}#${credential.generation}`
  if (!options.force && cached?.key === key && Date.now() - cached.at < maxAgeMs) {
    return cached.catalog
  }
  if (inflight?.key === key && inflight.epoch === epoch) {
    return inflight.promise
  }
  const started = epoch
  const promise = buildWebRequest({
    ...credential,
    path: '/api/image-builds',
    timeoutMs: BUILD_WEB_CATALOG_TIMEOUT_MS,
    responseLimit: CATALOG_LIMIT
  })
    .then((answer) => imageCatalogOf(answer, credential.baseUrl))
    .then((next) => {
      if (started === epoch && key === currentKey()) {
        cached = { key, at: Date.now(), catalog: next }
      }
      return next
    })
    .finally(() => {
      if (inflight?.promise === promise) {
        inflight = null
      }
    })
  inflight = { key, epoch: started, promise }
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
    invalidateBuildWebImageCatalog()
    return true as const
  })
}

/** @internal - tests start from an empty cache. */
export function _resetBuildWebImageCache(): void {
  invalidateBuildWebImageCatalog()
}
