import { Bot, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  BUILD_WEB_SESSION_STATE_LABELS,
  sessionHistoryLabel,
  sessionReasonLabels,
  type BuildWebSessionLabel
} from '../../../../shared/build-web-session-labels'
import type { BuildWebSessionRow } from '../../../../shared/build-web-session-rows'
import { BuildWebToneChip } from './BuildWebToneChip'
import { sessionStateTone } from './build-web-tones'
import { loginOf } from './build-web-labels'

export type SessionListRow = BuildWebSessionRow<Pick<Worktree, 'id' | 'hostId' | 'displayName'>>

const word = (label: BuildWebSessionLabel): string => translate(label.key, label.text)

const when = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''

function SessionRow({
  row,
  onOpen,
  onLog
}: {
  row: SessionListRow
  onOpen: (row: SessionListRow) => void
  onLog: (() => void) | null
}): React.JSX.Element {
  const { record, worktree, attention } = row
  const state = attention
    ? word(BUILD_WEB_SESSION_STATE_LABELS.attention.full)
    : word(sessionHistoryLabel(record.state))
  const note = attention?.reason
    ? word(
        sessionReasonLabels(attention.reason)?.full ?? BUILD_WEB_SESSION_STATE_LABELS.attention.full
      )
    : record.removal_note
  const ended = record.ended_at ?? record.agent_finished_at
  const who = [record.agent, record.by ? loginOf(record.by) : ''].filter(Boolean).join(' · ')
  return (
    <li className="flex flex-col gap-0.5">
      <div className="flex min-h-6 items-center gap-2">
        <BuildWebToneChip
          label={state}
          tone={sessionStateTone(attention ? 'attention' : record.state)}
        />
        {worktree ? (
          <button
            type="button"
            onClick={() => onOpen(row)}
            className="min-w-0 truncate font-mono hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {worktree.displayName || record.worktree_name}
          </button>
        ) : (
          <span className="min-w-0 truncate font-mono text-muted-foreground">
            {record.worktree_name || '—'}
          </span>
        )}
        <div className="flex-1" />
        {onLog ? (
          <Button variant="ghost" size="xs" onClick={onLog}>
            <ScrollText />
            {translate('buildWeb.session.log', 'Log')}
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground">
        {who} · {ended ? `${when(record.started_at)} – ${when(ended)}` : when(record.started_at)}
      </p>
      {note ? (
        <p className={attention ? 'text-status-warning' : 'text-muted-foreground'}>{note}</p>
      ) : null}
    </li>
  )
}

type SessionListProps = {
  rows: readonly SessionListRow[]
  /** Brings a row's worktree forward; only rows whose worktree is here offer it. */
  onOpen: (row: SessionListRow) => void
  /** The row's «Log»; null where the agent's session id is unknown or no host hands its log out. */
  logFor: (row: SessionListRow) => (() => void) | null
}

/** The sessions' rows alone, for a card that draws its own frame and title. */
export function BuildWebSessionRows({ rows, onOpen, logFor }: SessionListProps): React.JSX.Element {
  return (
    <ul className="flex flex-col gap-2 text-xs">
      {rows.map((row) => (
        <SessionRow key={row.record.id} row={row} onOpen={onOpen} onLog={logFor(row)} />
      ))}
    </ul>
  )
}

/** A task card's «Sessions», newest first: what each became, where it ran, and its log. */
export function BuildWebSessionList(props: SessionListProps): React.JSX.Element {
  return (
    <section className="flex flex-col gap-1.5 rounded-md border border-border px-3 py-2 text-xs">
      <h3 className="flex items-center gap-2 text-muted-foreground">
        <Bot className="size-3.5 text-chip-tone-purple" />
        {translate('buildWeb.session.history', 'Sessions')}
      </h3>
      <BuildWebSessionRows {...props} />
    </section>
  )
}
