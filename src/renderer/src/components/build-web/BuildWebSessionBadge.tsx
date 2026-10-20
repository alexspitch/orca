import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { activateStructuredAgentSessionById } from '@/lib/structured-agent-session-tab-activation'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { BuildWebAgentSession } from '../../../../shared/build-web-types'
import { BuildWebToneChip } from './BuildWebToneChip'
import { parseExecutionHostId } from '../../../../shared/execution-host'
import {
  findBuildWebSessionWorktree,
  type BuildWebSessionWorktree
} from './build-web-session-worktree'

function openSession(session: BuildWebAgentSession, found: BuildWebSessionWorktree): void {
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
  const found = findBuildWebSessionWorktree(session)
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-xs">
      <Bot className="size-3.5 text-chip-tone-purple" />
      <span className="text-muted-foreground">
        {translate('buildWeb.session.label', 'Agent session')}
      </span>
      <span>
        {session.agent} · {session.worktree_name}
      </span>
      <BuildWebToneChip
        label={
          found
            ? translate('buildWeb.session.openHere', 'open here')
            : translate('buildWeb.session.unverifiable', 'unverifiable')
        }
        tone={found ? 'green' : 'neutral'}
      />
      <div className="flex-1" />
      {found ? (
        <Button variant="link" size="xs" onClick={() => openSession(session, found)}>
          {translate('buildWeb.session.open', 'Open session')}
        </Button>
      ) : null}
    </div>
  )
}
