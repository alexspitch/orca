import type { BuildWebMutationResult } from '../../shared/build-web-types'
import type {
  BuildWebAdoptResult,
  BuildWebBranch,
  BuildWebDetect,
  BuildWebIssueBuildBranch,
  BuildWebIssueRunArgs,
  BuildWebTestingStatus
} from '../../shared/build-web-run-types'
import { BUILD_WEB_LONG_TIMEOUT_MS } from '../../shared/build-web-timeouts'
import { requireBuildWebCredential } from './build-web-connection'
import { BuildWebApiError, buildWebMutation, buildWebRequest } from './build-web-request'
import { numberOf, recordOf, textOf, textOrNull, textsOf } from './build-web-response-fields'
import { runOf } from './build-web-runs'
import { repoField, type BuildWebRepo } from '../../shared/build-web-repos'

// A task's first build, after build-web's IssueBuilds and IssueNewBuild: images already built
// after the task's last commit are adopted; otherwise the form finds the images and makes the run.

const enc = encodeURIComponent
const repoQuery = (repo: BuildWebRepo) => (repo === 'products' ? '' : `?repo=${enc(repo)}`)

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
  ticket: string,
  repo: BuildWebRepo = 'products'
): Promise<BuildWebDetect> {
  const credential = requireBuildWebCredential()
  const answer =
    recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: '/api/detect',
        body: { branch, ticket, ...repoField(repo) },
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

/** The branches a build of the task reaches; null from a console that cannot say. */
export async function listBuildWebIssueBuildBranches(
  issueId: string
): Promise<BuildWebIssueBuildBranch[] | null> {
  const credential = requireBuildWebCredential()
  try {
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        path: `/api/tms/issues/${encodeURIComponent(issueId)}/build-branches`,
        timeoutMs: BUILD_WEB_LONG_TIMEOUT_MS
      })
    )
    const rows = Array.isArray(answer?.branches) ? answer.branches : []
    return rows
      .map((row) => recordOf(row))
      .filter((row): row is Record<string, unknown> => row !== null && Boolean(textOf(row.branch)))
      .map((row) => ({
        branch: textOf(row.branch),
        primary: row.primary === true,
        has_commits: row.has_commits === true,
        on_run: row.on_run === true,
        excluded: row.excluded === true
      }))
  } catch (error) {
    if (error instanceof BuildWebApiError && error.routeMissing) {
      return null
    }
    throw error
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
          issueId: args.issueId,
          ...(args.excludeBranches ? { excludeBranches: args.excludeBranches } : {})
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
export async function listBuildWebImageNames(repo: BuildWebRepo = 'products'): Promise<string[]> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({ ...credential, path: `/api/images${repoQuery(repo)}` })
  )
  return textsOf(answer?.images)
}

/** The branches an image can be built from; `fromTree` ones build without Jenkins' tests. */
export async function listBuildWebBranches(
  repo: BuildWebRepo = 'products'
): Promise<BuildWebBranch[]> {
  const credential = requireBuildWebCredential()
  return branchesOf(
    recordOf(await buildWebRequest({ ...credential, path: `/api/branches${repoQuery(repo)}` }))
      ?.branches
  )
}

/** Fetch from Bitbucket on the console, then list the branches again. */
export function fetchBuildWebRepo(
  repo: BuildWebRepo = 'products'
): Promise<BuildWebMutationResult<BuildWebBranch[]>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: '/api/fetch',
        ...(repo === 'products' ? {} : { body: repoField(repo) }),
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
