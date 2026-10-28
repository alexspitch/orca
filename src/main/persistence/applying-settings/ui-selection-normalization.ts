import type { PersistedState } from '../../../shared/persisted-state-types'
import { getDefaultUIState } from '../../../shared/constants'
import { isPluginPanelTabKey } from '../../../shared/plugins/plugin-manifest'
import {
  STATIC_RIGHT_SIDEBAR_TABS,
  type StaticRightSidebarTab
} from '../../../shared/rpc-contract/client-ui-params'

export function normalizeGroupBy(groupBy: unknown): PersistedState['ui']['groupBy'] {
  if (
    groupBy === 'none' ||
    groupBy === 'workspace-status' ||
    groupBy === 'repo' ||
    groupBy === 'pr-status' ||
    groupBy === 'task'
  ) {
    return groupBy
  }
  if (groupBy === 'flat') {
    return 'none'
  }
  return getDefaultUIState().groupBy
}

export function normalizeShowDotfilesByWorktree(value: unknown): Record<string, boolean> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  const out: Record<string, boolean> = {}
  for (const [worktreeId, showDotfiles] of Object.entries(value as Record<string, unknown>)) {
    if (
      !worktreeId ||
      worktreeId === '__proto__' ||
      worktreeId === 'constructor' ||
      worktreeId === 'prototype' ||
      typeof showDotfiles !== 'boolean'
    ) {
      continue
    }
    out[worktreeId] = showDotfiles
  }
  return out
}

export function normalizeSortBy(sortBy: unknown): PersistedState['ui']['sortBy'] {
  if (
    sortBy === 'smart' ||
    sortBy === 'recent' ||
    sortBy === 'repo' ||
    sortBy === 'name' ||
    sortBy === 'manual'
  ) {
    return sortBy
  }
  return getDefaultUIState().sortBy
}

export function normalizeProjectOrderBy(
  projectOrderBy: unknown
): PersistedState['ui']['projectOrderBy'] {
  if (projectOrderBy === 'manual' || projectOrderBy === 'recent') {
    return projectOrderBy
  }
  return getDefaultUIState().projectOrderBy
}

function isStaticRightSidebarTab(tab: unknown): tab is StaticRightSidebarTab {
  return STATIC_RIGHT_SIDEBAR_TABS.some((known) => known === tab)
}

export function normalizeRightSidebarTab(tab: unknown): PersistedState['ui']['rightSidebarTab'] {
  // Why the shared list: a tab missing from a copy here reset to Explorer on every UI-state save.
  if (isStaticRightSidebarTab(tab)) {
    return tab
  }
  // Accept valid plugin panel keys so restored tabs do not fall back to Explorer.
  if (typeof tab === 'string' && isPluginPanelTabKey(tab)) {
    return tab
  }
  return getDefaultUIState().rightSidebarTab
}

export function normalizeRightSidebarExplorerView(
  view: unknown,
  tab?: unknown
): PersistedState['ui']['rightSidebarExplorerView'] {
  if (view === 'files' || view === 'search') {
    return view
  }
  // Legacy Search tabs lack explorer view; explicit views still take precedence.
  if (tab === 'search') {
    return 'search'
  }
  return getDefaultUIState().rightSidebarExplorerView
}
