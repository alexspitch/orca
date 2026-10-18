import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { activateStructuredAgentSessionTab } from '@/lib/structured-agent-session-tab-activation'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import type { Tab } from '../../../../shared/tab-types'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'

// «Take to work» names its session after the task, so taking the task again opens that session.

/** The task key, or the batch's first three keys and how many more. */
export function taskSessionName(keys: string[]): string {
  const unique = [...new Set(keys)]
  const named = unique.slice(0, 3).join(', ')
  return unique.length > 3 ? `${named} +${unique.length - 3}` : named
}

export type NamedTaskSession = {
  kind: 'terminal' | 'structured'
  worktreeId: string
  tabId: string
}

type SessionTabsState = {
  activeWorktreeId: string | null
  tabsByWorktree: Record<string, TerminalTab[] | undefined>
  unifiedTabsByWorktree: Record<string, Tab[] | undefined>
}

const sameName = (title: string | null | undefined, name: string): boolean =>
  title?.trim().toLowerCase() === name.trim().toLowerCase()

/** An open tab whose own name (a rename or the launch label) is `name`; the active worktree's first. */
export function findNamedTaskSession(
  state: SessionTabsState,
  name: string
): NamedTaskSession | null {
  if (!name.trim()) {
    return null
  }
  const worktreeIds = [
    ...new Set([
      ...(state.activeWorktreeId ? [state.activeWorktreeId] : []),
      ...Object.keys(state.tabsByWorktree),
      ...Object.keys(state.unifiedTabsByWorktree)
    ])
  ]
  for (const worktreeId of worktreeIds) {
    const terminal = (state.tabsByWorktree[worktreeId] ?? []).find(
      (tab) => sameName(tab.customTitle, name) || sameName(tab.quickCommandLabel, name)
    )
    if (terminal) {
      return { kind: 'terminal', worktreeId, tabId: terminal.id }
    }
    const structured = (state.unifiedTabsByWorktree[worktreeId] ?? []).find(
      (tab) => tab.contentType === 'agent-session' && sameName(tab.customLabel, name)
    )
    if (structured) {
      return { kind: 'structured', worktreeId, tabId: structured.id }
    }
  }
  return null
}

/** Reveal the session named `name` if one is open; false when there is none. */
export function openNamedTaskSession(name: string): boolean {
  const state = useAppStore.getState()
  const found = findNamedTaskSession(state, name)
  if (!found) {
    return false
  }
  const hostId = state.getKnownWorktreeById(found.worktreeId)?.hostId
  if (
    activateAndRevealWorktree(
      found.worktreeId,
      hostId ? { executionHostId: hostId } : undefined
    ) === false
  ) {
    return false
  }
  if (found.kind === 'terminal') {
    activateTabAndFocusPane(found.tabId, null)
    return true
  }
  return activateStructuredAgentSessionTab({ worktreeId: found.worktreeId, tabId: found.tabId })
}
