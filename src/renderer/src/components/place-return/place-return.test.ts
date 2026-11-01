import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/store', async () => {
  const { createUIStore } = await import('@/store/slices/ui-slice-test-harness')
  return { useAppStore: createUIStore() }
})

const mocks = vi.hoisted(() => ({
  reveal: vi.fn(),
  closeItem: vi.fn()
}))
vi.mock('@/lib/worktree-activation', () => ({ activateAndRevealWorkspace: mocks.reveal }))
vi.mock('@/components/tab-group/workspace-tab-close-commands', () => ({
  createWorkspaceTabCloseCommands: () => ({ closeItem: mocks.closeItem })
}))
vi.mock('@/store/slices/worktree-nav-history', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isLiveEntry: () => true
}))

import { useAppStore } from '@/store'
import type { Tab } from '../../../../shared/tab-types'
import { useBuildWebStore } from '@/components/build-web/build-web-store'
import { keepTaskTab, useBuildWebTaskTabs } from '@/components/build-web/build-web-task-tabs'
import { armLinkReturn, taskTabIds } from './place-return-arm'
import { startPlaceRecording } from './place-return-recording'
import { canGoBack, goBack } from './place-return'

const WT = 'wt'
const activateTab = vi.fn()

type TabSpec = { id: string; contentType: 'terminal' | 'editor'; entityId: string }

/** The worktree's one group, with these tabs and `active` in front. */
function showWorktree(tabs: TabSpec[], active: string, worktreeId = WT): void {
  const unified: Tab[] = tabs.map((t) => ({
    ...t,
    groupId: 'g',
    worktreeId,
    label: t.id,
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 0
  }))
  const s = useAppStore.getState()
  useAppStore.setState({
    activeView: 'terminal',
    activeWorktreeId: worktreeId,
    activeGroupIdByWorktree: { ...s.activeGroupIdByWorktree, [worktreeId]: 'g' },
    groupsByWorktree: {
      ...s.groupsByWorktree,
      [worktreeId]: [{ id: 'g', worktreeId, activeTabId: active, tabOrder: tabs.map((t) => t.id) }]
    },
    unifiedTabsByWorktree: { ...s.unifiedTabsByWorktree, [worktreeId]: unified }
  })
}

