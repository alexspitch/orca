import type {
  BuildWebImageAdoptArgs,
  BuildWebImageAdoptResult,
  BuildWebImageBuild,
  BuildWebImageHistory,
  BuildWebImageHistoryArgs,
  BuildWebImagePage,
  BuildWebImagePageArgs,
  BuildWebImagePushArgs,
  BuildWebImageChange,
  BuildWebImageFreshness,
  BuildWebImageSummary
} from '../../shared/build-web-image-types'
import type { BuildWebMutationResult } from '../../shared/build-web-types'
import { requireBuildWebCredential } from './build-web-connection'
import { getBuildWebCredentialGeneration, getStoredBuildWebMetadata } from './credential-store'
import {
  BuildWebApiError,
  buildWebMutation,
  buildWebRequest,
  type BuildWebResponseLimit
} from './build-web-request'
import {
  BUILD_WEB_CATALOG_TIMEOUT_MS,
  BUILD_WEB_LONG_TIMEOUT_MS
} from '../../shared/build-web-timeouts'
import { numberOf, recordOf, sourcesOf, textsOf } from './build-web-response-fields'
import { repoField, repoOfProduct } from '../../shared/build-web-repos'
import {
  failedImageCount,
  imageHistory,
  imagePage,
  runningImageCount,
  type ImageCatalog
} from './build-web-image-model'
import { imageCatalogOf } from './build-web-image-catalog'

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
// Why a cache: the console fetches and walks every image's tags; flipping filters asks again.
const FRESHNESS_TTL_MS = 2 * 60_000
type FreshnessEntry = { at: number; value: Promise<BuildWebImageFreshness | null> }
const freshness = new Map<string, FreshnessEntry>()
let inflight: { key: string; epoch: number; promise: Promise<ImageCatalog> } | null = null
/** Bumped by a push, so a fetch that started before it never caches the old catalog. */
let epoch = 0

/** Drop the catalog after a write that changes it (a push, from Images or a task's build). */
export function invalidateBuildWebImageCatalog(): void {
  epoch++
  cached = null
  inflight = null
  // Why: what changed the catalog — a build, a push — is what the freshness scans answer about.
  freshness.clear()
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

// Why: once a console answers without the summary route, ask it the old way for the session.
let summaryRouteMissing = false

/** The sidebar's numbers; a console older than its summary route has them counted from the catalog. */
export async function buildWebImageSummary(): Promise<BuildWebImageSummary> {
  if (!summaryRouteMissing) {
    const credential = requireBuildWebCredential({ background: true })
    try {
      const answer = recordOf(
        await buildWebRequest({ ...credential, path: '/api/image-builds/summary' })
      )
      return { running: numberOf(answer?.running), failed: numberOf(answer?.failed) }
    } catch (error) {
      if (!(error instanceof BuildWebApiError && error.routeMissing)) {
        throw error
      }
      summaryRouteMissing = true
    }
  }
  const images = await catalog({ maxAgeMs: SUMMARY_TTL_MS, background: true })
  return { running: runningImageCount(images), failed: failedImageCount(images) }
}

const RELEASE_BRANCH = /-release-\d+\.\d+$|^version-\d+\.\d+(\.\d+)?$/

/** Shared code as the console's detect names it: the monorepo's packages, chat-platform's extensions. */
const SHARED_SOURCE = /^(packages|extensions)\//

/**
 * What kind of change makes an image stale. The console names an image's own directories when any
 * changed, and only then the shared packages it depends on — so all-shared means packages only.
 */
export function changeOf(changed: string[]): BuildWebImageChange {
  const packagesOnly = changed.length > 0 && changed.every((source) => SHARED_SOURCE.test(source))
  return { kind: packagesOnly ? 'packages' : 'app', changed }
}

/**
 * The branch a product version is built from: its release branch, else master when master carries
 * that version. Read off the builds, which name both; a task branch never answers.
 */
export function versionBranchOf(
  builds: readonly Pick<BuildWebImageBuild, 'branch' | 'product' | 'product_version'>[],
  product: string,
  version: string
): string | null {
  const counts = new Map<string, number>()
  for (const b of builds) {
    const branch = b.branch.replace(/^origin\//, '')
    if (b.product === product && b.product_version === version) {
      if (RELEASE_BRANCH.test(branch) || branch === 'master') {
        counts.set(branch, (counts.get(branch) ?? 0) + 1)
      }
    }
  }
  const ranked = [...counts].sort(
    ([a, n], [b, m]) => Number(RELEASE_BRANCH.test(b)) - Number(RELEASE_BRANCH.test(a)) || m - n
  )
  return ranked[0]?.[0] ?? null
}

/**
 * Which images of a product version miss its branch's latest changes, from the console's sync
 * scan: an image is to rebuild when its sources, or a shared package it uses, changed since its
 * last build. Null when no build names the version's branch.
 */
export async function scanBuildWebImageFreshness(args: {
  product: string
  version: string
  dist: 'rhel' | 'redos'
  force?: boolean
}): Promise<BuildWebImageFreshness | null> {
  const credential = requireBuildWebCredential()
  const branch = versionBranchOf((await catalog()).builds, args.product, args.version)
  if (!branch) {
    return null
  }
  const repo = repoField(repoOfProduct(args.product))
  const key = JSON.stringify([
    credential.baseUrl,
    credential.generation,
    repo.repo,
    branch,
    args.dist
  ])
  const now = Date.now()
  for (const [k, entry] of freshness) {
    if (now - entry.at > FRESHNESS_TTL_MS) {
      freshness.delete(k)
    }
  }
  const cached = freshness.get(key)
  if (cached && !args.force) {
    return cached.value
  }
  const entry: FreshnessEntry = { at: now, value: Promise.resolve(null) }
  entry.value = buildWebRequest({
    ...credential,
    method: 'POST',
    path: '/api/sync-scan',
    body: { branch, dist: args.dist, ...repo },
    timeoutMs: BUILD_WEB_LONG_TIMEOUT_MS
  }).then(
    (answer) => {
      // Why now: a scan that took a minute is fresh from its answer, not from its question.
      entry.at = Date.now()
      const record = recordOf(answer)
      const sources = sourcesOf(record?.image_sources)
      return {
        branch,
        rebuild: Object.fromEntries(
          textsOf(record?.images).map((image) => [
            image,
            changeOf(Object.hasOwn(sources, image) ? sources[image] : [])
          ])
        ),
        current: textsOf(record?.up_to_date),
        neverBuilt: textsOf(record?.never_built)
      }
    },
    (error: unknown) => {
      // Why: a failed scan is asked again next time, not served for two minutes.
      if (freshness.get(key) === entry) {
        freshness.delete(key)
      }
      throw error
    }
  )
  freshness.set(key, entry)
  return entry.value
}

/** Every build the console recorded, newest first; an older copy will do. */
export async function recentBuildWebImageBuilds(): Promise<BuildWebImageBuild[]> {
  return (await catalog({ maxAgeMs: SUMMARY_TTL_MS, background: true })).builds
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

/** Settle a failed build with the last successful one of its line; the console builds nothing. */
export async function adoptBuildWebImageSuccess(
  args: BuildWebImageAdoptArgs
): Promise<BuildWebMutationResult<BuildWebImageAdoptResult>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: '/api/image-builds/adopt-success',
        body: args
      })
    )
    invalidateBuildWebImageCatalog()
    return { runs: numberOf(answer?.runs), skipped: numberOf(answer?.skipped) }
  })
}

/** @internal - tests start from an empty cache. */
export function _resetBuildWebImageCache(): void {
  invalidateBuildWebImageCatalog()
}
