import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { useBuildWebStore } from '@/components/build-web/build-web-store'
import { activeTaskTabId, useBuildWebTaskTabs } from '@/components/build-web/build-web-task-tabs'
import { isEditorTabContentType } from '@/store/slices/editor/tabs/editor-tab-content-type'
import {
  activeTabIdOf,
  armedLink,
  disarmLink,
  isCardView,
  placeKey,
  placeOf,
  taskTabIds,
  type Armed,
  type Place
} from './place-return-arm'
import {
  clearSteps,
  dropStepsAfter,
  popStep,
  pushStep,
  retargetTop,
  topStep,
  type CloseTarget,
  type Step
} from './place-return-steps'
import { restorablePlace, restore } from './place-return-restore'

// Records where the user goes, one step per action: a page, a workspace, a tab, a task's card.

type Seen = { place: Place; app: AppState; taskIds: ReadonlySet<string> }

let seen: Seen | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let adopting = false

function look(): Seen {
  const app = useAppStore.getState()
  return { place: placeOf(app), app, taskIds: taskTabIds() }
}

function schedule(): void {
  // Why a macrotask: one action passes through several states (the view, then the workspace, then
  // its tab); only where it ends is a place.
  timer ??= setTimeout(flushPlaceRecording, 0)
}

/** The next look takes what is shown as it is, without a step: a move back is not a move forward. */
export function adoptNextPlace(): void {
  adopting = true
  schedule()
}

/** Records the place reached since the last look, if anything changed. */
export function flushPlaceRecording(): void {
  if (timer === null) {
    return
  }
  clearTimeout(timer)
  timer = null
  const prev = seen
  const next = look()
  seen = next
  if (adopting) {
    adopting = false
    return
  }
  if (prev && placeKey(prev.place) !== placeKey(next.place)) {
    record(prev, next)
  }
}

/** What the armed link brought up, with what going back closes; null when it is not its target. */
function linkTarget(armed: Armed, next: Seen): { close: CloseTarget | null } | null {
  const { view, worktreeId, tabId, card } = next.place
  if (view === 'terminal' && worktreeId && tabId) {
    const tab = next.app.unifiedTabsByWorktree[worktreeId]?.find((t) => t.id === tabId)
    // Why against the armed state: switching worktrees first shows its old tab, not the target.
    if (
      !tab ||
      !isEditorTabContentType(tab.contentType) ||
      tabId === activeTabIdOf(armed.app, worktreeId)
    ) {
      return null
    }
    const wasOpen = (armed.app.unifiedTabsByWorktree[worktreeId] ?? []).some((t) => t.id === tabId)
    return { close: wasOpen ? null : { kind: 'file', worktreeId, tabId, entityId: tab.entityId } }
  }
  const issueId = isCardView(view) ? activeTaskTabId(card) : null
  if (!issueId || issueId === activeTaskTabId(armed.origin.card)) {
    return null
  }
  return { close: armed.taskIds.has(issueId) ? null : { kind: 'task', issueId } }
}

/** The tab or task tab left is gone: the move was a close, not a step. */
function wasClosed(prev: Seen, next: Seen): boolean {
  const { view, worktreeId, tabId, card } = prev.place
  if (view === 'terminal') {
    return (
      worktreeId !== null &&
      tabId !== null &&
      !(next.app.unifiedTabsByWorktree[worktreeId] ?? []).some((t) => t.id === tabId)
    )
  }
  const issueId = isCardView(view) ? activeTaskTabId(card) : null
  return issueId !== null && prev.taskIds.has(issueId) && !next.taskIds.has(issueId)
}

/** Another split of the same workspace focused: both tabs were on screen before and still are. */
function isFocusMove(prev: Seen, next: Seen): boolean {
  const worktreeId = prev.place.worktreeId
  if (
    prev.place.view !== 'terminal' ||
    next.place.view !== 'terminal' ||
    !worktreeId ||
    worktreeId !== next.place.worktreeId
  ) {
    return false
  }
  const shown = (app: AppState, tabId: string | null): boolean =>
    tabId !== null && (app.groupsByWorktree[worktreeId] ?? []).some((g) => g.activeTabId === tabId)
  return shown(prev.app, next.place.tabId) && shown(next.app, prev.place.tabId)
}

/** A workspace shown before its tabs arrived: its first tab finishes the same move. */
function isUnsettledIn(place: Place, next: Place): boolean {
  return (
    place.view === 'terminal' &&
    next.view === 'terminal' &&
    place.worktreeId !== null &&
    place.worktreeId === next.worktreeId &&
    place.tabId === null
  )
}

/** A task's card brought up whose tab did not exist before: going back closes it. */
function taskOpened(prev: Seen, place: Place): CloseTarget | null {
  const issueId = isCardView(place.view) ? place.card.openIssueId : null
  return issueId && !prev.taskIds.has(issueId) ? { kind: 'task', issueId } : null
}

function leaveClosed(closed: Place, next: Place, top: Step | undefined): void {
  if (!top || placeKey(top.target) !== placeKey(closed)) {
    return
  }
  if (!top.close) {
    retargetTop(next)
    return
  }
  // Why: a file or task opened from somewhere and closed by hand shows where it was opened from.
  popStep()
  const origin = restorablePlace(top.origin, next)
  if (origin) {
    adoptNextPlace()
    restore(origin)
  }
}

function record(prev: Seen, next: Seen): void {
  const armed = armedLink()
  const link = armed ? linkTarget(armed, next) : null
  if (armed && link) {
    disarmLink()
    dropStepsAfter(armed.at)
    pushStep(armed.origin, next.place, link.close)
    return
  }
  const top = topStep()
  // Why: back where the last step started, by hand (a page's close, a tab, the titlebar's Back).
  if (top && placeKey(top.origin) === placeKey(next.place)) {
    popStep()
    return
  }
  if (wasClosed(prev, next)) {
    leaveClosed(prev.place, next.place, top)
    return
  }
  if (isFocusMove(prev, next)) {
    return
  }
  if (top && isUnsettledIn(top.target, next.place)) {
    retargetTop(next.place)
    return
  }
  // Why: an empty window before any workspace is chosen is no place to come back to.
  if (prev.place.view === 'terminal' && !prev.place.worktreeId) {
    return
  }
  pushStep(prev.place, next.place, taskOpened(prev, next.place))
}

/** Starts recording from what is on screen, with no way back yet; returns the stop. */
export function startPlaceRecording(): () => void {
  clearSteps()
  disarmLink()
  adopting = false
  seen = look()
  const offApp = useAppStore.subscribe((state, prev) => {
    if (
      state.activeView !== prev.activeView ||
      state.activeWorktreeId !== prev.activeWorktreeId ||
      state.activeGroupIdByWorktree !== prev.activeGroupIdByWorktree ||
      state.groupsByWorktree !== prev.groupsByWorktree ||
      state.unifiedTabsByWorktree !== prev.unifiedTabsByWorktree
    ) {
      schedule()
    }
  })
  // Why every field of the card: the place a step starts from keeps the card's tab to show again.
  const offCard = useBuildWebStore.subscribe((state, prev) => {
    if (
      state.openIssueId !== prev.openIssueId ||
      state.fullScreen !== prev.fullScreen ||
      state.fullScreenFromDrawer !== prev.fullScreenFromDrawer ||
      state.openTab !== prev.openTab ||
      state.contextKey !== prev.contextKey
    ) {
      schedule()
    }
  })
  const offTaskTabs = useBuildWebTaskTabs.subscribe(schedule)
  return () => {
    offApp()
    offCard()
    offTaskTabs()
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
}