/** The action is over: its place is recorded. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

const chat: TabSpec = { id: 'chat', contentType: 'terminal', entityId: 'pty' }
const other: TabSpec = { id: 'other', contentType: 'terminal', entityId: 'pty-2' }
const file: TabSpec = { id: 'tab-f', contentType: 'editor', entityId: 'file-1' }

let stop: (() => void) | null = null

beforeEach(() => {
  stop?.()
  mocks.reveal.mockReset()
  mocks.closeItem.mockReset()
  activateTab.mockReset()
  useBuildWebTaskTabs.setState({ byContext: {} })
  useBuildWebStore.setState({ contextKey: 'host' })
  useBuildWebStore.getState().openIssue(null)
  useAppStore.setState({
    activateTab,
    getKnownWorktreeById: () => undefined,
    openFiles: [],
    activeGroupIdByWorktree: {},
    groupsByWorktree: {},
    unifiedTabsByWorktree: {}
  })
  showWorktree([chat], 'chat')
  stop = startPlaceRecording()
})

describe('a file opened by a link from a chat', () => {
  it('closes on Back and shows the chat again', async () => {
    armLinkReturn()
    showWorktree([chat, file], 'tab-f')
    await settle()

    expect(canGoBack()).toBe(true)
    expect(goBack()).toBe(true)
    expect(mocks.closeItem).toHaveBeenCalledWith('tab-f')
    expect(mocks.reveal).toHaveBeenCalledWith(WT, undefined)
    expect(activateTab).toHaveBeenCalledWith('chat', { worktreeId: WT })
    expect(canGoBack()).toBe(false)
  })

  it('stays open on Back when it was open before the link', async () => {
    showWorktree([chat, file], 'chat')
    await settle()
    armLinkReturn()
    showWorktree([chat, file], 'tab-f')
    await settle()

    expect(goBack()).toBe(true)
    expect(mocks.closeItem).not.toHaveBeenCalled()
    expect(activateTab).toHaveBeenCalledWith('chat', { worktreeId: WT })
  })

  it('closed by hand while in front, shows the chat again', async () => {
    showWorktree([chat, other], 'chat')
    await settle()
    armLinkReturn()
    showWorktree([chat, other, file], 'tab-f')
    await settle()
    showWorktree([chat, other], 'other')
    await settle()

    expect(activateTab).toHaveBeenCalledWith('chat', { worktreeId: WT })
    expect(canGoBack()).toBe(false)
  })

  it('leaves no way back once the chat is shown by hand', async () => {
    armLinkReturn()
    showWorktree([chat, file], 'tab-f')
    await settle()
    showWorktree([chat, file], 'chat')
    await settle()

    expect(canGoBack()).toBe(false)
    expect(goBack()).toBe(false)
  })

  it('in another workspace takes one Back, whatever it showed on the way', async () => {
    armLinkReturn()
    showWorktree([other], 'other', 'wt-b')
    await settle()
    showWorktree([other, file], 'tab-f', 'wt-b')
    await settle()

    expect(goBack()).toBe(true)
    expect(mocks.closeItem).toHaveBeenCalledWith('tab-f')
    expect(activateTab).toHaveBeenCalledWith('chat', { worktreeId: WT })
    expect(canGoBack()).toBe(false)
  })
})

describe('a file opened from a task plan', () => {
  it('goes back to the plan of the card it was opened from', async () => {
    useAppStore.setState({ activeView: 'build-web' })
    useBuildWebStore.getState().openIssue('i1', true, 'plan')
    await settle()
    armLinkReturn()
    useBuildWebStore.getState().openIssue(null)
    showWorktree([chat, file], 'tab-f')
    await settle()

    expect(goBack()).toBe(true)
    expect(useAppStore.getState().activeView).toBe('build-web')
    expect(useBuildWebStore.getState()).toMatchObject({
      openIssueId: 'i1',
      fullScreen: true,
      openTab: 'plan'
    })
  })
})

describe('a task opened by its number from a chat', () => {
  it('closes its tab on Back and shows the chat again', async () => {
    armLinkReturn()
    useAppStore.setState({ activeView: 'build-web' })
    useBuildWebStore.getState().openIssue('i9', true)
    keepTaskTab('i9')
    await settle()

    expect(goBack()).toBe(true)
    expect(taskTabIds().has('i9')).toBe(false)
    expect(activateTab).toHaveBeenCalledWith('chat', { worktreeId: WT })
  })
})

describe('moves without a link', () => {
  it('a new tab goes back to the tab before it and stays open', async () => {
    showWorktree([chat, other], 'other')
    await settle()

    expect(goBack()).toBe(true)
    expect(mocks.closeItem).not.toHaveBeenCalled()
    expect(activateTab).toHaveBeenCalledWith('chat', { worktreeId: WT })
  })

  it('pages chosen one after another go back one at a time', async () => {
    useAppStore.setState({ activeView: 'tasks' })
    await settle()
    useAppStore.setState({ activeView: 'settings' })
    await settle()

    expect(goBack()).toBe(true)
    expect(useAppStore.getState().activeView).toBe('tasks')
    await settle()
    expect(goBack()).toBe(true)
    expect(activateTab).toHaveBeenCalledWith('chat', { worktreeId: WT })
  })

  it('a page closed by hand leaves no way back to it', async () => {
    useAppStore.setState({ activeView: 'settings' })
    await settle()
    useAppStore.setState({ activeView: 'terminal' })
    await settle()

    expect(canGoBack()).toBe(false)
  })

  it('another workspace goes back to the one before, on its tab', async () => {
    showWorktree([other], 'other', 'wt-b')
    await settle()

    expect(goBack()).toBe(true)
    expect(mocks.reveal).toHaveBeenCalledWith(WT, undefined)
    expect(activateTab).toHaveBeenCalledWith('chat', { worktreeId: WT })
  })
})

describe('a task opened from the Issues list', () => {
  beforeEach(async () => {
    useAppStore.setState({ activeView: 'build-web' })
    await settle()
  })

  it('closes its new tab on Back and shows the list', async () => {
    useBuildWebStore.getState().openIssue('i5', true)
    keepTaskTab('i5')
    await settle()

    expect(goBack()).toBe(true)
    expect(taskTabIds().has('i5')).toBe(false)
    expect(useBuildWebStore.getState().openIssueId).toBeNull()
    expect(useAppStore.getState().activeView).toBe('build-web')
  })

  it('keeps a tab that was open before', async () => {
    keepTaskTab('i6')
    await settle()
    useBuildWebStore.getState().openIssue('i6', true)
    await settle()

    expect(goBack()).toBe(true)
    expect(taskTabIds().has('i6')).toBe(true)
    expect(useBuildWebStore.getState().openIssueId).toBeNull()
  })

  it('leaves the card in one Back after its own tabs were switched', async () => {
    useBuildWebStore.getState().openIssue('i7', true)
    keepTaskTab('i7')
    await settle()
    useBuildWebStore.setState({ openTab: 'plan' })
    await settle()

    expect(goBack()).toBe(true)
    expect(useBuildWebStore.getState().openIssueId).toBeNull()
    await settle()
    expect(goBack()).toBe(true)
    expect(activateTab).toHaveBeenCalledWith('chat', { worktreeId: WT })
  })
})
