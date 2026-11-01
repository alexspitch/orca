import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type {
  BuildWebDeployNotesJob,
  BuildWebIssueDetail
} from '../../../../../../shared/build-web-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../../build-web-client'
import { isWritingDeployNotes } from './deploy-notes-job'

const WRITING_POLL_MS = 3000

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
 * The deploy note's last generation, for a task (a subtask has none), read while `visible`: on
 * opening, when the status moves — the console starts a note as the task goes out — and every few
 * seconds while one is written. `onWritten` reads the card again for the file it left.
 */
export function useIssueDeployNotes(
  target: RuntimeClientTarget,
  detail: BuildWebIssueDetail | null,
  visible: boolean,
  onWritten: () => void
): IssueDeployNotes {
  const issueId = detail && !detail.parent_id ? detail.id : null
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
      take({ issueId, job: await callBuildWeb(target, 'deployNotes', { id: issueId }) })
    } catch (failure) {
      // Why keep the job read: a failed read is not «never written», and a running poll goes on.
      setFailed({ issueId, message: failure instanceof Error ? failure.message : String(failure) })
    }
  }, [issueId, take, target])

  useEffect(() => {
    if (!visible) {
      return
    }
    void load()
    if (status !== 'deploying') {
      return
    }
    // Why again: the console starts the note right after the move, a moment after the card hears of it.
    const again = setTimeout(() => void load(), WRITING_POLL_MS)
    return () => clearTimeout(again)
  }, [load, status, visible])

  const job = read && read.issueId === issueId ? read.job : undefined
  const writing = isWritingDeployNotes(job)
  useEffect(() => {
    if (!writing || !visible) {
      return
    }
    const timer = setInterval(() => void load(), WRITING_POLL_MS)
    return () => clearInterval(timer)
  }, [load, visible, writing])

  const start = () => {
    if (!issueId) {
      return
    }
    setStarting(true)
    callBuildWeb(target, 'startDeployNotes', { id: issueId })
      .then(
        (result) => (result.ok ? take({ issueId, job: result.value }) : toast.error(result.error)),
        (failure) => toast.error(failure instanceof Error ? failure.message : String(failure))
      )
      .finally(() => setStarting(false))
  }

  return {
    job,
    error: job === undefined && failed?.issueId === issueId ? failed.message : null,
    starting,
    start
  }
}
