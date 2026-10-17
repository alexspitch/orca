import type { BuildWebMutationResult } from '../../shared/build-web-types'
import type {
  BuildWebCommitDiff,
  BuildWebCommitList,
  BuildWebGuideShot,
  BuildWebRun,
  BuildWebRunBuild
} from '../../shared/build-web-run-types'
import { requireBuildWebCredential } from './build-web-connection'
import {
  BuildWebApiError,
  buildWebBinaryRequest,
  buildWebRequest,
  describeBuildWebError
} from './build-web-request'
import { recordOf, textOf, textOrNull, textsOf } from './build-web-response-fields'

const DIFF_MAX_CHARS = 512 * 1024
const SHOT_MAX_BYTES = 2 * 1024 * 1024
const enc = encodeURIComponent

function buildOf(value: unknown): BuildWebRunBuild | null {
  const v = recordOf(value)
  if (!v || typeof v.image !== 'string') {
    return null
  }
  return {
    image: v.image,
    dist: textOf(v.dist_type),
    branch: textOf(v.branch),
    status: textOf(v.status),
    number: typeof v.build_number === 'number' ? v.build_number : null,
    url: textOrNull(v.build_url),
    tags: textsOf(v.image_tags),
    pushed: v.pushed === true,
    tests_skipped: v.tests_skipped === true,
    error: textOrNull(v.error)
  }
}

export function runOf(value: unknown): BuildWebRun | null {
  const v = recordOf(value)
  if (!v || typeof v.id !== 'string') {
    return null
  }
  return {
    id: v.id,
    status: textOf(v.status),
    branch: textOf(v.branch),
    user: textOf(v.user),
    created_at: textOf(v.created_at),
    testing_status: textOf(v.testing_status),
    guide_markdown: textOrNull(v.guide_markdown),
    guide_updated_at: textOrNull(v.guide_updated_at),
    jira_action: textOrNull(v.jira_action),
    jira_url: textOrNull(v.jira_url),
    builds: (Array.isArray(v.builds) ? v.builds : [])
      .map(buildOf)
      .filter((b): b is BuildWebRunBuild => b !== null)
  }
}

async function mutate<T>(run: () => Promise<T>): Promise<BuildWebMutationResult<T>> {
  try {
    return { ok: true, value: await run() }
  } catch (error) {
    return {
      ok: false,
      error: describeBuildWebError(error),
      ...(error instanceof BuildWebApiError ? { status: error.status } : {})
    }
  }
}

/** The task's build, or null when it has none. Needs the `build` or `history` section. */
export async function getBuildWebIssueRun(issueId: string): Promise<BuildWebRun | null> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({ ...credential, path: `/api/tms/issues/${enc(issueId)}/run` })
  )
  return runOf(answer?.run)
}

/** Publish every pushable build of the run; the moving main tag only when asked. */
export function pushBuildWebRun(
  runId: string,
  moveMainTag: boolean
): Promise<BuildWebMutationResult<true>> {
  return mutate(async () => {
    const credential = requireBuildWebCredential()
    await buildWebRequest({
      ...credential,
      method: 'POST',
      path: `/api/runs/${enc(runId)}/push`,
      body: { moveMainTag }
    })
    return true as const
  })
}

export function saveBuildWebGuide(
  runId: string,
  guide: string
): Promise<BuildWebMutationResult<BuildWebRun | null>> {
  return mutate(async () => {
    const credential = requireBuildWebCredential()
    return runOf(
      await buildWebRequest({
        ...credential,
        method: 'PATCH',
        path: `/api/guide/${enc(runId)}`,
        body: { guide }
      })
    )
  })
}

export function refreshBuildWebGuideImages(
  runId: string,
  guide: string
): Promise<BuildWebMutationResult<BuildWebRun | null>> {
  return mutate(async () => {
    const credential = requireBuildWebCredential()
    return runOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: `/api/guide/${enc(runId)}/refresh-images`,
        body: { guide }
      })
    )
  })
}

/** Post the guide to the task's Jira issue — `jiraKey` comes from the task, never from input. */
export function publishBuildWebGuide(
  jiraKey: string,
  runId: string,
  guide: string
): Promise<BuildWebMutationResult<{ action: string; url: string }>> {
  return mutate(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: `/api/jira/${enc(jiraKey)}/guide`,
        body: { runId, guide }
      })
    )
    return { action: textOf(answer?.action), url: textOf(answer?.url) }
  })
}

export async function getBuildWebIssueCommits(
  issueId: string,
  fetchFirst: boolean
): Promise<BuildWebCommitList> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({
      ...credential,
      path: `/api/tms/issues/${enc(issueId)}/commits${fetchFirst ? '?fetch=1' : ''}`,
      // Why: `fetch=1` runs a git fetch on the console first.
      timeoutMs: fetchFirst ? 90_000 : 20_000
    })
  )
  const commits = (Array.isArray(answer?.commits) ? answer.commits : [])
    .map(recordOf)
    .filter((c): c is Record<string, unknown> => c !== null && typeof c.sha === 'string')
    .map((c) => ({
      sha: textOf(c.sha),
      subject: textOf(c.subject),
      author: textOf(c.author),
      date: textOf(c.date),
      branches: textsOf(c.branches)
    }))
  return { branches: textsOf(answer?.branches), commits }
}

export async function getBuildWebCommitDiff(
  issueId: string,
  sha: string
): Promise<BuildWebCommitDiff> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({
      ...credential,
      path: `/api/tms/issues/${enc(issueId)}/commits/${enc(sha)}`
    })
  )
  const diff = textOf(answer?.diff)
  // Why: a huge patch must not exceed one RPC frame; the card says it was cut.
  return diff.length > DIFF_MAX_CHARS
    ? { diff: diff.slice(0, DIFF_MAX_CHARS), truncated: true }
    : { diff, truncated: false }
}

/** A guide screenshot read with the token — the token never goes into an image URL. */
export async function getBuildWebGuideShot(
  runId: string,
  slug: string
): Promise<BuildWebGuideShot> {
  const credential = requireBuildWebCredential()
  const { mime, bytes } = await buildWebBinaryRequest({
    ...credential,
    path: `/api/guide/${enc(runId)}/shots/${enc(slug)}`,
    maxBytes: SHOT_MAX_BYTES
  })
  return { mime, base64: Buffer.from(bytes).toString('base64') }
}
