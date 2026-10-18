import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { BuildWebJob } from '../../../../../../shared/build-web-task-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../../build-web-client'
import { BuildWebToneChip } from '../../BuildWebToneChip'
import type { ChipTone } from '../../build-web-tones'

const POLL_MS = 4000

export function jobTone(status: BuildWebJob['status']): ChipTone {
  switch (status) {
    case 'success':
      return 'green'
    case 'failed':
      return 'red'
    case 'partial':
      return 'amber'
    case 'cancelled':
      return 'neutral'
    case 'queued':
    case 'running':
      return 'blue'
  }
}

/** One job on the console and its log, after build-web's JobPanel: polled until it ends. */
export function GuideJobPanel({
  target,
  jobId,
  onJob,
  onDone
}: {
  target: RuntimeClientTarget
  jobId: string
  /** The row, whenever its status changes. */
  onJob: (job: BuildWebJob) => void
  onDone: () => void
}): React.JSX.Element {
  const [job, setJob] = useState<BuildWebJob | null>(null)
  const [log, setLog] = useState('')
  const [done, setDone] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const told = useRef(false)
  const lastStatus = useRef<string | null>(null)
  // Why held, not depended on: the parent re-renders on every keystroke in the guide editor.
  const handlers = useRef({ onJob, onDone })
  handlers.current = { onJob, onDone }
  const logRef = useRef<HTMLPreElement>(null)

  const load = useCallback(async () => {
    try {
      const view = await callBuildWeb(target, 'getJob', { jobId })
      setJob(view.job)
      setLog(view.log)
      if (lastStatus.current !== view.job.status) {
        lastStatus.current = view.job.status
        handlers.current.onJob(view.job)
      }
      if (view.job.status !== 'queued' && view.job.status !== 'running') {
        setDone(true)
        if (!told.current) {
          told.current = true
          handlers.current.onDone()
        }
      }
    } catch {
      // Transient: the next beat asks again.
    }
  }, [jobId, target])

  useEffect(() => {
    void load()
    if (done) {
      return
    }
    const timer = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(timer)
  }, [done, load])

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight)
  }, [log])

  const cancel = async () => {
    setCancelling(true)
    try {
      const result = await callBuildWeb(target, 'cancelJob', { jobId })
      setNote(result.ok ? result.value : result.error)
    } catch (failure) {
      setNote(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setCancelling(false)
      await load()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium">
          {job?.kind ?? translate('buildWeb.guide.shotsJob', 'screenshots')}
        </span>
        {job ? <BuildWebToneChip label={job.status} tone={jobTone(job.status)} /> : null}
        <div className="flex-1" />
        {job?.can_cancel ? (
          <Button variant="ghost" size="xs" disabled={cancelling} onClick={() => void cancel()}>
            {cancelling
              ? translate('buildWeb.guide.cancelling', 'Cancelling…')
              : translate('buildWeb.guide.cancelJob', 'Cancel')}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={translate('buildWeb.guide.reloadJob', 'Read again')}
          onClick={() => void load()}
        >
          <RefreshCw />
        </Button>
      </div>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      {job?.error ? <p className="text-xs text-destructive">{job.error}</p> : null}
      {log ? (
        <pre
          ref={logRef}
          className="scrollbar-sleek max-h-64 overflow-auto rounded-md bg-muted/60 p-2 font-mono text-2xs whitespace-pre-wrap"
        >
          {log}
        </pre>
      ) : null}
    </div>
  )
}
