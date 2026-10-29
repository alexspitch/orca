import React from 'react'
import { translate } from '@/i18n/i18n'
import { SidebarCountBadge } from './SidebarCountBadge'
import { useWorktreeAgentRows } from './useWorktreeAgentRows'

/** How many agents run in a workspace, shown from two on: a lone agent needs no count. */
export function WorktreeCardAgentCount({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  const agents = useWorktreeAgentRows(worktreeId)
  // Why not retained rows: their agents have exited; the rows only show how they ended.
  const running = agents.filter((agent) => agent.rowSource !== 'retained').length
  if (running < 2) {
    return null
  }
  return (
    <SidebarCountBadge
      small
      count={running}
      tone="neutral"
      hint={translate(
        'auto.components.sidebar.WorktreeCardAgents.runningCount',
        '{{count}} agents running',
        { count: running }
      )}
    />
  )
}
