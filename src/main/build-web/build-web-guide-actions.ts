import type { BuildWebMutationResult } from '../../shared/build-web-types'
import type { BuildWebRun } from '../../shared/build-web-run-types'
import type {
  BuildWebJob,
  BuildWebJobView,
  BuildWebStand,
  BuildWebUiAccount
} from '../../shared/build-web-task-types'
import { requireBuildWebCredential } from './build-web-connection'
import { buildWebMutation, buildWebRequest } from './build-web-request'
import { recordOf, textOf, textOrNull, textsOf } from './build-web-response-fields'
import { runOf } from './build-web-runs'

// The guide's screenshots, after build-web's ShotTarget and JobPanel: which stand and account
// they are taken from (kept on the run), the job that takes them, and its log.

const enc = encodeURIComponent
const JOB_STATUSES: readonly BuildWebJob['status'][] = [
  'queued',
  'running',
  'success',
  'partial',
  'failed',
  'cancelled'
]
const PASSWORDS: readonly BuildWebUiAccount['password'][] = ['set', 'missing', 'broken']
// Why: a long screenshot run's log is read whole on every poll; its tail is what is read.
const LOG_MAX_CHARS = 200_000

function records(value: unknown): Record<string, unknown>[] {
  return (Array.isArray(value) ? value : [])
    .map(recordOf)
    .filter((v): v is Record<string, unknown> => v !== null)
}

function jobOf(value: unknown): BuildWebJob | null {
  const v = recordOf(value)
  if (!v || typeof v.id !== 'string') {
    return null
  }
  return {
    id: v.id,
    kind: textOf(v.kind),
    status: JOB_STATUSES.find((s) => s === v.status) ?? 'failed',
    error: textOrNull(v.error),
    can_cancel: v.can_cancel === true
  }
}

/** Where the screenshots come from. Either id may be null, which takes that half back. */
export function setBuildWebGuideTarget(
  runId: string,
  target: { standId?: string | null; accountId?: string | null }
): Promise<BuildWebMutationResult<BuildWebRun | null>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    return runOf(
      await buildWebRequest({
        ...credential,
        method: 'PUT',
        path: `/api/guide/${enc(runId)}/target`,
        body: target
      }),
      credential.baseUrl
    )
  })
}

export function startBuildWebGuideShots(
  runId: string
): Promise<BuildWebMutationResult<BuildWebJob | null>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: `/api/guide/${enc(runId)}/shots`
      })
    )
    return jobOf(answer?.job)
  })
}

/** The run's latest screenshot job — found on the console, so it outlives the tab. */
export async function findBuildWebShotsJob(runId: string): Promise<BuildWebJob | null> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({
      ...credential,
      path: `/api/deploys?runId=${enc(runId)}&kind=shots&limit=1`
    })
  )
  return jobOf(records(answer?.deploys)[0])
}

export async function getBuildWebJob(jobId: string): Promise<BuildWebJobView> {
  const credential = requireBuildWebCredential()
  const [row, log] = await Promise.all([
    buildWebRequest({ ...credential, path: `/api/deploys/${enc(jobId)}` }),
    buildWebRequest({ ...credential, path: `/api/deploys/${enc(jobId)}/log` })
  ])
  const job = jobOf(recordOf(row)?.deploy)
  if (!job) {
    throw new Error('build-web has no such job')
  }
  return { job, log: textOf(recordOf(log)?.log).slice(-LOG_MAX_CHARS) }
}

export function cancelBuildWebJob(jobId: string): Promise<BuildWebMutationResult<string>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: `/api/deploys/${enc(jobId)}/cancel`
      })
    )
    return textOf(answer?.message)
  })
}

export async function listBuildWebStands(): Promise<BuildWebStand[]> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(await buildWebRequest({ ...credential, path: '/api/stands' }))
  return records(answer?.stands)
    .filter((s) => typeof s.id === 'string')
    .map((s) => ({
      id: textOf(s.id),
      name: textOf(s.name),
      products: textsOf(s.products),
      enabled: s.enabled !== false
    }))
}

export async function listBuildWebUiAccounts(): Promise<BuildWebUiAccount[]> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(await buildWebRequest({ ...credential, path: '/api/ui-accounts' }))
  return records(answer?.accounts)
    .filter((a) => typeof a.id === 'string')
    .map((a) => ({
      id: textOf(a.id),
      description: textOf(a.description),
      email: textOf(a.email),
      password: PASSWORDS.find((p) => p === a.password) ?? 'missing'
    }))
}

/** The stand the run's images resolve to, when there is exactly one; null is a choice to make. */
export async function resolveBuildWebStand(runId: string): Promise<string | null> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({ ...credential, path: `/api/stands/resolve?runId=${enc(runId)}` })
  )
  return textOrNull(recordOf(answer?.stand)?.id)
}
