import type {
  BuildWebAgentSession,
  BuildWebIssuePatch,
  BuildWebCommentOutcome,
  BuildWebIssueRow,
  BuildWebJiraOutcome,
  BuildWebMutationResult,
  BuildWebUpdateOutcome
} from '../../shared/build-web-types'
import { requireBuildWebCredential } from './build-web-connection'
import { buildWebMutation, buildWebRequest } from './build-web-request'
import { issueRowOf } from './build-web-issue-mapping'
import { recordOf, textOf } from './build-web-response-fields'

const issuePath = (id: string, tail = '') => `/api/tms/issues/${encodeURIComponent(id)}${tail}`

function withoutFavorite({
  favorite: _favorite,
  ...rest
}: BuildWebIssueRow): Omit<BuildWebIssueRow, 'favorite'> {
  return rest
}

/** What the console's mirror to Jira did — a move or a comment; shown, never assumed. */
function jiraOutcomeOf(value: unknown): BuildWebJiraOutcome | null {
  const jira = recordOf(value)
  if (!jira) {
    return null
  }
  const error = textOf(jira.error)
  if (error) {
    return { ok: false, error }
  }
  const status = textOf(jira.status)
  return status ? { ok: true, status } : null
}

export function updateBuildWebIssue(
  id: string,
  patch: BuildWebIssuePatch
): Promise<BuildWebMutationResult<BuildWebUpdateOutcome>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({ ...credential, method: 'PATCH', path: issuePath(id), body: patch })
    )
    const row = issueRowOf(credential.baseUrl, answer?.issue)
    return { issue: row ? withoutFavorite(row) : null, jira: jiraOutcomeOf(answer?.jira) }
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
): Promise<BuildWebMutationResult<BuildWebCommentOutcome>> {
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
    return { id: textOf(recordOf(answer?.comment)?.id), jira: jiraOutcomeOf(answer?.jira) }
  })
}

/** Correct one's own comment; a comment kept in step with Jira is corrected there too. */
export function editBuildWebComment(
  id: string,
  commentId: string,
  body: string
): Promise<BuildWebMutationResult<{ jira: BuildWebJiraOutcome | null }>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'PATCH',
        path: issuePath(id, `/comments/${encodeURIComponent(commentId)}`),
        body: { body }
      })
    )
    return { jira: jiraOutcomeOf(answer?.jira) }
  })
}

/** Take one's own comment back, its files with it. */
export function deleteBuildWebComment(
  id: string,
  commentId: string
): Promise<BuildWebMutationResult<{ jira: BuildWebJiraOutcome | null }>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'DELETE',
        path: issuePath(id, `/comments/${encodeURIComponent(commentId)}`)
      })
    )
    return { jira: jiraOutcomeOf(answer?.jira) }
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
