import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { useBuildWebStore, type BuildWebCardTab } from '@/components/build-web/build-web-store'
import { useBuildWebTaskTabs } from '@/components/build-web/build-web-task-tabs'

// Kept light: terminal and source-file links import it; the recording and going back live elsewhere.

export type PlaceCard = {
  openIssueId: string | null
  fullScreen: boolean
  fullScreenFromDrawer: boolean
  openTab: BuildWebCardTab
}

/** What is on screen: a page, a workspace's tab, or a task's card on build-web's pages. */
export type Place = {
  view: AppState['activeView']
  worktreeId: string | null
  tabId: string | null
  card: PlaceCard
}

export type Armed = {
  origin: Place
  app: AppState
  taskIds: ReadonlySet<string>
  /** Steps recorded after this one belong to the link's way to its target. */
  at: number
  until: number
}

// Why a window: a link opens its target asynchronously, a remote file in seconds.
const ARMED_MS = 8_000

let armed: Armed | null = null
let serial = 0

/** Orders arming and steps: a step after the arm has a larger number. */
export function nextSerial(): number {
  serial += 1
  return serial
}

export function activeTabIdOf(state: AppState, worktreeId: string | null): string | null {
  if (!worktreeId) {
    return null
  }
  const groupId = state.activeGroupIdByWorktree[worktreeId]
  return state.groupsByWorktree[worktreeId]?.find((g) => g.id === groupId)?.activeTabId ?? null
}

export function taskTabIds(): ReadonlySet<string> {
  const context = useBuildWebStore.getState().contextKey
  const tabs = context ? useBuildWebTaskTabs.getState().byContext[context] : undefined
  return new Set((tabs ?? []).map((tab) => tab.id))
}

/** The pages that show a task's card over their list. */
export function isCardView(view: string): view is 'build-web' | 'build-web-testing' {
  return view === 'build-web' || view === 'build-web-testing'
}

export function placeOf(app: AppState): Place {
  const { openIssueId, fullScreen, fullScreenFromDrawer, openTab } = useBuildWebStore.getState()
  return {
    view: app.activeView,
    worktreeId: app.activeWorktreeId,
    tabId: activeTabIdOf(app, app.activeWorktreeId),
    card: { openIssueId, fullScreen, fullScreenFromDrawer, openTab }
  }
}

/** One place however it is shown: a card on another of its tabs, or full screen, is the same card. */
export function placeKey(place: Place): string {
  if (place.view === 'terminal') {
    return `terminal:${place.worktreeId ?? ''}:${place.tabId ?? ''}`
  }
  if (isCardView(place.view)) {
    return `${place.view}:${place.card.openIssueId ?? ''}`
  }
  return place.view
}

/** Call before a link opens its file or task: the next one to come to the front is its target. */
export function armLinkReturn(): void {
  try {
    const app = useAppStore.getState()
    armed = {
      origin: placeOf(app),
      app,
      taskIds: taskTabIds(),
      at: nextSerial(),
      until: Date.now() + ARMED_MS
    }
  } catch {
    // Why: the way back is an extra; a link must open even when the place it left cannot be read.
    armed = null
  }
}

/** The armed link while its window lasts. */
export function armedLink(): Armed | null {
  if (armed && Date.now() > armed.until) {
    armed = null
  }
  return armed
}

export function disarmLink(): void {
  armed = null
}
