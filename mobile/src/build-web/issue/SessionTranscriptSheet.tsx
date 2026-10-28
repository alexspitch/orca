import { useCallback, useEffect, useState } from 'react'
import type { BuildWebAgentSessionRecord } from '../../../../src/shared/build-web-session-types'
import {
  missingTranscriptLabel,
  UNSUPPORTED_TRANSCRIPT_LABEL,
  type BuildWebSessionTranscript
} from '../../../../src/shared/build-web-session-transcript'
import { BottomDrawer } from '../../components/BottomDrawer'
import type { RpcClient } from '../../transport/rpc-client'
import { buildWebErrorMessage, callBuildWeb } from '../build-web-operations'
import { LogLinesPanel } from '../LogLinesPanel'

type Transcript = {
  text: string
  before: number | null
  loading: boolean
  error: string | null
  /** The host's word that there is no log, worded at render against the current record. */
  gone: Exclude<BuildWebSessionTranscript, { kind: 'found' }> | null
}

const START: Transcript = { text: '', before: null, loading: true, error: null, gone: null }

function goneLabel(
  gone: NonNullable<Transcript['gone']>,
  record: BuildWebAgentSessionRecord
): string {
  const label =
    gone.kind === 'missing'
      ? missingTranscriptLabel(record, gone.retentionDays, Date.now())
      : { ...UNSUPPORTED_TRANSCRIPT_LABEL, days: 0 }
  return label.text.replace('{{days}}', String(label.days))
}

/** A session's agent log, read through the host that ran it a page at a time from its end. */
function useSessionTranscript(client: RpcClient, record: BuildWebAgentSessionRecord) {
  const [state, setState] = useState<Transcript>(START)
  const read = useCallback(
    (before?: number) => {
      setState((s) => ({ ...s, loading: true }))
      callBuildWeb(client, 'sessionTranscript', {
        agent: record.agent,
        providerSessionId: record.provider_session_id,
        ...(before !== undefined ? { before } : {})
      }).then(
        (page) =>
          setState((s) => {
            if (page.kind === 'found') {
              const text = s.text && page.text ? `${page.text}\n\n${s.text}` : page.text || s.text
              return { text, before: page.before, loading: false, error: null, gone: null }
            }
            return { ...s, loading: false, error: null, gone: page }
          }),
        (failure: unknown) =>
          setState((s) => ({ ...s, loading: false, error: buildWebErrorMessage(failure) }))
      )
    },
    [client, record.agent, record.provider_session_id]
  )
  useEffect(() => read(), [read])
  return {
    text: state.text,
    before: state.before,
    loading: state.loading,
    problem: state.error ?? (state.gone ? goneLabel(state.gone, record) : null),
    readEarlier: () => state.before !== null && read(state.before)
  }
}

function TranscriptBody({
  client,
  record
}: {
  client: RpcClient
  record: BuildWebAgentSessionRecord
}) {
  const transcript = useSessionTranscript(client, record)
  return (
    <LogLinesPanel
      title={`${record.worktree_name || record.issue_key} · ${record.agent} log`}
      lines={transcript.text ? transcript.text.split('\n') : []}
      loading={transcript.loading}
      error={transcript.problem}
      {...(transcript.before !== null
        ? { earlier: { loading: transcript.loading, read: transcript.readEarlier } }
        : {})}
    />
  )
}

/** The agent's own log of a task session, kept on the host that ran it — removed sessions too. */
export function SessionTranscriptSheet({
  open,
  onClose
}: {
  /** The session and the client of the host that ran it. */
  open: { record: BuildWebAgentSessionRecord; client: RpcClient } | null
  onClose: () => void
}) {
  return (
    <BottomDrawer visible={open !== null} onClose={onClose} fillAvailable>
      {open ? (
        <TranscriptBody key={open.record.id} client={open.client} record={open.record} />
      ) : null}
    </BottomDrawer>
  )
}
