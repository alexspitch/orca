import type { ExecutionHostId, ExecutionHostScope } from '../execution-host'
import type { ProjectOrderBy } from '../ui-chrome-types'
import type { WorkspaceRowFilters } from '../workspace-view/workspace-row-filters'
import { getWorktreeHostIdentity } from '../worktree/host-qualified-identity'
import type { WorkspaceStatusDefinition } from '../worktree/types'
import type { PinnedWorktreeDisplayPolicy, WorktreeGroupBy } from './row-types'
import type { SidebarFeedDomains } from './sidebar-feed-domains'
import type { SortBy } from './smart-sort'
import { isInputRequiredGroupShown, type InputRequiredReader } from './task-session-groups'

/** The host's view settings a reader shows the list with; the host's own phone reads them off ui.get. */
export type SidebarFeedView = {
  groupBy: WorktreeGroupBy
  /** «By task»'s Input required switch; absent means on. */
  showInputRequiredGroup?: boolean
  sortBy: SortBy
  projectOrderBy: ProjectOrderBy
  collapsedGroups: ReadonlySet<string>
  filters: WorkspaceRowFilters
  workspaceHostScope: ExecutionHostScope
  visibleWorkspaceHostIds: readonly ExecutionHostId[] | null
  workspaceStatuses: readonly WorkspaceStatusDefinition[]
  pinnedDisplayPolicy: PinnedWorktreeDisplayPolicy
  /** The host the desktop has focused (its settings' active runtime), where unowned rows land. */
  defaultHostId: ExecutionHostId
  hostLabelOverrides: ReadonlyMap<ExecutionHostId, string>
  /** The listed host's name for itself when the user has not renamed it. */
  localHostLabel: string
  /** The desktop window's own saved host order, which it writes; a phone reads the host's. */
  workspaceHostOrder?: readonly ExecutionHostId[]
}

/** The view's Input required reader: the host's own «needs input» verdict for the row's agents. */
export function feedInputRequiredReader(
  domains: Pick<SidebarFeedDomains, 'activity'>,
  view: Pick<SidebarFeedView, 'groupBy' | 'showInputRequiredGroup'>
): InputRequiredReader | undefined {
  return isInputRequiredGroupShown(view.groupBy, view.showInputRequiredGroup)
    ? (workspace) =>
        domains.activity.get(getWorktreeHostIdentity(workspace))?.agent === 'permission'
    : undefined
}
