import type { BuildWebMutationResult } from '../../shared/build-web-types'
import type {
  BuildWebAgentSessionLookup,
  BuildWebAgentSessionRecord,
  BuildWebAgentSessionSettings
} from '../../shared/build-web-session-types'
import { requireBuildWebCredential } from './build-web-connection'
import { buildWebMutation, buildWebRequest } from './build-web-request'
import { recordOf } from './build-web-response-fields'
import {
  agentSessionLookupOf,
  agentSessionRecordOf,
  agentSessionSettingsOf
} from './build-web-agent-session-mapping'

// The console's session history (IS-147, feature `agent-session-lifecycle`). The host's watcher and
// finisher call these without a person present, so they never prompt for the token.

const BASE = '/api/tms/agent-sessions'
const MAX_IDS = 200

type Options = { background?: true; signal?: AbortSignal; timeoutMs?: number }

const credentialFor = (options: Options) =>
  requireBuildWebCredential(options.background ? { background: true } : undefined)

/** The sessions of the host's own worktrees, with the caller's cleanup setting. Throws on failure. */
export async function fetchBuildWebAgentSessions(
  ids: readonly string[],
  options: Options = {}
): Promise<BuildWebAgentSessionLookup> {
  const unique = [...new Set(ids)].slice(0, MAX_IDS)
  const credential = credentialFor(options)
  const query = unique.map(encodeURIComponent).join(',')
  return agentSessionLookupOf(
    await buildWebRequest({
      ...credential,
      path: `${BASE}?ids=${query}`,
      signal: options.signal,
      timeoutMs: options.timeoutMs
    })
  )
}

function sessionOf(answer: unknown): BuildWebAgentSessionRecord | null {
  return agentSessionRecordOf(recordOf(answer)?.session)
}

/** The worktree is gone. Safe to repeat; 403 and 404 are final (the queue drops the report). */
export async function reportBuildWebWorktreeRemoved(
  id: string,
  report: { note?: string; external?: boolean },
  options: Options = {}
): Promise<BuildWebAgentSessionRecord | null> {
  const credential = credentialFor(options)
  return sessionOf(
    await buildWebRequest({
      ...credential,
      method: 'POST',
      path: `${BASE}/${encodeURIComponent(id)}/worktree-removed`,
      body: {
        ...(report.note ? { note: report.note } : {}),
        ...(report.external ? { external: true } : {})
      },
      signal: options.signal
    })
  )
}

/** A person kept the worktree: the session ends as `kept` and is never cleaned up. */
export async function keepBuildWebAgentSession(
  id: string,
  options: Options = {}
): Promise<BuildWebAgentSessionRecord | null> {
  const credential = credentialFor(options)
  return sessionOf(
    await buildWebRequest({
      ...credential,
      method: 'POST',
      path: `${BASE}/${encodeURIComponent(id)}/keep`,
      body: {},
      signal: options.signal
    })
  )
}

export function getBuildWebAgentSessionSettings(): Promise<
  BuildWebMutationResult<BuildWebAgentSessionSettings>
> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    return agentSessionSettingsOf(
      await buildWebRequest({ ...credential, path: `${BASE}/settings` })
    )
  })
}

export function setBuildWebAgentSessionSettings(
  settings: BuildWebAgentSessionSettings
): Promise<BuildWebMutationResult<BuildWebAgentSessionSettings>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    return agentSessionSettingsOf(
      await buildWebRequest({
        ...credential,
        method: 'PUT',
        path: `${BASE}/settings`,
        body: { auto_cleanup: settings.auto_cleanup }
      })
    )
  })
}
