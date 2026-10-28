import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { BuildWebAgentSession } from '../../../../shared/build-web-types'
import { BuildWebToneChip } from './BuildWebToneChip'
import { findBuildWebSessionWorktree, revealBuildWebSession } from './build-web-session-worktree'

/**
 * Which session holds the task, from a console that keeps no session history. "Open here" says only that this client has its tab — not that the
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
        <Button variant="link" size="xs" onClick={() => revealBuildWebSession(found, session)}>
          {translate('buildWeb.session.open', 'Open session')}
        </Button>
      ) : null}
    </div>
  )
}
