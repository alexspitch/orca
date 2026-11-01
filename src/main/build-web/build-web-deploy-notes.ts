import {
  BUILD_WEB_DEPLOY_NOTES_STATUSES,
  type BuildWebDeployNotesJob,
  type BuildWebMutationResult
} from '../../shared/build-web-types'
import { requireBuildWebCredential } from './build-web-connection'
import { buildWebMutation, buildWebRequest } from './build-web-request'
import { recordOf, textOf, textOrNull } from './build-web-response-fields'

// IS-341: the note for the deployment engineers. The console has a model write it when a task goes
// to «Выкатывается»; the note itself is a task file with the role `deploy`.

const enc = encodeURIComponent

export function deployNotesJobOf(value: unknown): BuildWebDeployNotesJob | null {
  const v = recordOf(value)
  const status = BUILD_WEB_DEPLOY_NOTES_STATUSES.find((s) => s === v?.status)
  return v && typeof v.id === 'string' && status
    ? {
        id: v.id,
        status,
        created_at: textOf(v.created_at),
        finished_at: textOrNull(v.finished_at),
        message: textOrNull(v.message)
      }
    : null
}

/** The task's last generation of the note, whatever its state; null when none was started. */
export async function getBuildWebDeployNotes(id: string): Promise<BuildWebDeployNotesJob | null> {
  const credential = requireBuildWebCredential()
  const answer = recordOf(
    await buildWebRequest({ ...credential, path: `/api/tms/issues/${enc(id)}/deploy-notes` })
  )
  return deployNotesJobOf(answer?.job)
}

/** Write the note again. The console refuses while one is being written, and for a subtask. */
export function startBuildWebDeployNotes(
  id: string
): Promise<BuildWebMutationResult<BuildWebDeployNotesJob>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: `/api/tms/issues/${enc(id)}/deploy-notes`
      })
    )
    const job = deployNotesJobOf(answer?.job)
    if (!job) {
      throw new Error('build-web started the note but did not return it')
    }
    return job
  })
}
