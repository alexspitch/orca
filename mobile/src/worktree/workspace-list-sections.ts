import {
  buildWorktreeOccurrencePlan,
  type WorktreeOccurrenceSection
} from '../../../src/shared/worktree-occurrence-plan'
import type { WorkspaceStatusDefinition } from '../../../src/shared/worktree/types'
import {
  DEFAULT_WORKSPACE_STATUSES,
  getWorkspaceStatus,
  getWorkspaceStatusGroupKey,
  withDefaultWorkspaceStatuses
} from '../../../src/shared/workspace-statuses'
import {
  getMobileOccurrenceRows,
  getMobileWorkspaceLineageChildren
} from './mobile-workspace-lineage'
import {
  getPRGroupKeyForState,
  getPRLaneKey,
  PR_GROUP_LABELS,
  PR_GROUP_ORDER
} from '../../../src/shared/workspace-view/workspace-pr-groups'
import type { FilterState, Section, SectionRepo, Worktree } from './workspace-list-types'
import type {
  WorkspaceGroupBy,
  WorkspaceSortBy
} from '../../../src/shared/workspace-view/workspace-view-options'
import { hostSortsByStamps, sortWorktrees } from './workspace-list-ordering'
import { getWorktreeRowIdentity } from './worktree-host-row-identity'
import type { ExecutionHostId } from '../../../src/shared/execution-host'
import {
  buildProjectGroupingIndex,
  buildProjectSections,
  getProjectGroupingForRepo,
  type ProjectSectionModel
} from '../../../src/shared/project-section-grouping'
import { withRepoSectionDisplayLabels } from '../../../src/shared/project-section-order'
import type { ProjectOrderBy } from '../../../src/shared/ui-chrome-types'
import {
  TASK_ATTENTION_GROUP_KEY,
  isTaskSessionAttention
} from '../../../src/shared/sidebar-list/task-session-groups'
import { isSidebarGroupCollapsed } from '../../../src/shared/sidebar-list/default-collapsed-groups'
import { filterWorktrees } from './phone-workspace-row-filter'
import { buildTaskLaneSections } from './task-lane-sections'

export type { FilterState, Section, SectionRepo, Worktree } from './workspace-list-types'

export type ProjectSectionCatalog = {
  /** Catalog repos of the hosts the list shows; each without rows gets an empty section. */
  repos: readonly SectionRepo[]
  /** Null until the desktop's catalog answers; rows then group by repo, as the desktop's would. */
  grouping: ProjectSectionModel | null
  /** Manual header rank; undefined keeps first-row order. */
  repoOrder: ReadonlyMap<string, number> | undefined
  projectOrderBy: ProjectOrderBy
}

export const NO_PROJECT_SECTION_CATALOG: ProjectSectionCatalog = {
  repos: [],
  grouping: null,
  repoOrder: undefined,
  projectOrderBy: 'manual'
}

export function buildSectionRepoMap(
  catalogRepos: readonly SectionRepo[],
  worktrees: readonly Worktree[]
): Map<string, SectionRepo> {
  const repoMap = new Map(catalogRepos.map((repo) => [repo.id, repo]))
  for (const w of worktrees) {
    if (!repoMap.has(w.repoId)) {
      repoMap.set(w.repoId, {
        id: w.repoId,
        displayName: w.repo || 'Unknown',
        // Why: labels key on host + path, so a shared '' would let one stand-in rename another.
        path: w.repoId,
        executionHostId: w.hostId
      })
    }
  }
  return repoMap
}
export { getWorktreeStatus, sortWorktrees } from './workspace-list-ordering'
export { filterWorktrees, isWorktreeActive } from './phone-workspace-row-filter'

function makeSection(
  key: string,
  title: string,
  data: readonly Worktree[],
  decoration: { icon?: 'pin'; repo?: SectionRepo } = {}
): Section {
  return {
    key,
    title,
    ...(decoration.icon ? { icon: decoration.icon } : {}),
    ...(decoration.repo ? { repo: decoration.repo } : {}),
    data: [...data]
  }
}

function orderMainWorktreeFirst(worktrees: Worktree[]): Worktree[] {
  const mainWorktrees = worktrees.filter((worktree) => worktree.isMainWorktree)
  if (mainWorktrees.length === 0) {
    return worktrees
  }
  return [...mainWorktrees, ...worktrees.filter((worktree) => !worktree.isMainWorktree)]
}

export function isWorktreePinned(w: Worktree, localPins: Set<string>): boolean {
  return w.isPinned || localPins.has(w.worktreeId)
}

