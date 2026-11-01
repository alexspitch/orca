import React, { useMemo } from 'react'
import { FlaskConical, SquareTerminal } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { buildAgentRowLineageTree } from '@/components/dashboard/agent-row-lineage-model'
import { useNow } from '@/hooks/use-now'
import { translate } from '@/i18n/i18n'
import {
  isTestRunCommand,
  type AgentBackgroundCommand
} from '../../../../shared/agent-background-commands'
import { formatCompactDuration } from '../../../../shared/agent-row-decay-state'
import { agentsUnderSession, countAgentSessions } from '../../../../shared/agent-session-counts'
import { SidebarCountBadge } from './SidebarCountBadge'
import { useWorktreeAgentRows } from './useWorktreeAgentRows'

/** Commands the workspace's running agents left in the background, oldest first. */
export function runningBackgroundCommands(
  agents: readonly DashboardAgentRow[]
): AgentBackgroundCommand[] {
  return agents
    .filter((agent) => agent.rowSource === 'live')
    .flatMap((agent) => agent.entry.backgroundCommands ?? [])
    .sort((a, b) => a.startedAt - b.startedAt)
}

// Why not retained rows: their agents have exited; the rows only show how they ended.
const isLiveAgentRow = (agent: DashboardAgentRow): boolean => agent.rowSource !== 'retained'

/** Live agents a session holds at any depth: its subagents and the agents it dispatched. */
export function countLiveAgentsUnderSession(
  sessionPaneKey: string,
  childrenByParentPaneKey: ReadonlyMap<string, readonly DashboardAgentRow[]>
): number {
  return agentsUnderSession(sessionPaneKey, childrenByParentPaneKey).filter(isLiveAgentRow).length
}

export function BackgroundCommandIcon({
  commands,
  className
}: {
  commands: readonly AgentBackgroundCommand[]
  className?: string
}): React.JSX.Element {
  const Icon = commands.some(isTestRunCommand) ? FlaskConical : SquareTerminal
  return <Icon className={className} aria-hidden />
}

function BackgroundCommandLines({
  commands
}: {
  commands: readonly AgentBackgroundCommand[]
}): React.JSX.Element {
  const now = useNow(30_000)
  return (
    <div className="flex flex-col gap-0.5">
      <div className="font-medium">
        {commands.some(isTestRunCommand)
          ? translate('auto.components.sidebar.WorktreeCardAgents.testsRunning', 'Tests running')
          : translate(
              'auto.components.sidebar.WorktreeCardAgents.backgroundCommands',
              'Running in the background'
            )}
      </div>
      {commands.map((command) => (
        <div key={command.id} className="text-muted-foreground">
          {command.description} · {formatCompactDuration(now - command.startedAt)}
        </div>
      ))}
    </div>
  )
}

/**
 * A workspace's agent facts at the end of its title line: what its agents run in the background,
 * then its active agent sessions out of all, shown from two sessions on.
 */
export function WorktreeCardAgentIndicators({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  const agents = useWorktreeAgentRows(worktreeId)
  // Why roots only: subagents and dispatched agents count under their session, not beside it.
  const sessions = useMemo(() => {
    const { rootRows, childrenByParentPaneKey } = buildAgentRowLineageTree(agents)
    return countAgentSessions(rootRows, childrenByParentPaneKey, isLiveAgentRow)
  }, [agents])
  const commands = runningBackgroundCommands(agents)
  if (sessions.total < 2 && commands.length === 0) {
    return null
  }
  return (
    <>
      {commands.length > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex shrink-0 items-center text-muted-foreground"
              data-worktree-card-background-commands=""
            >
              <BackgroundCommandIcon commands={commands} className="size-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="max-w-80">
            <BackgroundCommandLines commands={commands} />
          </TooltipContent>
        </Tooltip>
      ) : null}
      {sessions.total > 1 ? (
        <SidebarCountBadge
          small
          count={`${sessions.active}/${sessions.total}`}
          tone="neutral"
          hint={translate(
            'auto.components.sidebar.WorktreeCardAgents.activeSessionCount',
            '{{active}} of {{total}} agent sessions active',
            { active: sessions.active, total: sessions.total }
          )}
        />
      ) : null}
    </>
  )
}
