import type { BuildWebMutationResult } from '../../shared/build-web-types'
import type {
  BuildWebJiraCreateArgs,
  BuildWebJiraDraft,
  BuildWebJiraInfo,
  BuildWebJiraTransition,
  BuildWebStandVersion,
  BuildWebTmsStand
} from '../../shared/build-web-task-types'
import { BUILD_WEB_LONG_TIMEOUT_MS } from '../../shared/build-web-timeouts'
import { requireBuildWebCredential } from './build-web-connection'
import { buildWebMutation, buildWebRequest } from './build-web-request'
import { numberOf, recordOf, textOf, textOrNull } from './build-web-response-fields'

// The task card's Jira issue and stand, after build-web's JiraPanel, «Свойства» and
// JiraDraftDialog. A Jira key always comes from the task, never from free input.

const enc = encodeURIComponent

function records(value: unknown): Record<string, unknown>[] {
  return (Array.isArray(value) ? value : [])
    .map(recordOf)
    .filter((v): v is Record<string, unknown> => v !== null)
}

export async function getBuildWebJiraInfo(jiraKey: string): Promise<BuildWebJiraInfo> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({ ...credential, path: `/api/jira/${enc(jiraKey)}` })
  )
  return {
    summary: textOf(answer?.summary),
    status: textOf(answer?.status),
    guideComment: recordOf(answer?.guideComment) !== null,
    url: textOf(answer?.url)
  }
}

export async function listBuildWebJiraTransitions(
  jiraKey: string
): Promise<BuildWebJiraTransition[]> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({ ...credential, path: `/api/jira/${enc(jiraKey)}/transitions` })
  )
  return records(answer?.transitions)
    .filter((t) => typeof t.id === 'string')
    .map((t) => ({ id: textOf(t.id), name: textOf(t.name), to: textOf(t.to) }))
}

export function applyBuildWebJiraTransition(
  jiraKey: string,
  transition: string
): Promise<BuildWebMutationResult<string>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: `/api/jira/${enc(jiraKey)}/transitions`,
        body: { transition }
      })
    )
    return textOf(answer?.status)
  })
}

/** The stands that serve the product, for the task's «Стенд». */
export async function listBuildWebTmsStands(product: string): Promise<BuildWebTmsStand[]> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({ ...credential, path: `/api/tms/stands?product=${enc(product)}` })
  )
  return records(answer?.stands)
    .filter((s) => typeof s.id === 'string')
    .map((s) => ({ id: textOf(s.id), name: textOf(s.name), mode: textOf(s.mode) }))
}

/** What the stand runs right now — over SSH, so seconds. */
export async function readBuildWebStandVersion(standId: string): Promise<BuildWebStandVersion> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({
      ...credential,
      method: 'POST',
      path: `/api/tms/stands/${enc(standId)}/version`,
      timeoutMs: BUILD_WEB_LONG_TIMEOUT_MS
    })
  )
  return {
    version: textOrNull(answer?.version) || null,
    mode: textOf(answer?.mode),
    error: textOrNull(answer?.error)
  }
}

/** Read the version and the mode off the task's stand again and freeze them — the ⟳ button. */
export function refreshBuildWebIssueVersion(
  issueId: string
): Promise<BuildWebMutationResult<true>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    await buildWebRequest({
      ...credential,
      method: 'POST',
      path: `/api/tms/issues/${enc(issueId)}/version`,
      timeoutMs: BUILD_WEB_LONG_TIMEOUT_MS
    })
    return true as const
  })
}

export async function getBuildWebJiraDraft(issueId: string): Promise<BuildWebJiraDraft> {
  const credential = requireBuildWebCredential()
  const draft = recordOf(
    recordOf(
      await buildWebRequest({ ...credential, path: `/api/tms/issues/${enc(issueId)}/jira/draft` })
    )?.draft
  )
  return {
    type: textOf(draft?.type),
    summary: textOf(draft?.summary),
    description: textOf(draft?.description),
    product: textOf(draft?.product),
    project: textOf(draft?.project),
    versions: records(draft?.versions)
      .filter((v) => typeof v.id === 'string')
      .map((v) => ({ id: textOf(v.id), name: textOf(v.name), released: v.released === true })),
    fix_versions_required: draft?.fix_versions_required === true,
    attachments: numberOf(draft?.attachments)
  }
}

/** File the task in Jira from the edited draft. */
export function createBuildWebJiraIssue(
  args: BuildWebJiraCreateArgs
): Promise<BuildWebMutationResult<{ key: string; url: string }>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: `/api/tms/issues/${enc(args.issueId)}/jira`,
        body: {
          summary: args.summary,
          description: args.description,
          fix_version_ids: args.fixVersionIds
        }
      })
    )
    return { key: textOf(answer?.key), url: textOf(answer?.url) }
  })
}
