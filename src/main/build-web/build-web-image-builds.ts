import type {
  BuildWebImageBuildArgs,
  BuildWebImageGroupBuildArgs
} from '../../shared/build-web-image-types'
import type { BuildWebLogPiece, BuildWebRun } from '../../shared/build-web-run-types'
import type { BuildWebMutationResult } from '../../shared/build-web-types'
import { requireBuildWebCredential } from './build-web-connection'
import { invalidateBuildWebImageCatalog } from './build-web-images'
import { buildWebMutation, buildWebRequest } from './build-web-request'
import { numberOf, recordOf, textOf, textOrNull, textsOf } from './build-web-response-fields'
import { runOf } from './build-web-runs'
import { choosesDist, repoField, repoOfImage } from '../../shared/build-web-repos'

// Building images from Images, after build-web's ImageBuildDialog: a run for the images on the
// chosen branch, then their builds started at once (build-web leaves that to its Progress page).

const PRODUCTS_WITH_RELEASES = new Set(['sa', 'dc', 'ap', 'storage', 'cp', 'tools'])
const enc = encodeURIComponent
const collator = new Intl.Collator(undefined, { numeric: true })
const TEST_JOB_LOG = /^\/api\/tests\/runs\/[^/?#]+\/jobs\/[^/?#]+\/log$/

/** master and the product's release branches, the newest release first; `other` has only master. */
export async function listBuildWebVersionBranches(product: string): Promise<string[]> {
  if (!PRODUCTS_WITH_RELEASES.has(product)) {
    return ['master']
  }
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({
      ...credential,
      path: `/api/tms/versions/branches?product=${enc(product)}`
    })
  )
  return textsOf(answer?.branches).toSorted((a, b) =>
    a === 'master' ? 1 : b === 'master' ? -1 : collator.compare(b, a)
  )
}

export function startBuildWebImageBuild(
  args: BuildWebImageBuildArgs
): Promise<BuildWebMutationResult<{ runId: string; note?: string }>> {
  const { image, ...choice } = args
  return startBuildWebImageGroupBuild({ ...choice, images: [image] })
}

/** One run for the images on the chosen version, its builds started at once. */
export function startBuildWebImageGroupBuild(
  args: BuildWebImageGroupBuildArgs
): Promise<BuildWebMutationResult<{ runId: string; note?: string }>> {
  return buildWebMutation(async () => {
    const images = [...new Set(args.images)]
    const repos = new Set(images.map(repoOfImage))
    // Why: a run's branch belongs to one repository; chat-platform's master is not the monorepo's.
    if (repos.size !== 1) {
      throw new Error(
        'Build the monorepo’s images and Chat Platform’s apart: a run is of one repository'
      )
    }
    const repo = repoOfImage(images[0])
    // Why: the monorepo builds rhel only — its redos comes with publication (IS-230).
    const dist = choosesDist(repo) ? args.dist : 'rhel'
    const credential = requireBuildWebCredential()
    const made = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: '/api/runs',
        body: {
          branch: args.branch,
          ticket: args.ticket || null,
          images,
          ...repoField(repo),
          distType: dist,
          pushToRepo: false,
          detected: null
        }
      })
    )
    const runId = textOf(made?.id)
    if (!runId) {
      throw new Error('build-web made no run for the build')
    }
    const dists = dist === 'both' ? ['rhel', 'redos'] : [dist]
    await buildWebRequest({
      ...credential,
      method: 'POST',
      path: `/api/runs/${enc(runId)}/builds`,
      body: {
        combos: images.flatMap((image) =>
          dists.map((dist) => ({ image, dist, branch: args.branch }))
        ),
        ...(args.skipTests ? { skipTests: true } : {})
      }
    })
    // Why: the catalog behind Images and the badge must show the new builds as running.
    invalidateBuildWebImageCatalog()
    const note = textOrNull(made?.note)
    return { runId, ...(note ? { note } : {}) }
  })
}

/** A run with its builds, read while they go; null when the console no longer has it. */
export async function getBuildWebRun(runId: string): Promise<BuildWebRun | null> {
  const credential = requireBuildWebCredential()
  return runOf(
    await buildWebRequest({ ...credential, path: `/api/runs/${enc(runId)}` }),
    credential.baseUrl
  )
}

/**
 * A piece of a build log, as build-web's log dialog reads it. The console accepts its own log paths
 * and Jenkins URLs; a log Orca resolved onto the console's origin goes back to its path.
 */
export async function readBuildWebBuildLog(url: string, offset: number): Promise<BuildWebLogPiece> {
  const credential = requireBuildWebCredential()
  const own = url.startsWith(`${credential.baseUrl}/`) ? url.slice(credential.baseUrl.length) : url
  if (TEST_JOB_LOG.test(own)) {
    // Why: /api/build-log refuses a test job's log; its own route reads 1 MiB from `offset`.
    const piece = recordOf(
      await buildWebRequest({ ...credential, path: `${own}?offset=${offset}` })
    )
    const next = numberOf(piece?.offset, offset)
    return { text: textOf(piece?.text), next, done: next >= numberOf(piece?.size, next) }
  }
  const answer = recordOf(
    await buildWebRequest({
      ...credential,
      path: `/api/build-log?url=${enc(own)}&offset=${offset}`
    })
  )
  return {
    text: textOf(answer?.text),
    next: numberOf(answer?.next, offset),
    done: answer?.done === true
  }
}
