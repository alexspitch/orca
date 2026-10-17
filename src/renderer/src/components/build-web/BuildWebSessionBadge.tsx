import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import {
  activateStructuredAgentSessionById,
  findStructuredAgentSessionTab
} from '@/lib/structured-agent-session-tab-activation'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { BuildWebAgentSession } from '../../../../shared/build-web-types'
import { parseExecutionHostId } from '../../../../shared/execution-host'

type Found = { worktreeId: string } | null

/** The worktree this client shows the session in, or null when it is not here. */
function findSession(session: BuildWebAgentSession): Found {
  const state = useAppStore.getState()
  if (!session.surface_id) {
    return null
  }
  if (session.surface_kind === 'terminal') {
    for (const [worktreeId, tabs] of Object.entries(state.tabsByWorktree)) {
      if ((tabs ?? []).some((tab) => tab.id === session.surface_id)) {
        return { worktreeId }
      }
    }
    return null
  }
  for (const worktreeId of Object.keys(state.unifiedTabsByWorktree)) {
    const tab = findStructuredAgentSessionTab(state.unifiedTabsByWorktree, {
      workspaceId: worktreeId,
      sessionId: session.surface_id
    })
    if (tab) {
      return { worktreeId }
    }
  }
  return null
}

function openSession(session: BuildWebAgentSession, found: NonNullable<Found>): void {
  const host = parseExecutionHostId(session.execution_host_id)
  const opts = host ? { executionHostId: host.id } : undefined
  if (activateAndRevealWorktree(found.worktreeId, opts) === false) {
    return
  }
  if (session.surface_kind === 'terminal') {
    activateTabAndFocusPane(session.surface_id, null)
  } else {
    activateStructuredAgentSessionById({
      worktreeId: found.worktreeId,
      sessionId: session.surface_id
    })
  }
}

/**
 * Which session holds the task. "Open here" says only that this client has its tab — not that the
 * agent runs; anywhere else is `unverifiable` (AGENTS.md, SSH use case).
 */
export function BuildWebSessionBadge({
  session
}: {
  session: BuildWebAgentSession
}): React.JSX.Element {
  // Why subscribe: a tab opening or closing elsewhere changes what the badge can say.
  useAppStore((s) => s.tabsByWorktree)
  useAppStore((s) => s.unifiedTabsByWorktree)
  const found = findSession(session)
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-xs">
      <Bot className="size-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">
        {translate('buildWeb.session.label', 'Agent session')}
      </span>
      <span>
        {session.agent} · {session.worktree_name}
      </span>
      <span className="text-muted-foreground">
        {found
          ? translate('buildWeb.session.openHere', 'open here')
          : translate('buildWeb.session.unverifiable', 'unverifiable')}
      </span>
      <div className="flex-1" />
      {found ? (
        <Button variant="link" size="xs" onClick={() => openSession(session, found)}>
          {translate('buildWeb.session.open', 'Open session')}
        </Button>
      ) : null}
    </div>
  )
}
