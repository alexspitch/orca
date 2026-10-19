import { useSyncExternalStore } from 'react'
import {
  EMPTY_EDITOR_NAVIGATION_HISTORY,
  canGoBackInEditorHistory,
  canGoForwardInEditorHistory,
  type EditorNavigationHistory
} from './editor-navigation-history'

// Why outside zustand: session-only view state like the scroll/selection caches; entries are
// validated when walked, so worktree removal and renames need no store wiring.
const historyByWorktree = new Map<string, EditorNavigationHistory>()
const listeners = new Set<() => void>()

export function getEditorNavigationHistory(worktreeId: string): EditorNavigationHistory {
  return historyByWorktree.get(worktreeId) ?? EMPTY_EDITOR_NAVIGATION_HISTORY
}

export function setEditorNavigationHistory(
  worktreeId: string,
  history: EditorNavigationHistory
): void {
  if (historyByWorktree.get(worktreeId) === history) {
    return
  }
  historyByWorktree.set(worktreeId, history)
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useEditorNavigationAvailability(worktreeId: string | null | undefined): {
  canGoBack: boolean
  canGoForward: boolean
} {
  const history = useSyncExternalStore(subscribe, () =>
    worktreeId ? getEditorNavigationHistory(worktreeId) : EMPTY_EDITOR_NAVIGATION_HISTORY
  )
  return {
    canGoBack: canGoBackInEditorHistory(history),
    canGoForward: canGoForwardInEditorHistory(history)
  }
}

export function resetEditorNavigationHistoryForTests(): void {
  historyByWorktree.clear()
}
