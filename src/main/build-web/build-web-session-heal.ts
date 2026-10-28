import type { BuildWebIssueDetail } from '../../shared/build-web-types'
import type { RuntimeTerminalListResult } from '../../shared/runtime-terminal-contracts'
import type { RuntimeMobileSessionTabsResult } from '../../shared/runtime-session-contracts'
import {
  linkBuildWebSessionToWorktree,
  type BuildWebSessionLinkRuntime
} from './build-web-session-link'
import type { BuildWebTaskWorktree } from './build-web-task-worktrees'

// A task worktree without its session id (the PUT failed, the client dropped off, an older host
// started it): the task's current session is this worktree's when its surface is one of our tabs.

export type BuildWebSessionHealRuntime = BuildWebSessionLinkRuntime & {
  listTerminals: (
    selector: string,
    limit: number,
    opts: { requireFreshPtyLiveness?: boolean }
  ) => Promise<RuntimeTerminalListResult>
  listMobileSessionTabs: (selector: string) => Promise<RuntimeMobileSessionTabsResult>
}

const TERMINAL_LIMIT = 500

/** Terminal tab ids and structured session ids: what a console session names as its surface. */
async function worktreeSurfaceIds(
  runtime: BuildWebSessionHealRuntime,
  worktreeId: string
): Promise<Set<string>> {
  const selector = `id:${worktreeId}`
  const [terminals, tabs] = await Promise.all([
    runtime.listTerminals(selector, TERMINAL_LIMIT, {}).catch(() => null),
    runtime.listMobileSessionTabs(selector).catch(() => null)
  ])
  const ids = new Set<string>()
  for (const terminal of terminals?.terminals ?? []) {
    ids.add(terminal.tabId)
  }
  for (const tab of tabs?.tabs ?? []) {
    ids.add(tab.id)
    if (tab.type === 'agent-session') {
      ids.add(tab.sessionId)
    }
  }
  return ids
}

function currentSessions(issue: BuildWebIssueDetail): { id: string; surface_id: string }[] {
  const open = (issue.agent_sessions ?? []).filter((s) => !s.ended_at)
  return [issue.agent_session, ...open].flatMap((s) =>
    s?.id && s.surface_id ? [{ id: s.id, surface_id: s.surface_id }] : []
  )
}

export async function healBuildWebSessionLink(
  runtime: BuildWebSessionHealRuntime,
  row: BuildWebTaskWorktree,
  readIssue: (issueId: string) => Promise<BuildWebIssueDetail>
): Promise<boolean> {
  const issue = await readIssue(row.task.issueId).catch(() => null)
  const sessions = issue ? currentSessions(issue) : []
  if (sessions.length === 0) {
    return false
  }
  const surfaces = await worktreeSurfaceIds(runtime, row.worktreeId)
  const match = sessions.find((session) => surfaces.has(session.surface_id))
  return match
    ? linkBuildWebSessionToWorktree(runtime, {
        worktreeId: row.worktreeId,
        issueId: row.task.issueId,
        sessionId: match.id
      })
    : false
}
