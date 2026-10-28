import { useCallback, useEffect, useState } from 'react'
import type { BuildWebAgentSessionRecord } from '../../../../src/shared/build-web-session-types'
import {
  missingTranscriptLabel,
  UNSUPPORTED_TRANSCRIPT_LABEL
} from '../../../../src/shared/build-web-session-transcript'
import { BottomDrawer } from '../../components/BottomDrawer'
import { buildWebErrorMessage } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'
import { LogLinesPanel } from '../LogLinesPanel'
import { CardButton } from './issue-card-ui'

type Transcript = {
  text: string
  before: number | null
  loading: boolean
  /** Why nothing is shown: an error, or the host's word that the log is gone. */
  problem: string | null
}

const START: Transcript = { text: '', before: null, loading: true, problem: null }

/** A session's agent log, read through the host a page at a time from its end. */
function useSessionTranscript(record: BuildWebAgentSessionRecord) {
  const { call } = useBuildWebScreen()
  const [state, setState] = useState<Transcript>(START)
  const read = useCallback(
    (before?: number) => {
      setState((s) => ({ ...s, loading: true }))
      call('sessionTranscript', {
        agent: record.agent,
        providerSessionId: record.provider_session_id,
        ...(before !== undefined ? { before } : {})
      }).then(
        (page) =>
          setState((s) => {
            if (page.kind === 'found') {
              const text = s.text && page.text ? `${page.text}\n\n${s.text}` : page.text || s.text
              return { text, before: page.before, loading: false, problem: null }
            }
            const label =
              page.kind === 'missing'
                ? missingTranscriptLabel(page.retentionDays, record.started_at, Date.now())
                : UNSUPPORTED_TRANSCRIPT_LABEL
            const days = page.kind === 'missing' ? String(page.retentionDays) : ''
            return { ...s, loading: false, problem: label.text.replace('{{days}}', days) }
          }),
        (failure: unknown) =>
          setState((s) => ({ ...s, loading: false, problem: buildWebErrorMessage(failure) }))
      )
    },
    [call, record.agent, record.provider_session_id, record.started_at]
  )
  useEffect(() => read(), [read])
  return { ...state, readEarlier: () => state.before !== null && read(state.before) }
}

function TranscriptBody({ record }: { record: BuildWebAgentSessionRecord }) {
  const transcript = useSessionTranscript(record)
  return (
    <LogLinesPanel
      title={`${record.worktree_name || record.issue_key} · ${record.agent} log`}
      lines={transcript.text ? transcript.text.split('\n') : []}
      loading={transcript.loading}
      error={transcript.problem}
      before={
        transcript.before !== null ? (
          <CardButton
            label="Read earlier messages"
            disabled={transcript.loading}
            onPress={transcript.readEarlier}
          />
        ) : null
      }
    />
  )
}

/** The agent's own log of a task session, kept on the host that ran it — removed sessions too. */
export function SessionTranscriptSheet({
  record,
  onClose
}: {
  record: BuildWebAgentSessionRecord | null
  onClose: () => void
}) {
  return (
    <BottomDrawer visible={record !== null} onClose={onClose} fillAvailable>
      {record ? <TranscriptBody key={record.id} record={record} /> : null}
    </BottomDrawer>
  )
}
