import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { useBuildWebStore, type BuildWebCardTab } from '@/components/build-web/build-web-store'
import { useBuildWebTaskTabs } from '@/components/build-web/build-web-task-tabs'

// Kept light: terminal and source-file links import it; the closing and restoring live elsewhere.

export type Origin = {
  view: AppState['activeView']
  worktreeId: string | null
  tabId: string | null
  card: {
    openIssueId: string | null
    fullScreen: boolean
    fullScreenFromDrawer: boolean
    openTab: BuildWebCardTab
  }
}

export type Armed = { origin: Origin; app: AppState; taskIds: ReadonlySet<string>; until: number }

// Why a window: a link opens its target asynchronously, a remote file in seconds.
const ARMED_MS = 8_000

let armed: Armed | null = null

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

function originOf(app: AppState): Origin {
  const { openIssueId, fullScreen, fullScreenFromDrawer, openTab } = useBuildWebStore.getState()
  return {
    view: app.activeView,
    worktreeId: app.activeWorktreeId,
    tabId: activeTabIdOf(app, app.activeWorktreeId),
    card: { openIssueId, fullScreen, fullScreenFromDrawer, openTab }
  }
}

/** Call before a link opens its file or task: the next one to come to the front is its target. */
export function armLinkReturn(): void {
  try {
    const app = useAppStore.getState()
    armed = { origin: originOf(app), app, taskIds: taskTabIds(), until: Date.now() + ARMED_MS }
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
