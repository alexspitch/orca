import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import { isLiveEntry } from '@/store/slices/worktree-nav-history'
import { createWorkspaceTabCloseCommands } from '@/components/tab-group/workspace-tab-close-commands'
import { useBuildWebStore } from '@/components/build-web/build-web-store'
import { closeTaskTab } from '@/components/build-web/build-web-task-tabs'
import {
  isPageHistoryView,
  setPageHistoryRestoring
} from '@/components/build-web/page-history/page-history-store'
import { placeKey, taskTabIds, type Place } from './place-return-arm'
import type { CloseTarget } from './place-return-steps'

function hasTab(app: AppState, worktreeId: string, tabId: string): boolean {
  return (app.unifiedTabsByWorktree[worktreeId] ?? []).some((tab) => tab.id === tabId)
}

/**
 * `place` as it can be shown again from `now`: without its tab when that tab is gone, or null when
 * its workspace is gone or there is nothing to show that is not already on screen.
 */
export function restorablePlace(place: Place, now: Place): Place | null {
  let shown = place
  if (place.view === 'terminal') {
    const app = useAppStore.getState()
    if (!place.worktreeId || !isLiveEntry(place.worktreeId, app)) {
      return null
    }
    if (place.tabId && !hasTab(app, place.worktreeId, place.tabId)) {
      if (now.view === 'terminal' && now.worktreeId === place.worktreeId) {
        return null
      }
      shown = { ...place, tabId: null }
    }
  }
  return placeKey(shown) === placeKey(now) ? null : shown
}

export function restore(place: Place): void {
  const app = useAppStore.getState()
  if (isPageHistoryView(place.view)) {
    // Why restoring: the page shows the card as it was, not the place Issues remembers.
    setPageHistoryRestoring(true)
    try {
      useBuildWebStore.setState(place.card)
      app.setActiveView(place.view)
    } finally {
      setTimeout(() => setPageHistoryRestoring(false), 0)
    }
    return
  }
  if (place.view === 'terminal' && place.worktreeId) {
    const hostId = app.getKnownWorktreeById(place.worktreeId)?.hostId
    activateAndRevealWorkspace(place.worktreeId, hostId ? { executionHostId: hostId } : undefined)
    if (place.tabId && hasTab(useAppStore.getState(), place.worktreeId, place.tabId)) {
      useAppStore.getState().activateTab(place.tabId, { worktreeId: place.worktreeId })
    }
    return
  }
  // Why not open*Page: going back must not move the page's own "opened from" or rerun its opening.
  app.setActiveView(place.view)
}

/** Closes what a step opened, while it is still the one the step opened. */
export function close(target: CloseTarget): void {
  if (target.kind === 'task') {
    if (taskTabIds().has(target.issueId)) {
      closeTaskTab(target.issueId)
    }
    return
  }
  const app = useAppStore.getState()
  const groupTabs = app.unifiedTabsByWorktree[target.worktreeId] ?? []
  // Why: a preview tab reused for another file is no longer the one the link opened.
  if (!groupTabs.some((tab) => tab.id === target.tabId && tab.entityId === target.entityId)) {
    return
  }
  // Why: an edited file stays open; closing it would ask about the changes mid-gesture.
  if (app.openFiles.find((file) => file.id === target.entityId)?.isDirty) {
    return
  }
  createWorkspaceTabCloseCommands({ worktreeId: target.worktreeId, groupTabs }).closeItem(
    target.tabId
  )
}
