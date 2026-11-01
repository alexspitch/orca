import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  BuildWebDeployNotesJob,
  BuildWebIssueDetail
} from '../../../../../../src/shared/build-web-types'
import { BUILD_WEB_DEPLOY_NOTES_RUNTIME_CAPABILITY } from '../../../../../../src/shared/build-web-capability'
import { isWritingDeployNotes } from '../../../../../../src/renderer/src/components/build-web/issue/plan/deploy-notes-job'
import { buildWebErrorMessage } from '../../../build-web-operations'
import { useBuildWebScreen } from '../../../build-web-screen-context'

const WRITING_POLL_MS = 3000

// The desktop client's refusal for the deploy note's calls on an older host.
const DEPLOY_NOTES_REFUSAL = 'This Orca server does not show deploy notes yet. Update the server.'

export type IssueDeployNotes = {
  /** The note's last generation; undefined until read, null when none was started. */
  job: BuildWebDeployNotesJob | null | undefined
  /** Why the generation could not be read, while none is read. */
  error: string | null
  starting: boolean
  start: () => void
}

type JobRead = { issueId: string; job: BuildWebDeployNotesJob | null }

/**
 * The desktop's useIssueDeployNotes: the deploy note's last generation, for a task (a subtask has
 * none), read on opening, when the status moves, and every few seconds while one is written.
 * `onWritten` reads the card again for the file it left.
 */
export function useIssueDeployNotes(
  detail: BuildWebIssueDetail | null,
  onWritten: () => void
): IssueDeployNotes {
  const { call, hostCapabilities, notify } = useBuildWebScreen()
  const capable = hostCapabilities.includes(BUILD_WEB_DEPLOY_NOTES_RUNTIME_CAPABILITY)
  const issueId = detail && !detail.parent_id && capable ? detail.id : null
  const status = detail?.status
  const [read, setRead] = useState<JobRead | null>(null)
  const [failed, setFailed] = useState<{ issueId: string; message: string } | null>(null)
  const [starting, setStarting] = useState(false)
  const wasWriting = useRef(false)
  const written = useRef(onWritten)
  written.current = onWritten

  const take = useCallback((next: JobRead) => {
    setRead(next)
    setFailed(null)
    if (wasWriting.current && !isWritingDeployNotes(next.job)) {
      written.current()
    }
    wasWriting.current = isWritingDeployNotes(next.job)
  }, [])

  const load = useCallback(async () => {
    if (!issueId) {
      return
    }
    try {
      take({ issueId, job: await call('deployNotes', { id: issueId }) })
    } catch (failure) {
      // Why keep the job read: a failed read is not «never written», and a running poll goes on.
      setFailed({ issueId, message: buildWebErrorMessage(failure) })
    }
  }, [call, issueId, take])

  useEffect(() => {
    void load()
    if (status !== 'deploying') {
      return
    }
    // Why again: the console starts the note right after the move, a moment after the card hears of it.
    const again = setTimeout(() => void load(), WRITING_POLL_MS)
    return () => clearTimeout(again)
  }, [load, status])

  const job = read && read.issueId === issueId ? read.job : undefined
  const writing = isWritingDeployNotes(job)
  useEffect(() => {
    if (!writing) {
      return
    }
    const timer = setInterval(() => void load(), WRITING_POLL_MS)
    return () => clearInterval(timer)
  }, [load, writing])

  const start = () => {
    if (!issueId) {
      return
    }
    setStarting(true)
    call('startDeployNotes', { id: issueId })
      .then(
        (result) =>
          result.ok ? take({ issueId, job: result.value }) : notify(result.error, 'error'),
        (failure: unknown) => notify(buildWebErrorMessage(failure), 'error')
      )
      .finally(() => setStarting(false))
  }

  return {
    job,
    error: !capable
      ? DEPLOY_NOTES_REFUSAL
      : job === undefined && failed?.issueId === issueId
        ? failed.message
        : null,
    starting,
    start
  }
}
