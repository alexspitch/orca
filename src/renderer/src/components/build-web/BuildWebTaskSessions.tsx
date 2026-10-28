import { useMemo } from 'react'
import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueDetail } from '../../../../shared/build-web-types'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  BUILD_WEB_AGENT_SESSION_STATE_LABELS,
  BUILD_WEB_SESSION_REASON_LABELS,
  BUILD_WEB_SESSION_STATE_LABELS,
  type BuildWebSessionLabel
} from '../../../../shared/build-web-session-labels'
import { joinSessionRows, type BuildWebSessionRow } from '../../../../shared/build-web-session-rows'
import { BuildWebToneChip } from './BuildWebToneChip'
import { BuildWebSessionBadge } from './BuildWebSessionBadge'
import { sessionStateTone } from './build-web-tones'
import { loginOf } from './build-web-labels'
import { useBuildWebStore } from './build-web-store'
import { revealBuildWebSession } from './build-web-session-worktree'

const word = (label: BuildWebSessionLabel): string => translate(label.key, label.text)

const when = (iso: string | null): string => (iso ? new Date(iso).toLocaleString() : '')

function SessionRow({ row }: { row: BuildWebSessionRow<Worktree> }): React.JSX.Element {
  const { record, worktree, attention } = row
  const state = attention
    ? word(BUILD_WEB_SESSION_STATE_LABELS.attention.full)
    : word(BUILD_WEB_AGENT_SESSION_STATE_LABELS[record.state])
  const note = attention?.reason
    ? word(BUILD_WEB_SESSION_REASON_LABELS[attention.reason].full)
    : record.removal_note
  const ended = record.ended_at ?? record.agent_finished_at
  return (
    <li className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <BuildWebToneChip
          label={state}
          tone={sessionStateTone(attention ? 'attention' : record.state)}
        />
        {worktree ? (
          <Button
            variant="link"
            size="xs"
            className="h-auto p-0 font-mono"
            onClick={() =>
              revealBuildWebSession(
                {
                  worktreeId: worktree.id,
                  ...(worktree.hostId ? { hostId: worktree.hostId } : {})
                },
                record.ended_at ? null : record
              )
            }
          >
            {worktree.displayName || record.worktree_name}
          </Button>
        ) : (
          <span className="font-mono text-muted-foreground">{record.worktree_name || '—'}</span>
        )}
        <span className="text-muted-foreground">
          {[record.agent, record.by ? loginOf(record.by) : ''].filter(Boolean).join(' · ')}
        </span>
        <span className="text-muted-foreground">
          {ended ? `${when(record.started_at)} – ${when(ended)}` : when(record.started_at)}
        </span>
      </div>
      {note ? (
        <p className={attention ? 'text-status-warning' : 'text-muted-foreground'}>{note}</p>
      ) : null}
    </li>
  )
}

/**
 * The task's sessions, newest first, each with the worktree that held it when it is still here.
 * A console without session history names only the current one.
 */
export function BuildWebTaskSessions({
  detail
}: {
  detail: Pick<BuildWebIssueDetail, 'id' | 'agent_session' | 'agent_sessions'>
}): React.JSX.Element | null {
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const consoleHost = useBuildWebStore((s) => s.status?.baseUrl ?? '')
  const records = detail.agent_sessions
  const rows = useMemo(
    () =>
      records
        ? joinSessionRows(
            records,
            Object.values(worktreesByRepo).flatMap((list) => list ?? []),
            detail.id,
            consoleHost
          )
        : [],
    [consoleHost, detail.id, records, worktreesByRepo]
  )
  if (!records) {
    return detail.agent_session ? <BuildWebSessionBadge session={detail.agent_session} /> : null
  }
  if (rows.length === 0) {
    return null
  }
  return (
    <section className="flex flex-col gap-1.5 rounded-md border border-border px-3 py-2 text-xs">
      <h3 className="flex items-center gap-2 text-muted-foreground">
        <Bot className="size-3.5 text-chip-tone-purple" />
        {translate('buildWeb.session.history', 'Sessions')}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <SessionRow key={row.record.id} row={row} />
        ))}
      </ul>
    </section>
  )
}
