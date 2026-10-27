import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { RefreshCw } from 'lucide-react-native'
import type { BuildWebJob } from '../../../../../../src/shared/build-web-task-types'
import type { ChipTone } from '../../../../../../src/renderer/src/components/build-web/build-web-tones'
import { BuildWebToneChip } from '../../../BuildWebToneChip'
import { useCardTabActive } from '../../../build-web-card-tabs'
import { useBuildWebScreen } from '../../../build-web-screen-context'
import { GuideButton } from './GuideButton'
import { guideStyles } from './guide-tab-styles'
import { messageOf } from './guide-failure'

const POLL_MS = 4000

function jobTone(status: BuildWebJob['status']): ChipTone {
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
  jobId,
  label,
  onJob,
  onDone
}: {
  jobId: string
  /** What the job is, until its row names its kind. */
  label: string
  onJob: (job: BuildWebJob) => void
  onDone: () => void
}) {
  const { call } = useBuildWebScreen()
  const active = useCardTabActive()
  const [job, setJob] = useState<BuildWebJob | null>(null)
  const [log, setLog] = useState('')
  const [done, setDone] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const told = useRef(false)
  const lastStatus = useRef<string | null>(null)
  // Held, not depended on: the parent re-renders on every keystroke in the guide editor.
  const handlers = useRef({ onJob, onDone })
  handlers.current = { onJob, onDone }
  const logRef = useRef<ScrollView>(null)

  const load = useCallback(async () => {
    try {
      const view = await call('getJob', { jobId })
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
  }, [call, jobId])

  useEffect(() => {
    void load()
    if (done || !active) {
      return
    }
    const timer = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(timer)
  }, [active, done, load])

  const cancel = async () => {
    setCancelling(true)
    try {
      const result = await call('cancelJob', { jobId })
      setNote(result.ok ? result.value : result.error)
    } catch (failure) {
      setNote(messageOf(failure))
    } finally {
      setCancelling(false)
      await load()
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={guideStyles.row}>
        <Text style={[guideStyles.meta, { fontWeight: '600' }]}>{job?.kind ?? label}</Text>
        {job ? <BuildWebToneChip label={job.status} tone={jobTone(job.status)} /> : null}
        <View style={{ flex: 1 }} />
        {job?.can_cancel ? (
          <GuideButton
            compact
            variant="ghost"
            label={cancelling ? 'Cancelling…' : 'Cancel'}
            disabled={cancelling}
            onPress={() => void cancel()}
          />
        ) : null}
        <GuideButton
          compact
          variant="ghost"
          icon={RefreshCw}
          label="Read again"
          onPress={() => void load()}
        />
      </View>
      {note ? <Text style={guideStyles.meta}>{note}</Text> : null}
      {job?.error ? <Text style={guideStyles.danger}>{job.error}</Text> : null}
      {log ? (
        <ScrollView
          ref={logRef}
          style={guideStyles.log}
          nestedScrollEnabled
          onContentSizeChange={() => logRef.current?.scrollToEnd({ animated: false })}
        >
          <Text style={guideStyles.logText} selectable>
            {log}
          </Text>
        </ScrollView>
      ) : null}
    </View>
  )
}