export function buildMobileWorkspacePlan(
  worktrees: Worktree[],
  sortMode: WorkspaceSortBy,
  filters: FilterState,
  search: string,
  groupMode: WorkspaceGroupBy,
  pinnedIds: Set<string>,
  projectCatalog: ProjectSectionCatalog = NO_PROJECT_SECTION_CATALOG,
  workspaceStatuses: readonly WorkspaceStatusDefinition[] = DEFAULT_WORKSPACE_STATUSES,
  _collapsedGroups: ReadonlySet<string> = new Set(),
  showPinnedInGroups = false,
  repoHostIdByRepoId: ReadonlyMap<string, ExecutionHostId> = new Map(),
  /** The connected host announces `build-web-worktree-task.v1`; the session filter waits for it. */
  hostKnowsTasks = false
) {
  const byTask = groupMode === 'task'
  const filtered = filterWorktrees(worktrees, filters, search, repoHostIdByRepoId, {
    hostKnowsTasks,
    keepArchivedAttention: byTask
  })
  const sorted = sortWorktrees(filtered, sortMode, Date.now(), hostSortsByStamps(worktrees))
  const childrenByParentIdentity = getMobileWorkspaceLineageChildren(
    filters.filterRepoIds.length > 0
      ? worktrees.filter((w) => filters.filterRepoIds.includes(w.repoId))
      : worktrees
  )
  const repoMap = buildSectionRepoMap(projectCatalog.repos, worktrees)
  const projectIndex = buildProjectGroupingIndex(projectCatalog.grouping ?? undefined)
  const occurrencePlan = buildWorktreeOccurrencePlan({
    rows: sorted,
    childrenByParentIdentity,
    identityOf: getWorktreeRowIdentity,
    isPinned: (worktree) => isWorktreePinned(worktree, pinnedIds),
    // Why: Needs attention outranks Pinned, even for a row under a pinned lineage parent.
    keepOutOfPinned: byTask ? isTaskSessionAttention : undefined,
    duplicatePinned: showPinnedInGroups,
    owningSectionOf: (worktree) =>
      getProjectGroupingForRepo(worktree.repoId, repoMap, projectIndex),
    projectIdOf: (worktree) => worktree.repoId,
    sectionsOf: ({ pinned, natural: canonicalGroupWorktrees, displayRootByIdentity }) => {
      const sections: Section[] = []
      const taskLanes = byTask ? buildTaskLaneSections(canonicalGroupWorktrees) : []
      // Needs attention sits above Pinned; it is the only lane emitted before it.
      sections.push(...taskLanes.filter((lane) => lane.key === TASK_ATTENTION_GROUP_KEY))
      if (pinned.length > 0) {
        sections.push(makeSection('pinned', 'Pinned', pinned, { icon: 'pin' }))
      }
      if (groupMode === 'none') {
        if (canonicalGroupWorktrees.length > 0) {
          sections.push(makeSection('all', 'All', canonicalGroupWorktrees))
        }
      } else if (groupMode === 'repo') {
        const representedRepoIds = new Set(worktrees.map((w) => w.repoId))
        const query = search.trim().toLowerCase()
        const placeholderRepoIds = projectCatalog.repos
          .filter(
            (repo) =>
              !representedRepoIds.has(repo.id) &&
              (filters.filterRepoIds.length === 0 || filters.filterRepoIds.includes(repo.id)) &&
              (!query || repo.displayName.toLowerCase().includes(query))
          )
          .map((repo) => repo.id)
        const projectSections = withRepoSectionDisplayLabels(
          buildProjectSections({
            items: canonicalGroupWorktrees,
            repoIdOf: (w) => w.repoId,
            displayRepoIdOf: (w) =>
              (displayRootByIdentity.get(getWorktreeRowIdentity(w)) ?? w).repoId,
            repoMap,
            projectIndex,
            placeholderRepoIds,
            repoOrder: projectCatalog.repoOrder,
            projectOrderBy: projectCatalog.projectOrderBy
          })
        )
        for (const [key, section] of projectSections) {
          sections.push(
            makeSection(key, section.label, orderMainWorktreeFirst(section.items), {
              repo: section.repo
            })
          )
        }
      } else if (groupMode === 'workspace-status') {
        const renderableWorkspaceStatuses = withDefaultWorkspaceStatuses(workspaceStatuses)
        const byStatus = new Map<string, Worktree[]>()
        for (const w of canonicalGroupWorktrees) {
          const key = getWorkspaceStatus(w, renderableWorkspaceStatuses)
          const list = byStatus.get(key)
          if (list) {
            list.push(w)
          } else {
            byStatus.set(key, [w])
          }
        }
        for (const status of renderableWorkspaceStatuses) {
          const items = byStatus.get(status.id)
          if (items && items.length > 0) {
            sections.push(makeSection(getWorkspaceStatusGroupKey(status.id), status.label, items))
          }
        }
      } else if (groupMode === 'pr-status') {
        const byGroup = new Map<string, Worktree[]>()
        for (const w of canonicalGroupWorktrees) {
          const key = getPRGroupKeyForState(w.linkedPR?.state)
          const list = byGroup.get(key)
          if (list) {
            list.push(w)
          } else {
            byGroup.set(key, [w])
          }
        }
        for (const groupKey of PR_GROUP_ORDER) {
          const items = byGroup.get(groupKey)
          if (items && items.length > 0) {
            sections.push(makeSection(getPRLaneKey(groupKey), PR_GROUP_LABELS[groupKey], items))
          }
        }
      } else if (byTask) {
        sections.push(...taskLanes.filter((lane) => lane.key !== TASK_ATTENTION_GROUP_KEY))
      }
      return sections.map((section): Section & WorktreeOccurrenceSection<Worktree> => ({
        ...section,
        items: section.data,
        placement: section.key === 'pinned' ? 'pinned' : 'natural'
      }))
    }
  })
  return {
    occurrencePlan,
    render: (collapsed: ReadonlySet<string>): Section[] =>
      occurrencePlan.sections.map((section) => ({
        key: section.key,
        title: section.title,
        ...(section.icon ? { icon: section.icon } : {}),
        ...(section.repo ? { repo: section.repo } : {}),
        data: getMobileOccurrenceRows(occurrencePlan, section.key, collapsed)
      }))
  }
}

/** Empties collapsed lanes; «Awaiting release» stays collapsed until its `:expanded` key is stored. */
export function collapseSections(
  sections: readonly Section[],
  collapsedGroups: ReadonlySet<string>
): Section[] {
  return sections.map((section) =>
    isSidebarGroupCollapsed(collapsedGroups, section.key) ? { ...section, data: [] } : section
  )
}

export function buildSections(...args: Parameters<typeof buildMobileWorkspacePlan>): Section[] {
  return buildMobileWorkspacePlan(...args).render(args[8] ?? new Set())
}
