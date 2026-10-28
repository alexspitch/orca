import type {
  RuntimeWorktreeAgentRow,
  RuntimeWorktreePsResult
} from '../../shared/runtime-worktree-contracts'
import type { RuntimeTerminalListResult } from '../../shared/runtime-terminal-contracts'
import type { TerminalProcessInspection } from '../../shared/terminal-process-inspection'

// Whether anything still runs in a closed task's worktree (IS-147). Idle means every agent row is
// done with no working children, and no other terminal has a child process. Unknown is never idle.

export type BuildWebWorktreeBusyReason = 'agent-running' | 'terminal-busy' | 'state-unknown'

export type BuildWebWorktreeActivity =
  | { kind: 'idle' }
  | { kind: 'busy'; reason: BuildWebWorktreeBusyReason }

export type BuildWebWorktreeActivityRuntime = {
  getWorktreePs: (limit: number) => Promise<RuntimeWorktreePsResult>
  listTerminals: (
    selector: string,
    limit: number,
    opts: { requireFreshPtyLiveness?: boolean }
  ) => Promise<RuntimeTerminalListResult>
  inspectTerminalProcess: (
    handle: string,
    options: { scanChildProcesses?: boolean }
  ) => Promise<TerminalProcessInspection>
}

// Why so large: the phone asks for every row too, and a row cut off by a limit reads as unknown.
export const BUILD_WEB_WORKTREE_PS_LIMIT = 10_000
const TERMINAL_LIMIT = 500

const busy = (reason: BuildWebWorktreeBusyReason): BuildWebWorktreeActivity => ({
  kind: 'busy',
  reason
})

function isAgentRowBusy(row: RuntimeWorktreeAgentRow): boolean {
  return (
    row.state !== 'done' ||
    (row.children ?? []).some(
      (child) => child.membership === 'live' && child.state !== 'done' && child.state !== 'idle'
    ) ||
    (row.subagents ?? []).some((subagent) => subagent.state !== 'idle')
  )
}

async function terminalHasChildren(
  runtime: BuildWebWorktreeActivityRuntime,
  handle: string
): Promise<boolean | null> {
  try {
    const inspection = await runtime.inspectTerminalProcess(handle, { scanChildProcesses: true })
    if (
      inspection.verdict === 'unverifiable' ||
      inspection.childProcessEvidence === 'unverifiable'
    ) {
      return null
    }
    return inspection.hasChildProcesses
  } catch {
    return null
  }
}

/** `ps` lets one tick read the process listing once for every worktree it looks at. */
export async function readBuildWebWorktreeActivity(
  runtime: BuildWebWorktreeActivityRuntime,
  worktreeId: string,
  ps?: RuntimeWorktreePsResult
): Promise<BuildWebWorktreeActivity> {
  const listing = ps ?? (await runtime.getWorktreePs(BUILD_WEB_WORKTREE_PS_LIMIT).catch(() => null))
  const row = listing?.worktrees.find((w) => w.worktreeId === worktreeId)
  if (!row || (row.unverifiableTerminalCount ?? 0) > 0) {
    return busy('state-unknown')
  }
  if (row.agents.some(isAgentRowBusy)) {
    return busy('agent-running')
  }
  const agentPanes = new Set(row.agents.map((agent) => agent.paneKey))
  const terminals = await runtime
    .listTerminals(`id:${worktreeId}`, TERMINAL_LIMIT, { requireFreshPtyLiveness: true })
    .catch(() => null)
  if (!terminals || terminals.truncated) {
    return busy('state-unknown')
  }
  for (const terminal of terminals.terminals) {
    if (terminal.verdict === 'unverifiable') {
      return busy('state-unknown')
    }
    const paneKey = `${terminal.tabId}:${terminal.leafId}`
    if (!terminal.ptyId || !terminal.connected || agentPanes.has(paneKey)) {
      continue
    }
    const hasChildren = await terminalHasChildren(runtime, terminal.handle)
    if (hasChildren === null) {
      return busy('state-unknown')
    }
    if (hasChildren) {
      return busy('terminal-busy')
    }
  }
  return { kind: 'idle' }
}
