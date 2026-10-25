import { useAppStore } from '@/store'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { isEditorTabContentType } from '@/store/slices/editor/tabs/editor-tab-content-type'
import { createWorkspaceTabCloseCommands } from '@/components/tab-group/workspace-tab-close-commands'
import { useBuildWebStore } from '@/components/build-web/build-web-store'
import {
  activeTaskTabId,
  closeTaskTab,
  useBuildWebTaskTabs
} from '@/components/build-web/build-web-task-tabs'
import { activeTabIdOf, armedLink, disarmLink, taskTabIds, type Origin } from './link-return-arm'
import {
  isPageHistoryView,
  setPageHistoryRestoring
} from '@/components/build-web/page-history/page-history-store'

// A file or task opened by a link is a detour: going back closes it and shows where the link was.

type Target =
  | { kind: 'file'; worktreeId: string; tabId: string; entityId: string }
  | { kind: 'task'; issueId: string }

type Detour = {
  target: Target
  origin: Origin
  /** Open before the link: going back shows the origin but leaves it open. */
  wasOpen: boolean
}

const DETOURS_KEPT = 20

let detours: Detour[] = []

function push(detour: Detour): void {
  disarmLink()
  detours = [...detours, detour].slice(-DETOURS_KEPT)
}

function isShown(target: Target): boolean {
  const app = useAppStore.getState()
  if (target.kind === 'task') {
    return (
      isPageHistoryView(app.activeView) &&
      activeTaskTabId(useBuildWebStore.getState()) === target.issueId
    )
  }
  return (
    app.activeView === 'terminal' &&
    app.activeWorktreeId === target.worktreeId &&
    activeTabIdOf(app, target.worktreeId) === target.tabId
  )
}

function restore(origin: Origin): void {
  const app = useAppStore.getState()
  if (isPageHistoryView(origin.view)) {
    // Why restoring: the page shows the card as it was, not the place Issues remembers.
    setPageHistoryRestoring(true)
    try {
      useBuildWebStore.setState(origin.card)
      app.setActiveView(origin.view)
    } finally {
      setTimeout(() => setPageHistoryRestoring(false), 0)
    }
    return
  }
  if (origin.view === 'terminal' && origin.worktreeId) {
    const hostId = app.getKnownWorktreeById(origin.worktreeId)?.hostId
    activateAndRevealWorktree(origin.worktreeId, hostId ? { executionHostId: hostId } : undefined)
    if (origin.tabId) {
      useAppStore.getState().activateTab(origin.tabId, { worktreeId: origin.worktreeId })
    }
    return
  }
  app.setActiveView(origin.view)
}

function close(target: Target): void {
  if (target.kind === 'task') {
    closeTaskTab(target.issueId)
    return
  }
  const app = useAppStore.getState()
  // Why: an edited file stays open; closing it would ask about the changes mid-gesture.
  if (app.openFiles.find((file) => file.id === target.entityId)?.isDirty) {
    return
  }
  createWorkspaceTabCloseCommands({
    worktreeId: target.worktreeId,
    groupTabs: app.unifiedTabsByWorktree[target.worktreeId] ?? []
  }).closeItem(target.tabId)
}

/** A link's file or task is in front. */
export function canGoBackFromLink(): boolean {
  const top = detours.at(-1)
  return top !== undefined && isShown(top.target)
}

/** Close the file or task a link opened, if it opened it, and show where the link was. */
export function goBackFromLink(): boolean {
  const top = detours.at(-1)
  if (!top || !isShown(top.target)) {
    return false
  }
  detours = detours.slice(0, -1)
  if (!top.wasOpen) {
    close(top.target)
  }
  restore(top.origin)
  return true
}

/** A target closed by hand: back to the origin when it was the one in front, else just forgotten. */
function forget(left: Detour[], shownBefore: (target: Target) => boolean): void {
  if (left.length === 0) {
    return
  }
  detours = detours.filter((d) => !left.includes(d))
  const shown = left.findLast((d) => shownBefore(d.target))
  if (shown) {
    // Why a macrotask: the close's own pick of the next tab runs first, then the origin wins.
    setTimeout(() => restore(shown.origin), 0)
  }
}

useAppStore.subscribe((state, prev) => {
  const armed = armedLink()
  if (armed && state.activeView === 'terminal' && state.activeWorktreeId) {
    const worktreeId = state.activeWorktreeId
    const tabId = activeTabIdOf(state, worktreeId)
    const tab = state.unifiedTabsByWorktree[worktreeId]?.find((t) => t.id === tabId)
    // Why against the armed state: switching worktrees first shows its old tab, not the target.
    if (
      tab &&
      isEditorTabContentType(tab.contentType) &&
      tabId !== activeTabIdOf(armed.app, worktreeId)
    ) {
      const wasOpen = (armed.app.unifiedTabsByWorktree[worktreeId] ?? []).some(
        (t) => t.id === tab.id
      )
      push({
        target: { kind: 'file', worktreeId, tabId: tab.id, entityId: tab.entityId },
        origin: armed.origin,
        wasOpen
      })
    }
  }
  if (state.unifiedTabsByWorktree === prev.unifiedTabsByWorktree) {
    return
  }
  const gone = detours.filter((d) => {
    if (d.target.kind !== 'file') {
      return false
    }
    const { worktreeId, tabId, entityId } = d.target
    const tab = state.unifiedTabsByWorktree[worktreeId]?.find((t) => t.id === tabId)
    return !tab || tab.entityId !== entityId
  })
  forget(gone, (target) => {
    if (target.kind !== 'file') {
      return false
    }
    // Why: a preview tab reused for another file is not a close; only a tab removed counts.
    const stillThere = state.unifiedTabsByWorktree[target.worktreeId]?.some(
      (t) => t.id === target.tabId
    )
    return (
      !stillThere &&
      prev.activeView === 'terminal' &&
      prev.activeWorktreeId === target.worktreeId &&
      activeTabIdOf(prev, target.worktreeId) === target.tabId
    )
  })
})

useBuildWebStore.subscribe((state) => {
  const armed = armedLink()
  if (!armed) {
    return
  }
  const issueId = activeTaskTabId(state)
  if (issueId && issueId !== activeTaskTabId(armed.origin.card)) {
    push({
      target: { kind: 'task', issueId },
      origin: armed.origin,
      wasOpen: armed.taskIds.has(issueId)
    })
  }
})

useBuildWebTaskTabs.subscribe(() => {
  const open = taskTabIds()
  const gone = detours.filter((d) => d.target.kind === 'task' && !open.has(d.target.issueId))
  // Why the card still up: closeTaskTab drops the tab before it moves the page off the card.
  forget(gone, (target) => target.kind === 'task' && isShown(target))
})
