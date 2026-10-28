import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { runtimeRpcTargetForAuthorityKey } from '@/runtime/runtime-client-target'
import { translate } from '@/i18n/i18n'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import type { BuildWebAgentSessionRecord } from '../../../../shared/build-web-session-types'
import { parseExecutionHostId } from '../../../../shared/execution-host'
import {
  missingTranscriptLabel,
  UNSUPPORTED_TRANSCRIPT_LABEL
} from '../../../../shared/build-web-session-transcript'
import { callBuildWeb } from './build-web-client'
import { useBuildWebTarget } from './use-build-web-data'
import { logLinesOf } from './log-viewer/log-lines'
import { LogViewer } from './log-viewer/LogViewer'
import type { SessionListRow } from './BuildWebSessionList'

const KEEP_LINES = 100_000

/**
 * The host that ran the session: its worktree's while it is here; once removed, the server its
 * launcher named, else the host that holds build-web's token — where task sessions run.
 */
function transcriptTarget(row: SessionListRow, fallback: RuntimeClientTarget): RuntimeClientTarget {
  const hostId = row.worktree?.hostId ?? parseExecutionHostId(row.record.execution_host_id)?.id
  const target = hostId ? runtimeRpcTargetForAuthorityKey(hostId) : null
  if (row.worktree) {
    return target ?? fallback
  }
  return target?.kind === 'environment' ? target : fallback
}

type Transcript = { text: string; before: number | null; loading: boolean; problem: string | null }

/** The session's agent log through its host, a page at a time from the end. */
function useSessionTranscript(target: RuntimeClientTarget, record: BuildWebAgentSessionRecord) {
  const [state, setState] = useState<Transcript>({
    text: '',
    before: null,
    loading: true,
    problem: null
  })
  const targetKey = target.kind === 'local' ? 'local' : target.environmentId
  const read = useCallback(
    (before?: number) => {
      setState((s) => ({ ...s, loading: true }))
      callBuildWeb(target, 'sessionTranscript', {
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
            const days = page.kind === 'missing' ? page.retentionDays : 0
            return { ...s, loading: false, problem: translate(label.key, label.text, { days }) }
          }),
        (failure: unknown) =>
          setState((s) => ({
            ...s,
            loading: false,
            problem: failure instanceof Error ? failure.message : String(failure)
          }))
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `target` is a fresh object each render; its key names it.
    [targetKey, record.agent, record.provider_session_id, record.started_at]
  )
  useEffect(() => read(), [read])
  return { ...state, readEarlier: () => state.before !== null && read(state.before) }
}

function SessionLogBody({ row }: { row: SessionListRow }): React.JSX.Element {
  const { target: buildWebTarget } = useBuildWebTarget()
  const transcript = useSessionTranscript(transcriptTarget(row, buildWebTarget), row.record)
  const log = useMemo(() => logLinesOf(transcript.text, KEEP_LINES), [transcript.text])
  if (transcript.problem && !transcript.text) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {transcript.problem}
      </p>
    )
  }
  return (
    <div className="flex h-[65vh] min-h-0 flex-col gap-2">
      <LogViewer
        log={log}
        emptyLabel={
          transcript.loading
            ? undefined
            : translate('buildWeb.session.logEmpty', 'The log holds no messages yet.')
        }
        toolbar={
          transcript.loading ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              {translate('buildWeb.session.logReading', 'Reading the log…')}
            </>
          ) : transcript.before !== null ? (
            <Button variant="ghost" size="sm" onClick={transcript.readEarlier}>
              {translate('buildWeb.session.logEarlier', 'Read earlier messages')}
            </Button>
          ) : (
            translate('buildWeb.session.logWhole', 'The whole log is shown.')
          )
        }
      />
      {transcript.problem ? (
        <p role="alert" className="text-sm text-destructive">
          {transcript.problem}
        </p>
      ) : null}
    </div>
  )
}

/** A task session's agent log, read on the host that ran it — removed sessions too. */
export function BuildWebSessionLogDialog({
  row,
  onClose
}: {
  row: SessionListRow | null
  onClose: () => void
}): React.JSX.Element {
  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[min(1100px,92vw)]">
        <DialogHeader>
          <DialogTitle>
            <span className="font-mono text-sm">
              {row?.record.worktree_name || row?.record.issue_key}
            </span>
          </DialogTitle>
          <DialogDescription>
            {translate('buildWeb.session.logTitle', 'Session log')}
            {row
              ? ` · ${row.record.agent} · ${new Date(row.record.started_at).toLocaleString()}`
              : ''}
          </DialogDescription>
        </DialogHeader>
        {row ? <SessionLogBody key={row.record.id} row={row} /> : null}
      </DialogContent>
    </Dialog>
  )
}
