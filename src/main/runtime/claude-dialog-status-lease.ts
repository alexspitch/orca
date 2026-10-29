import type { AgentStatusIpcPayload } from '../../shared/agent-status-types'
import { isClaudeDialogOnScreen } from './claude-open-dialog-hold'

// Why: Claude posts no hook while its dialog waits, so a waiting row decays at
// AGENT_STATUS_STALE_AFTER_MS and a row restored after a restart never confirms.
export const CLAUDE_DIALOG_LEASE_SWEEP_MS = 60 * 1000
export const CLAUDE_DIALOG_LEASE_RENEWAL_MS = 10 * 60 * 1000

export type ClaudeDialogLeaseDeps = {
  listPtyIds: () => Iterable<string>
  readPtyRows: (ptyId: string) => readonly AgentStatusIpcPayload[]
  /** Null when the screen model is partial or still hydrating: nothing is proven then. */
  readScreenLines: (ptyId: string) => readonly string[] | null
  renew: (paneKey: string, receivedAt: number) => void
  now?: number
}

function isDueClaudeDialogRow(row: AgentStatusIpcPayload, now: number): boolean {
  return (
    row.agentType === 'claude' &&
    (row.state === 'waiting' || row.state === 'blocked') &&
    row.providerSessionOnly !== true &&
    (row.restoredUnconfirmed === true ||
      now - (row.evidenceObservedAt ?? row.receivedAt) >= CLAUDE_DIALOG_LEASE_RENEWAL_MS)
  )
}

/** Renew each due Claude waiting row whose pane still shows the dialog. */
export function renewClaudeDialogStatuses(deps: ClaudeDialogLeaseDeps): void {
  const now = deps.now ?? Date.now()
  for (const ptyId of deps.listPtyIds()) {
    const due = deps.readPtyRows(ptyId).filter((row) => isDueClaudeDialogRow(row, now))
    if (due.length === 0) {
      continue
    }
    const lines = deps.readScreenLines(ptyId)
    if (!lines || !isClaudeDialogOnScreen(lines)) {
      continue
    }
    for (const row of due) {
      deps.renew(row.paneKey, row.receivedAt)
    }
  }
}
