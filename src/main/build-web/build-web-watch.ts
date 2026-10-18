import type { BuildWebMutationResult } from '../../shared/build-web-types'
import type {
  BuildWebWatchAuto,
  BuildWebWatchCheck,
  BuildWebWatchEntry,
  BuildWebWatchRun,
  BuildWebWatchState
} from '../../shared/build-web-watch-types'
import { BUILD_WEB_LONG_TIMEOUT_MS } from '../../shared/build-web-timeouts'
import { requireBuildWebCredential } from './build-web-connection'
import { invalidateBuildWebImageCatalog } from './build-web-images'
import { buildWebMutation, buildWebRequest } from './build-web-request'
import {
  consoleUrlOf,
  numberOf,
  recordOf,
  recordsOf,
  textOf,
  textOrNull,
  textsOf
} from './build-web-response-fields'

// build-web's watch for Orca's «Testing» page. An older console sends only the Jira tickets and
// none of the newer fields, so a missing `jira_key` means the ticket is the Jira key.

const AUTO: readonly BuildWebWatchAuto[] = ['jira', 'console', 'none']

function runOf(value: unknown, baseUrl: string): BuildWebWatchRun | null {
  const r = recordOf(value)
  if (!r || typeof r.id !== 'string') {
    return null
  }
  return {
    id: r.id,
    branch: textOf(r.branch),
    created_at: textOf(r.created_at),
    unpushed: numberOf(r.unpushed),
    pending: numberOf(r.pending),
    main_tag_left: numberOf(r.main_tag_left),
    in_flight: numberOf(r.in_flight),
    console_url: consoleUrlOf(`/runs/${encodeURIComponent(r.id)}`, baseUrl)
  }
}

/** `https://<site>.atlassian.net` as `/api/me` names it; anything else is not linked to. */
function jiraBaseOf(me: unknown): string | null {
  const raw = textOf(recordOf(me)?.jiraBaseUrl).replace(/\/+$/, '')
  return /^https:\/\/[^/\s]+$/.test(raw) ? raw : null
}

function watchEntryOf(
  e: Record<string, unknown>,
  baseUrl: string,
  jiraBase: string | null
): BuildWebWatchEntry {
  const ticket = textOf(e.ticket)
  const jiraKey = 'jira_key' in e ? textOrNull(e.jira_key) : ticket || null
  return {
    ticket,
    status: textOf(e.status),
    status_changed_at: textOf(e.status_changed_at),
    checked_at: textOrNull(e.checked_at),
    last_action: textOrNull(e.last_action),
    last_action_at: textOrNull(e.last_action_at),
    issue_id: textOrNull(e.issue_id),
    issue_key: textOrNull(e.issue_key),
    run: runOf(e.run, baseUrl),
    jira_key: jiraKey,
    jira_url: jiraKey && jiraBase ? `${jiraBase}/browse/${encodeURIComponent(jiraKey)}` : null,
    title: textOrNull(e.title),
    task_status: textOrNull(e.task_status),
    jira_status: textOrNull(e.jira_status),
    auto: AUTO.find((a) => a === e.auto) ?? null,
    armed: typeof e.armed === 'boolean' ? e.armed : null
  }
}

function watchStateOf(
  answer: unknown,
  baseUrl: string,
  jiraBase: string | null
): BuildWebWatchState {
  const a = recordOf(answer)
  return {
    enabled: a?.enabled === true,
    interval_ms: numberOf(a?.interval_ms),
    from_statuses: textsOf(a?.from_statuses),
    to_statuses: textsOf(a?.to_statuses),
    entries: recordsOf(a?.entries)
      .filter((e) => typeof e.ticket === 'string')
      .map((e) => watchEntryOf(e, baseUrl, jiraBase))
  }
}

/** Why tolerated: without `/api/me` the list still reads, only without Jira links. */
async function jiraBase(credential: { baseUrl: string; token: string }): Promise<string | null> {
  return jiraBaseOf(await buildWebRequest({ ...credential, path: '/api/me' }).catch(() => null))
}

/** The tasks in testing with image work left, and how the watcher is set up. */
export async function getBuildWebWatch(): Promise<BuildWebWatchState> {
  const credential = requireBuildWebCredential()
  const [answer, jira] = await Promise.all([
    buildWebRequest({ ...credential, path: '/api/watch' }),
    jiraBase(credential)
  ])
  return watchStateOf(answer, credential.baseUrl, jira)
}

/** One watcher pass now; Jira being down comes back as the console's 502 message. */
export function checkBuildWebWatch(): Promise<BuildWebMutationResult<BuildWebWatchCheck>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const [answer, jira] = await Promise.all([
      buildWebRequest({
        ...credential,
        method: 'POST',
        path: '/api/watch/check',
        body: {},
        timeoutMs: BUILD_WEB_LONG_TIMEOUT_MS
      }),
      jiraBase(credential)
    ])
    const result = recordOf(recordOf(answer)?.result)
    // Why: a pass that queued builds or pushes changes what Images shows.
    if (numberOf(result?.images) > 0) {
      invalidateBuildWebImageCatalog()
    }
    return {
      ...watchStateOf(answer, credential.baseUrl, jira),
      result: {
        checked: numberOf(result?.checked),
        transitions: numberOf(result?.transitions),
        images: numberOf(result?.images),
        builds: numberOf(result?.builds),
        busy: result?.busy === true
      }
    }
  })
}
