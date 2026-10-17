import type {
  BuildWebAgentSession,
  BuildWebIssuePatch,
  BuildWebIssueRow,
  BuildWebMutationResult
} from '../../shared/build-web-types'
import { requireBuildWebCredential } from './build-web-connection'
import { buildWebMutation, buildWebRequest } from './build-web-request'
import { issueRowOf } from './build-web-issue-mapping'
import { recordOf, textOf } from './build-web-response-fields'

const issuePath = (id: string, tail = '') => `/api/tms/issues/${encodeURIComponent(id)}${tail}`

export type BuildWebUpdateOutcome = { issue: BuildWebIssueRow | null; jira: string | null }

export function updateBuildWebIssue(
  id: string,
  patch: BuildWebIssuePatch
): Promise<BuildWebMutationResult<BuildWebUpdateOutcome>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({ ...credential, method: 'PATCH', path: issuePath(id), body: patch })
    )
    // Why: a status move is mirrored to Jira; its outcome is shown, not assumed.
    const jira = recordOf(answer?.jira)
    return {
      issue: issueRowOf(credential.baseUrl, answer?.issue),
      jira: jira ? textOf(jira.status) || textOf(jira.error) || null : null
    }
  })
}

export function setBuildWebFavorite(
  id: string,
  on: boolean
): Promise<BuildWebMutationResult<boolean>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    await buildWebRequest({
      ...credential,
      method: on ? 'PUT' : 'DELETE',
      path: issuePath(id, '/favorite')
    })
    return on
  })
}

export function addBuildWebComment(
  id: string,
  body: string,
  jira: boolean
): Promise<BuildWebMutationResult<{ id: string }>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: issuePath(id, '/comments'),
        body: { body, jira }
      })
    )
    return { id: textOf(recordOf(answer?.comment)?.id) }
  })
}

export type BuildWebSessionInput = Pick<
  BuildWebAgentSession,
  'surface_kind' | 'surface_id' | 'worktree_name' | 'execution_host_id' | 'agent' | 'started_at'
>

/** Hand the task to an Orca session. A 404 means the console predates the field. */
export function setBuildWebAgentSession(
  id: string,
  session: BuildWebSessionInput
): Promise<BuildWebMutationResult<true>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    await buildWebRequest({
      ...credential,
      method: 'PUT',
      path: issuePath(id, '/agent-session'),
      body: session
    })
    return true as const
  })
}

export function noteBuildWebProviderSession(
  id: string,
  surfaceId: string,
  providerSessionId: string
): Promise<BuildWebMutationResult<true>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    await buildWebRequest({
      ...credential,
      method: 'PATCH',
      path: issuePath(id, '/agent-session'),
      body: { surface_id: surfaceId, provider_session_id: providerSessionId }
    })
    return true as const
  })
}

/** Take the task back from the session named — a newer session is left alone (409). */
export function clearBuildWebAgentSession(
  id: string,
  surfaceId: string
): Promise<BuildWebMutationResult<true>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    await buildWebRequest({
      ...credential,
      method: 'DELETE',
      path: issuePath(id, `/agent-session?surface_id=${encodeURIComponent(surfaceId)}`)
    })
    return true as const
  })
}
