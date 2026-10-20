import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/store', async () => {
  const { createUIStore } = await import('@/store/slices/ui-slice-test-harness')
  return { useAppStore: createUIStore() }
})

import { useAppStore } from '@/store'
import {
  setWorktreeNavActivator,
  setWorktreeNavViewActivator
} from '@/store/slices/worktree-nav-history'
import { applyWorktreeNavViewEntry } from '@/lib/worktree-nav-view-history-replay'
import { makeWorktree } from '@/store/slices/worktrees-slice-test-fixtures'
import { useBuildWebStore } from './build-web-store'
import { recordBuildWebCardVisit } from './build-web-card-history'

/** What opening a file in a worktree does: a visit, the terminal view, and the page's card gone. */
function leaveForWorktree(worktreeId: string): void {
  useAppStore.getState().recordWorktreeVisit(worktreeId)
  useAppStore.setState({ activeView: 'terminal' })
  useBuildWebStore.getState().openIssue(null)
}

beforeEach(() => {
  useAppStore.setState({
    activeView: 'terminal',
    worktreesByRepo: { r: [makeWorktree({ id: 'wt', repoId: 'r' })] },
    worktreeNavHistory: [],
    worktreeNavHistoryIndex: -1
  })
  useBuildWebStore.getState().openIssue(null)
  setWorktreeNavViewActivator(applyWorktreeNavViewEntry)
  setWorktreeNavActivator(() => {
    useAppStore.setState({ activeView: 'terminal' })
    return { primaryTabId: null }
  })
})

afterEach(() => {
  setWorktreeNavActivator(null)
  setWorktreeNavViewActivator(null)
})

describe('a task card left for a worktree', () => {
  it('comes back on Back as it was left, and Forward returns to the worktree', () => {
    useAppStore.getState().recordWorktreeVisit('wt')
    useAppStore.getState().openBuildWebPage()
    useBuildWebStore.getState().openIssue('i1')
    useBuildWebStore.getState().expandToFullScreen()
    useBuildWebStore.setState({ openTab: 'build' })

    recordBuildWebCardVisit()
    leaveForWorktree('wt')
    useAppStore.getState().goBackWorktree()

    expect(useAppStore.getState().activeView).toBe('build-web')
    expect(useBuildWebStore.getState()).toMatchObject({
      openIssueId: 'i1',
      fullScreen: true,
      fullScreenFromDrawer: true,
      openTab: 'build'
    })
    useAppStore.getState().goForwardWorktree()
    expect(useAppStore.getState().activeView).toBe('terminal')
  })

  it('comes back over the Testing list it was opened from', () => {
    useAppStore.getState().recordWorktreeVisit('wt')
    useAppStore.getState().openBuildWebTestingPage()
    useBuildWebStore.getState().openIssue('i2', true, 'guide')

    recordBuildWebCardVisit()
    leaveForWorktree('wt')
    useAppStore.getState().goBackWorktree()

    expect(useAppStore.getState().activeView).toBe('build-web-testing')
    expect(useBuildWebStore.getState()).toMatchObject({ openIssueId: 'i2', openTab: 'guide' })
  })

  it('records nothing when no card is open', () => {
    useAppStore.getState().recordWorktreeVisit('wt')
    useAppStore.getState().openBuildWebPage()
    recordBuildWebCardVisit()
    expect(useAppStore.getState().worktreeNavHistory).toEqual(['wt'])
  })
})
