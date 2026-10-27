import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { activateStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import type { Tab } from '../../../../shared/tab-types'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'

import {
  taskKeysLabel,
  taskSessionName,
  type TaskNameSource
} from '../../../../shared/build-web-task-session-name'

// «Take to work» names its session after the tasks, so taking them again opens that session.

export {
  claudeNameArgs,
  taskKeysLabel,
  taskSessionName,
  type TaskNameSource
} from '../../../../shared/build-web-task-session-name'

/** The names a session of these tasks may carry: today's, then the keys-only one of before. */
export function taskSessionNames(issues: readonly TaskNameSource[]): string[] {
  return [taskSessionName(issues), taskKeysLabel(issues.map((i) => i.key))]
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

/** An open tab whose own name (a rename or the launch label) is one of `names`; the active worktree's first. */
export function findNamedTaskSession(
  state: SessionTabsState,
  names: readonly string[]
): NamedTaskSession | null {
  const wanted = new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))
  if (wanted.size === 0) {
    return null
  }
  const sameName = (title: string | null | undefined): boolean =>
    wanted.has(title?.trim().toLowerCase() ?? '')
  const worktreeIds = [
    ...new Set([
      ...(state.activeWorktreeId ? [state.activeWorktreeId] : []),
      ...Object.keys(state.tabsByWorktree),
      ...Object.keys(state.unifiedTabsByWorktree)
    ])
  ]
  for (const worktreeId of worktreeIds) {
    const terminal = (state.tabsByWorktree[worktreeId] ?? []).find(
      (tab) => sameName(tab.customTitle) || sameName(tab.quickCommandLabel)
    )
    if (terminal) {
      return { kind: 'terminal', worktreeId, tabId: terminal.id }
    }
    const structured = (state.unifiedTabsByWorktree[worktreeId] ?? []).find(
      (tab) => tab.contentType === 'agent-session' && sameName(tab.customLabel)
    )
    if (structured) {
      return { kind: 'structured', worktreeId, tabId: structured.id }
    }
  }
  return null
}

/** Reveal the session named after these tasks if one is open; false when there is none. */
export function openNamedTaskSession(issues: readonly TaskNameSource[]): boolean {
  const state = useAppStore.getState()
  const found = findNamedTaskSession(state, taskSessionNames(issues))
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
