import type { BuildWebMutationResult } from '../../shared/build-web-types'
import type {
  BuildWebAdoptResult,
  BuildWebBranch,
  BuildWebDetect,
  BuildWebIssueRunArgs,
  BuildWebTestingStatus
} from '../../shared/build-web-run-types'
import { BUILD_WEB_LONG_TIMEOUT_MS } from '../../shared/build-web-timeouts'
import { requireBuildWebCredential } from './build-web-connection'
import { buildWebMutation, buildWebRequest } from './build-web-request'
import { numberOf, recordOf, textOf, textOrNull, textsOf } from './build-web-response-fields'
import { runOf } from './build-web-runs'

// A task's first build, after build-web's IssueBuilds and IssueNewBuild: images already built
// after the task's last commit are adopted; otherwise the form finds the images and makes the run.

const enc = encodeURIComponent

function sourcesOf(value: unknown): Record<string, string[]> {
  const v = recordOf(value) ?? {}
  return Object.fromEntries(Object.entries(v).map(([image, why]) => [image, textsOf(why)]))
}

function branchesOf(value: unknown): BuildWebBranch[] {
  return (Array.isArray(value) ? value : [])
    .map(recordOf)
    .filter((b): b is Record<string, unknown> => b !== null && typeof b.name === 'string')
    .map((b) => ({ name: textOf(b.name), fromTree: b.fromTree === true }))
}

/** A task without a build gets one made of the images already built after its last commit. */
export function adoptBuildWebBuilt(
  issueId: string,
  testingStatus: BuildWebTestingStatus
): Promise<BuildWebMutationResult<BuildWebAdoptResult>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: `/api/tms/issues/${enc(issueId)}/run/adopt-built`,
        body: { testingStatus },
        timeoutMs: BUILD_WEB_LONG_TIMEOUT_MS
      })
    )
    return { run: runOf(answer?.run, credential.baseUrl), reason: textOrNull(answer?.reason) }
  })
}

/** Which images the task's commits on the branch touch, and which shared code suggests more. */
export async function detectBuildWebImages(
  branch: string,
  ticket: string
): Promise<BuildWebDetect> {
  const credential = requireBuildWebCredential()
  const answer =
    recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: '/api/detect',
        body: { branch, ticket },
        timeoutMs: BUILD_WEB_LONG_TIMEOUT_MS
      })
    ) ?? {}
  return {
    branch: textOf(answer.branch) || branch,
    ticket: textOrNull(answer.ticket),
    commit_count: numberOf(answer.commit_count),
    images: textsOf(answer.images),
    image_sources: sourcesOf(answer.image_sources),
    suggested_images: textsOf(answer.suggested_images),
    suggested_image_sources: sourcesOf(answer.suggested_image_sources),
    ignored_shared: textsOf(answer.ignored_shared),
    plugins_changed: textsOf(answer.plugins_changed),
    raw: answer
  }
}

/** Make the task's run. Nothing builds yet: the Build tab starts the builds. */
export function createBuildWebIssueRun(
  args: BuildWebIssueRunArgs
): Promise<BuildWebMutationResult<{ id: string; existing: boolean }>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: '/api/runs',
        body: {
          branch: args.branch,
          ticket: args.ticket,
          images: args.images,
          extra: args.extra,
          // Why: a task's build covers both distributions, as build-web's own form makes it.
          distType: 'both',
          pushToRepo: false,
          testingStatus: args.testingStatus,
          detected: args.detected,
          issueId: args.issueId
        }
      })
    )
    const id = textOf(answer?.id)
    if (!id) {
      throw new Error('build-web made no run for the task')
    }
    return { id, existing: answer?.existing === true }
  })
}

/** Every image CI builds, for «Add image». */
export async function listBuildWebImageNames(): Promise<string[]> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(await buildWebRequest({ ...credential, path: '/api/images' }))
  return textsOf(answer?.images)
}

/** The branches an image can be built from; `fromTree` ones build without Jenkins' tests. */
export async function listBuildWebBranches(): Promise<BuildWebBranch[]> {
  const credential = requireBuildWebCredential()
  return branchesOf(
    recordOf(await buildWebRequest({ ...credential, path: '/api/branches' }))?.branches
  )
}

/** Fetch from Bitbucket on the console, then list the branches again. */
export function fetchBuildWebRepo(): Promise<BuildWebMutationResult<BuildWebBranch[]>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: '/api/fetch',
        timeoutMs: BUILD_WEB_LONG_TIMEOUT_MS
      })
    )
    return branchesOf(answer?.branches)
  })
}

/** image → its workspaces that have tests; the row's «Tests» chip opens them in build-web. */
export async function buildWebImageTestSources(): Promise<Record<string, string[]>> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({ ...credential, path: '/api/tests/image-sources' })
  )
  return sourcesOf(answer?.sources)
}
