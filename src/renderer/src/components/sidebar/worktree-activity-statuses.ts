import type { AppState } from '@/store/types'
import { resolveWorktreeStatus, type WorktreeStatus } from '@/lib/worktree-status'
import { EMPTY_BROWSER_TABS, EMPTY_TABS } from './WorktreeCardHelpers'
import {
  selectLivePtyIdsForWorktree,
  selectTerminalLayoutRootsForWorktree,
  selectRuntimePaneTitlesForWorktree
} from './worktree-card-status-inputs'
import { selectWorktreeAgentActivitySummary } from './worktree-agent-activity-summary'

export type WorktreeActivityStatusState = Pick<
  AppState,
  | 'tabsByWorktree'
  | 'browserTabsByWorktree'
  | 'runtimePaneTitlesByTabId'
  | 'ptyIdsByTabId'
  | 'terminalLayoutsByTabId'
  | 'agentStatusEpoch'
  | 'agentStatusByPaneKey'
  | 'migrationUnsupportedByPtyId'
  | 'retainedAgentsByPaneKey'
  | 'runtimeAgentOrchestrationByPaneKey'
>

export function selectWorktreeActivityStatuses(
  statusInputs: WorktreeActivityStatusState,
  worktreeIds: readonly string[]
): Map<string, WorktreeStatus> {
  const statuses = new Map<string, WorktreeStatus>()
  for (const worktreeId of worktreeIds) {
    const {
      hasPermission,
      hasLiveWorking,
      hasLiveMonitoring,
      hasFailed,
      hasInterrupted,
      hasUnconfirmed,
      hasLiveDone,
      hasRetainedDone,
      hasRetainedFailed,
      agentStatusPaneIdsByTabId,
      stalePaneIdsByTabId
    } = selectWorktreeAgentActivitySummary(statusInputs, worktreeId)
    statuses.set(
      worktreeId,
      resolveWorktreeStatus({
        tabs: statusInputs.tabsByWorktree[worktreeId] ?? EMPTY_TABS,
        browserTabs: statusInputs.browserTabsByWorktree[worktreeId] ?? EMPTY_BROWSER_TABS,
        ptyIdsByTabId: selectLivePtyIdsForWorktree(statusInputs, worktreeId),
        runtimePaneTitlesByTabId: selectRuntimePaneTitlesForWorktree(statusInputs, worktreeId),
        agentStatusPaneIdsByTabId,
        stalePaneIdsByTabId,
        terminalLayoutRootsByTabId: selectTerminalLayoutRootsForWorktree(statusInputs, worktreeId),
        hasPermission,
        hasLiveWorking,
        hasLiveMonitoring,
        hasFailed,
        hasInterrupted,
        hasUnconfirmed,
        hasLiveDone,
        hasRetainedDone,
        hasRetainedFailed
      })
    )
  }
  return statuses
}
