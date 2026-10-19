import { describe, expect, it } from 'vitest'
import { useAppStore } from '@/store'
import { makeTab } from '@/store/slices/store-session-test-harness'
import { makeFolderWorkspace, makeWorktree } from '@/store/slices/worktrees-slice-test-fixtures'
import {
  AGENT_STATUS_STALE_AFTER_MS,
  type AgentStatusEntry,
  type AgentStatusState
} from '../../../shared/agent-status-types'
import { FLOATING_TERMINAL_WORKTREE_ID, getDefaultSettings } from '../../../shared/constants'
import type { ProjectGroup } from '../../../shared/project-group-types'
import { folderWorkspaceKey } from '../../../shared/workspace-scope'
import {
  createNeedsInputBadgeCountSelector,
  NEEDS_INPUT_BADGE_RECOUNT_MS,
  type NeedsInputBadgeCountState
} from './needs-input-badge-count-selector'

const NOW = new Date('2026-10-18T12:00:00.000Z').getTime()
const LEAF = '11111111-1111-4111-8111-111111111111'

function entry(tabId: string, worktreeId: string, state: AgentStatusState): AgentStatusEntry {
  return {
    state,
    prompt: '',
    updatedAt: NOW - 1_000,
    stateStartedAt: NOW - 1_000,
    agentType: 'claude',
    paneKey: `${tabId}:${LEAF}`,
    worktreeId,
    tabId,
    stateHistory: []
  }
}

const GROUP: ProjectGroup = {
  id: 'group-1',
  name: 'platform',
  parentPath: '/work',
  parentGroupId: null,
  createdFrom: 'manual',
  tabOrder: 0,
  isCollapsed: false,
  color: null,
  createdAt: 0,
  updatedAt: 0
}

/** One workspace per agent state, each with a single terminal tab holding that agent. */
function stateWith(
  agents: { workspaceId: string; state: AgentStatusState }[],
  overrides: Partial<NeedsInputBadgeCountState> = {}
): NeedsInputBadgeCountState {
  const tabsByWorktree: NeedsInputBadgeCountState['tabsByWorktree'] = {}
  const agentStatusByPaneKey: Record<string, AgentStatusEntry> = {}
  agents.forEach(({ workspaceId, state }, index) => {
    const tabId = `tab-${index}`
    tabsByWorktree[workspaceId] = [makeTab({ id: tabId, worktreeId: workspaceId })]
    const row = entry(tabId, workspaceId, state)
    agentStatusByPaneKey[row.paneKey] = row
  })
  return {
    ...useAppStore.getInitialState(),
    tabsByWorktree,
    agentStatusByPaneKey,
    ...overrides
  }
}

describe('createNeedsInputBadgeCountSelector', () => {
  it('counts workspaces with an agent waiting on the user, not finished or working ones', () => {
    const worktrees = ['blocked', 'waiting', 'done', 'working', 'archived'].map((name) =>
      makeWorktree({ id: `repo::${name}`, repoId: 'repo', isArchived: name === 'archived' })
    )
    const state = stateWith(
      [
        { workspaceId: 'repo::blocked', state: 'blocked' },
        { workspaceId: 'repo::waiting', state: 'waiting' },
        { workspaceId: 'repo::done', state: 'done' },
        { workspaceId: 'repo::working', state: 'working' },
        { workspaceId: 'repo::archived', state: 'blocked' }
      ],
      // An unread flag counts for nothing here: only a waiting agent does.
      { worktreesByRepo: { repo: worktrees.map((w) => ({ ...w, isUnread: true })) } }
    )

    expect(createNeedsInputBadgeCountSelector()(state, NOW, false)).toBe(2)
  })

  it('counts a folder workspace by its workspace key', () => {
    const folder = makeFolderWorkspace({ id: 'folder-1', projectGroupId: GROUP.id })
    const state = stateWith([{ workspaceId: folderWorkspaceKey(folder.id), state: 'waiting' }], {
      projectGroups: [GROUP],
      folderWorkspaces: [folder]
    })

    expect(createNeedsInputBadgeCountSelector()(state, NOW, false)).toBe(1)
  })

  it('adds the floating terminal only while it is enabled and its panel is closed', () => {
    const state = stateWith([{ workspaceId: FLOATING_TERMINAL_WORKTREE_ID, state: 'blocked' }], {
      settings: { ...getDefaultSettings('/tmp'), floatingTerminalEnabled: true }
    })
    const select = createNeedsInputBadgeCountSelector()

    expect(select(state, NOW, false)).toBe(1)
    expect(select(state, NOW, true)).toBe(0)
    expect(
      select(
        { ...state, settings: { ...getDefaultSettings('/tmp'), floatingTerminalEnabled: false } },
        NOW,
        false
      )
    ).toBe(0)
  })

  it('drops a waiting row that ages into not reporting, with no store write', () => {
    const state = stateWith([{ workspaceId: 'repo::blocked', state: 'blocked' }], {
      worktreesByRepo: { repo: [makeWorktree({ id: 'repo::blocked', repoId: 'repo' })] }
    })
    const select = createNeedsInputBadgeCountSelector()

    expect(select(state, NOW, false)).toBe(1)
    expect(select(state, NOW + NEEDS_INPUT_BADGE_RECOUNT_MS / 2, false)).toBe(1)
    expect(
      select(state, NOW + AGENT_STATUS_STALE_AFTER_MS + NEEDS_INPUT_BADGE_RECOUNT_MS, false)
    ).toBe(0)
  })
})
