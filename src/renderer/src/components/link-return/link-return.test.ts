import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/store', async () => {
  const { createUIStore } = await import('@/store/slices/ui-slice-test-harness')
  return { useAppStore: createUIStore() }
})

const mocks = vi.hoisted(() => ({
  reveal: vi.fn(),
  closeItem: vi.fn()
}))
vi.mock('@/lib/worktree-activation', () => ({ activateAndRevealWorktree: mocks.reveal }))
vi.mock('@/components/tab-group/workspace-tab-close-commands', () => ({
  createWorkspaceTabCloseCommands: () => ({ closeItem: mocks.closeItem })
}))

import { useAppStore } from '@/store'
import type { Tab } from '../../../../shared/tab-types'
import { useBuildWebStore } from '@/components/build-web/build-web-store'
import { keepTaskTab } from '@/components/build-web/build-web-task-tabs'
import { armLinkReturn, taskTabIds } from './link-return-arm'
import { canGoBackFromLink, goBackFromLink } from './link-return'

const WT = 'wt'
const activateTab = vi.fn()

type TabSpec = { id: string; contentType: 'terminal' | 'editor'; entityId: string }

/** The worktree's one group, with these tabs and `active` in front. */
function showWorktree(tabs: TabSpec[], active: string): void {
  const unified: Tab[] = tabs.map((t) => ({
    ...t,
    groupId: 'g',
    worktreeId: WT,
    label: t.id,
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 0
  }))
  useAppStore.setState({
    activeView: 'terminal',
    activeWorktreeId: WT,
    activeGroupIdByWorktree: { [WT]: 'g' },
    groupsByWorktree: {
      [WT]: [{ id: 'g', worktreeId: WT, activeTabId: active, tabOrder: tabs.map((t) => t.id) }]
    },
    unifiedTabsByWorktree: { [WT]: unified }
  })
}

const chat: TabSpec = { id: 'chat', contentType: 'terminal', entityId: 'pty' }
const file: TabSpec = { id: 'tab-f', contentType: 'editor', entityId: 'file-1' }

beforeEach(() => {
  vi.useRealTimers()
  mocks.reveal.mockReset()
  mocks.closeItem.mockReset()
  activateTab.mockReset()
  useAppStore.setState({ activateTab, getKnownWorktreeById: () => undefined, openFiles: [] })
  useBuildWebStore.getState().openIssue(null)
  // Leave no detour from an earlier case in front.
  while (goBackFromLink()) {
    /* drain */
  }
})

describe('a file opened by a link from a chat', () => {
  it('closes on Back and shows the chat again', () => {
    showWorktree([chat], 'chat')
    armLinkReturn()
    showWorktree([chat, file], 'tab-f')

    expect(canGoBackFromLink()).toBe(true)
    expect(goBackFromLink()).toBe(true)
    expect(mocks.closeItem).toHaveBeenCalledWith('tab-f')
    expect(mocks.reveal).toHaveBeenCalledWith(WT, undefined)
    expect(activateTab).toHaveBeenCalledWith('chat', { worktreeId: WT })
    expect(canGoBackFromLink()).toBe(false)
  })

  it('stays open on Back when it was open before the link', () => {
    showWorktree([chat, file], 'chat')
    armLinkReturn()
    showWorktree([chat, file], 'tab-f')

    expect(goBackFromLink()).toBe(true)
    expect(mocks.closeItem).not.toHaveBeenCalled()
    expect(activateTab).toHaveBeenCalledWith('chat', { worktreeId: WT })
  })

  it('closed by hand while in front, shows the chat again', async () => {
    vi.useFakeTimers()
    showWorktree([chat], 'chat')
    armLinkReturn()
    showWorktree([chat, file], 'tab-f')
    showWorktree([chat], 'chat')
    activateTab.mockReset()
    await vi.runAllTimersAsync()

    expect(activateTab).toHaveBeenCalledWith('chat', { worktreeId: WT })
    expect(canGoBackFromLink()).toBe(false)
  })

  it('is not a target while another tab is in front', () => {
    showWorktree([chat], 'chat')
    armLinkReturn()
    showWorktree([chat, file], 'tab-f')
    showWorktree([chat, file], 'chat')

    expect(canGoBackFromLink()).toBe(false)
    expect(goBackFromLink()).toBe(false)
  })
})

describe('a file opened from a task plan', () => {
  it('goes back to the plan of the card it was opened from', () => {
    useAppStore.setState({ activeView: 'build-web' })
    useBuildWebStore.getState().openIssue('i1', true, 'plan')
    armLinkReturn()
    useBuildWebStore.getState().openIssue(null)
    showWorktree([chat, file], 'tab-f')

    expect(goBackFromLink()).toBe(true)
    expect(useAppStore.getState().activeView).toBe('build-web')
    expect(useBuildWebStore.getState()).toMatchObject({
      openIssueId: 'i1',
      fullScreen: true,
      openTab: 'plan'
    })
  })
})

describe('a task opened by its number from a chat', () => {
  it('closes its tab on Back and shows the chat again', () => {
    useBuildWebStore.setState({ contextKey: 'host' })
    showWorktree([chat], 'chat')
    armLinkReturn()
    useAppStore.setState({ activeView: 'build-web' })
    useBuildWebStore.getState().openIssue('i9', true)
    keepTaskTab('i9')

    expect(goBackFromLink()).toBe(true)
    expect(taskTabIds().has('i9')).toBe(false)
    expect(activateTab).toHaveBeenCalledWith('chat', { worktreeId: WT })
  })
})
