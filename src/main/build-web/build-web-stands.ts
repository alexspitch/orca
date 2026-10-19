import type { BuildWebMutationResult } from '../../shared/build-web-types'
import type { BuildWebJob } from '../../shared/build-web-task-types'
import type {
  BuildWebStandAccount,
  BuildWebStandGroup,
  BuildWebStandOpKind,
  BuildWebStandStatus
} from '../../shared/build-web-stand-types'
import { BUILD_WEB_LONG_TIMEOUT_MS } from '../../shared/build-web-timeouts'
import { requireBuildWebCredential } from './build-web-connection'
import { jobOf } from './build-web-guide-actions'
import { buildWebMutation, buildWebRequest } from './build-web-request'
import { recordOf, recordsOf } from './build-web-response-fields'
import { standAccountOf, standCardOf, standGroupsOf, standStatusOf } from './build-web-stand-model'

// The «Stands» page: the directory, what a stand runs, its logins, and the compose operations.

const enc = encodeURIComponent
// Why: the operations that change what a stand runs; a screenshot run on it changes nothing.
const STAND_JOB_KINDS = new Set(['deploy', 'generate', 'up', 'restart', 'apply'])

export function listBuildWebStandGroups(): Promise<BuildWebMutationResult<BuildWebStandGroup[]>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(await buildWebRequest({ ...credential, path: '/api/stands' }))
    return standGroupsOf(
      recordsOf(answer?.stands)
        .map(standCardOf)
        .filter((c) => c !== null)
    )
  })
}

/** What the stand runs — read over SSH by the console, so seconds. */
export function readBuildWebStandStatus(
  standId: string
): Promise<BuildWebMutationResult<BuildWebStandStatus>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    return standStatusOf(
      await buildWebRequest({
        ...credential,
        path: `/api/stands/${enc(standId)}/status`,
        timeoutMs: BUILD_WEB_LONG_TIMEOUT_MS
      })
    )
  })
}

/** The UI logins of every card of a stand: each product's UI has its own. */
export function listBuildWebStandAccounts(
  standIds: string[]
): Promise<BuildWebMutationResult<BuildWebStandAccount[]>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answers = await Promise.all(
      standIds.map((id) =>
        buildWebRequest({ ...credential, path: `/api/ui-accounts?stand=${enc(id)}` })
      )
    )
    return answers
      .flatMap((answer) => recordsOf(recordOf(answer)?.accounts))
      .map(standAccountOf)
      .filter((a) => a !== null)
  })
}

/** Operations still queued or running on the stand, so a page opened later shows them too. */
export function listBuildWebStandJobs(
  standIds: string[]
): Promise<BuildWebMutationResult<BuildWebJob[]>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answers = await Promise.all(
      standIds.map((id) =>
        buildWebRequest({ ...credential, path: `/api/deploys?standId=${enc(id)}&limit=5` })
      )
    )
    return answers
      .flatMap((answer) => recordsOf(recordOf(answer)?.deploys))
      .map(jobOf)
      .filter(
        (job): job is BuildWebJob =>
          job !== null &&
          (job.status === 'queued' || job.status === 'running') &&
          STAND_JOB_KINDS.has(job.kind)
      )
  })
}

/** `docker compose up -d` or `restart`, as a job of the stand: under its lock, in its history. */
export function startBuildWebStandOp(args: {
  standId: string
  kind: BuildWebStandOpKind
  services?: string[]
}): Promise<BuildWebMutationResult<BuildWebJob>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: `/api/stands/${enc(args.standId)}/ops`,
        body: { kind: args.kind, ...(args.services?.length ? { services: args.services } : {}) }
      })
    )
    const job = jobOf(answer?.op)
    if (!job) {
      throw new Error('build-web started no operation')
    }
    return job
  })
}
