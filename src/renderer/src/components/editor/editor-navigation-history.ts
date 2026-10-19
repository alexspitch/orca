export type EditorNavigationLocation = {
  worktreeId: string
  filePath: string
  relativePath: string
  runtimeEnvironmentId: string | null | undefined
  /** Split group the location was in; a reopen falls back to the active group if it is gone. */
  groupId?: string
  line: number
  column: number
}

export type EditorNavigationHistory = {
  entries: readonly EditorNavigationLocation[]
  /** The entry the user is at; -1 when empty. */
  index: number
}

export const EMPTY_EDITOR_NAVIGATION_HISTORY: EditorNavigationHistory = { entries: [], index: -1 }

// Why: bounds per-session growth like worktree history; deeper stacks are never walked by hand.
export const MAX_EDITOR_NAVIGATION_ENTRIES = 50

export function isSameEditorFile(
  a: EditorNavigationLocation,
  b: EditorNavigationLocation
): boolean {
  return (
    a.worktreeId === b.worktreeId &&
    a.filePath === b.filePath &&
    (a.runtimeEnvironmentId ?? null) === (b.runtimeEnvironmentId ?? null)
  )
}

function isSamePlace(a: EditorNavigationLocation, b: EditorNavigationLocation): boolean {
  return isSameEditorFile(a, b) && a.line === b.line
}

function capped(entries: EditorNavigationLocation[], index: number): EditorNavigationHistory {
  const overflow = Math.max(0, entries.length - MAX_EDITOR_NAVIGATION_ENTRIES)
  return { entries: entries.slice(overflow), index: Math.max(0, index - overflow) }
}

/** Records a jump: forward entries are dropped, `from` and `to` become the newest entries. */
export function recordEditorJump(
  history: EditorNavigationHistory,
  from: EditorNavigationLocation | null,
  to: EditorNavigationLocation
): EditorNavigationHistory {
  const entries = history.entries.slice(0, history.index + 1)
  if (from) {
    const top = entries.at(-1)
    if (top && isSamePlace(top, from)) {
      entries[entries.length - 1] = from
    } else {
      entries.push(from)
    }
  }
  const top = entries.at(-1)
  if (top && isSamePlace(top, to)) {
    entries[entries.length - 1] = to
  } else {
    entries.push(to)
  }
  return capped(entries, entries.length - 1)
}

/**
 * Moves one step. `current` is where the user actually is now: in the current entry's file it
 * replaces that entry (so Forward returns there); in another file it is inserted as a new entry.
 */
export function stepEditorNavigationHistory(
  history: EditorNavigationHistory,
  direction: 'back' | 'forward',
  current: EditorNavigationLocation | null
): { history: EditorNavigationHistory; target: EditorNavigationLocation } | null {
  if (history.index < 0) {
    return null
  }
  let entries = history.entries.slice()
  let index = history.index
  if (current) {
    if (isSameEditorFile(entries[index], current)) {
      entries[index] = current
    } else {
      entries = entries.slice(0, index + 1)
      entries.push(current)
      index = entries.length - 1
    }
  }
  const targetIndex = direction === 'back' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= entries.length) {
    return null
  }
  const next = capped(entries, targetIndex)
  return { history: next, target: next.entries[next.index] }
}

/** Drops the step target that could not be opened and returns to the entry the step left. */
export function dropUnreachableEditorNavigationTarget(
  history: EditorNavigationHistory,
  direction: 'back' | 'forward'
): EditorNavigationHistory {
  const entries = history.entries.filter((_, index) => index !== history.index)
  if (entries.length === 0) {
    return EMPTY_EDITOR_NAVIGATION_HISTORY
  }
  // Back: the origin slid down into the removed slot. Forward: it sits just before it.
  const origin = direction === 'back' ? history.index : history.index - 1
  return { entries, index: Math.min(Math.max(origin, 0), entries.length - 1) }
}

export function canGoBackInEditorHistory(history: EditorNavigationHistory): boolean {
  return history.index > 0
}

export function canGoForwardInEditorHistory(history: EditorNavigationHistory): boolean {
  return history.index >= 0 && history.index < history.entries.length - 1
}
