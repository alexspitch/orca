import React, { useMemo } from 'react'
import { GitBranch, GitPullRequest } from 'lucide-react'
import { AgentStateDot } from '@/components/AgentStateDot'
import { buildAgentRowLineageTree } from '@/components/dashboard/agent-row-lineage-model'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { formatAgentTypeLabel } from '../../../../shared/agent-type-label'
import { stripLeadingAgentTitleDecoration } from '../../../../shared/agent-title-decoration'
import { resolveTerminalTabTitle } from '../../../../shared/tab-title-resolution'
import { resolveRepoHeaderColor } from './project-header-color'
import { RepoIdentityChip } from './worktree-card-header'
import { WorktreeCardCompactHost } from './worktree-card-hover-cards'
import { formatSummaryStateLabel, getAgentDotState } from './worktree-card-agent-summary'
import { activateWorktreeAgentRow } from './worktree-agent-row-activation'
import { getReviewLabel } from './worktree-review-helpers'
import { useWorktreeAgentRows } from './useWorktreeAgentRows'
import type { WorktreeCardController } from './use-worktree-card-controller'
import type { WorktreeCardPresentation } from './worktree-card-presentation'

// IS-147: the current compact row opens to where its work lives (project, branch, PR, host) and
// one line per agent running in it, as the workspaces mockup draws it.

function CompactAgentLines({ worktreeId }: { worktreeId: string }): React.JSX.Element | null {
  const agents = useWorktreeAgentRows(worktreeId)
  const generatedTitlesEnabled = useAppStore((s) => s.settings?.tabAutoGenerateTitle === true)
  const rootAgents = useMemo(() => buildAgentRowLineageTree(agents).rootRows, [agents])
  if (rootAgents.length === 0) {
    return null
  }
  return (
    <div
      className="flex min-w-0 flex-col gap-0.5"
      role="group"
      aria-label={translate('auto.components.sidebar.WorktreeCardAgents.1b0a156717', 'Agents')}
      data-worktree-card-compact-agents=""
    >
      {rootAgents.map((agent) => {
        const state = getAgentDotState(agent)
        // Why the tab's title without its glyph: the line names the agent as its tab does, beside its own dot.
        const name = stripLeadingAgentTitleDecoration(
          resolveTerminalTabTitle(
            agent.tab,
            generatedTitlesEnabled,
            formatAgentTypeLabel(agent.agentType)
          )
        )
        // Why inert: a retained row is completion evidence; opening it would wake a sleeping session.
        const retained = agent.rowSource === 'retained'
        return (
          <button
            key={agent.paneKey}
            type="button"
            disabled={retained}
            className="flex h-5 min-w-0 items-center gap-1.5 rounded-[4px] text-left text-xs leading-4 text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring disabled:cursor-default"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              activateWorktreeAgentRow(worktreeId, agent.tab.id, agent.paneKey)
            }}
          >
            <span className="flex size-4 shrink-0 items-center justify-center">
              <AgentStateDot state={state} size="md" tooltipSide="right" />
            </span>
            <span className="min-w-0 truncate text-foreground">{name}</span>
            <span className="shrink-0">{formatSummaryStateLabel(state)}</span>
          </button>
        )
      })}
    </div>
  )
}

/** The opened compact row's second line and agent lines. */
export function WorktreeCardCompactDetails({
  card,
  presentation
}: {
  card: WorktreeCardController
  presentation: WorktreeCardPresentation
}): React.JSX.Element {
  const { worktree, repo, isFolder, branch, prDisplay } = card
  return (
    <>
      <div
        className="flex h-4 min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[11px] leading-4 text-muted-foreground"
        data-worktree-card-compact-meta=""
      >
        {repo ? (
          <RepoIdentityChip repo={repo} className="max-w-[110px] min-w-11 shrink">
            <RepoIconGlyph
              repoIcon={repo.repoIcon}
              color={resolveRepoHeaderColor(repo.badgeColor)}
              className="size-full"
              iconClassName="size-3"
            />
          </RepoIdentityChip>
        ) : null}
        {!isFolder && branch ? (
          <span className="inline-flex min-w-7 shrink items-center gap-[3px]">
            <GitBranch className="size-[11px] shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{branch}</span>
          </span>
        ) : null}
        {prDisplay ? (
          <span
            className="inline-flex shrink-0 items-center gap-[3px]"
            aria-label={`${getReviewLabel(prDisplay)} #${prDisplay.number}`}
          >
            <GitPullRequest className="size-[11px] shrink-0" aria-hidden />#{prDisplay.number}
          </span>
        ) : null}
        <WorktreeCardCompactHost card={card} presentation={presentation} />
        {worktree.isArchived ? (
          <span className="inline-flex h-4 shrink-0 items-center rounded-[4px] border border-worktree-sidebar-border px-[5px] text-[10px] font-medium">
            {translate('auto.components.sidebar.WorktreeCard.archivedBadge', 'archived')}
          </span>
        ) : null}
      </div>
      <CompactAgentLines worktreeId={worktree.id} />
    </>
  )
}
