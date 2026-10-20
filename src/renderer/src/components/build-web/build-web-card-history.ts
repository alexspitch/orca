import { useAppStore } from '@/store'
import type { WorktreeNavHistoryBuildWebCardEntry } from '@/store/slices/worktree-nav-history'
import { useBuildWebStore } from './build-web-store'

/**
 * Called just before a task card sends the user to a worktree, so Back returns to the card: the
 * build-web pages keep no history of their own, and the card closes with its page.
 */
export function recordBuildWebCardVisit(): void {
  const { activeView, recordViewVisit } = useAppStore.getState()
  const { openIssueId, fullScreen, fullScreenFromDrawer, openTab } = useBuildWebStore.getState()
  if (!openIssueId || (activeView !== 'build-web' && activeView !== 'build-web-testing')) {
    return
  }
  recordViewVisit({
    kind: 'build-web-card',
    view: activeView,
    issueId: openIssueId,
    fullScreen,
    fullScreenFromDrawer,
    tab: openTab
  })
}

/** Back or Forward onto a card: its page, with the card as it was left. */
export function showBuildWebCard(entry: WorktreeNavHistoryBuildWebCardEntry): void {
  useBuildWebStore.setState({
    openIssueId: entry.issueId,
    fullScreen: entry.fullScreen,
    fullScreenFromDrawer: entry.fullScreenFromDrawer,
    openTab: entry.tab
  })
  useAppStore.getState().setActiveView(entry.view)
}
