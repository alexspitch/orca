import type { BuildWebImageBuildArgs } from '../../shared/build-web-image-types'
import type { BuildWebLogPiece, BuildWebRun } from '../../shared/build-web-run-types'
import type { BuildWebMutationResult } from '../../shared/build-web-types'
import { requireBuildWebCredential } from './build-web-connection'
import { invalidateBuildWebImageCatalog } from './build-web-images'
import { buildWebMutation, buildWebRequest } from './build-web-request'
import { numberOf, recordOf, textOf, textsOf } from './build-web-response-fields'
import { runOf } from './build-web-runs'

// Building one image from Images, after build-web's ImageBuildDialog: a run for the image on the
// chosen branch, then its builds started at once (build-web leaves that to its Progress page).

const PRODUCTS_WITH_RELEASES = new Set(['sa', 'dc', 'ap', 'storage', 'tools'])
const enc = encodeURIComponent
const collator = new Intl.Collator(undefined, { numeric: true })

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
): Promise<BuildWebMutationResult<{ runId: string }>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const made = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: '/api/runs',
        body: {
          branch: args.branch,
          ticket: args.ticket || null,
          images: [args.image],
          distType: args.dist,
          pushToRepo: false,
          detected: null
        }
      })
    )
    const runId = textOf(made?.id)
    if (!runId) {
      throw new Error('build-web made no run for the build')
    }
    const dists = args.dist === 'both' ? ['rhel', 'redos'] : [args.dist]
    await buildWebRequest({
      ...credential,
      method: 'POST',
      path: `/api/runs/${enc(runId)}/builds`,
      body: { combos: dists.map((dist) => ({ image: args.image, dist, branch: args.branch })) }
    })
    // Why: the catalog behind Images and the badge must show the new build as running.
    invalidateBuildWebImageCatalog()
    return { runId }
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
