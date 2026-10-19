import { useSyncExternalStore } from 'react'
import type { editor } from 'monaco-editor'

export type MountedCodeEditor = {
  editor: editor.IStandaloneCodeEditor
  fileId: string
  /** The pane's view-state scope (the unified tab id); undefined for surfaces outside a pane. */
  viewStateId: string | undefined
  worktreeId: string | undefined
  codeNavigationEnabled: boolean
}

const entries: MountedCodeEditor[] = []
const listeners = new Set<() => void>()
let lastFocused: MountedCodeEditor | null = null
// Why: useSyncExternalStore needs a stable snapshot between changes.
let version = 0

function notify(): void {
  version++
  for (const listener of listeners) {
    listener()
  }
}

export function registerMountedCodeEditor(entry: MountedCodeEditor): () => void {
  entries.push(entry)
  const focusSub = entry.editor.onDidFocusEditorText(() => {
    lastFocused = entry
  })
  if (entry.editor.hasTextFocus()) {
    lastFocused = entry
  }
  notify()
  return () => {
    focusSub.dispose()
    const index = entries.indexOf(entry)
    if (index !== -1) {
      entries.splice(index, 1)
    }
    if (lastFocused === entry) {
      lastFocused = null
    }
    notify()
  }
}

export function findMountedCodeEditorByEditor(target: unknown): MountedCodeEditor | null {
  return entries.find((entry) => entry.editor === target) ?? null
}

export function findMountedCodeEditorByViewStateId(
  viewStateId: string | undefined
): MountedCodeEditor | null {
  if (!viewStateId) {
    return null
  }
  return entries.find((entry) => entry.viewStateId === viewStateId) ?? null
}

/** Editors showing `modelUri`, most recently focused first. */
export function findMountedCodeEditorsByModelUri(modelUri: string): MountedCodeEditor[] {
  const matches = entries.filter((entry) => entry.editor.getModel()?.uri.toString() === modelUri)
  return lastFocused && matches.includes(lastFocused)
    ? [lastFocused, ...matches.filter((entry) => entry !== lastFocused)]
    : matches
}

export function getLastFocusedCodeEditor(worktreeId?: string): MountedCodeEditor | null {
  if (lastFocused && (!worktreeId || lastFocused.worktreeId === worktreeId)) {
    return lastFocused
  }
  return null
}

export function subscribeMountedCodeEditors(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getVersion(): number {
  return version
}

export function useMountedCodeEditor(viewStateId: string | undefined): MountedCodeEditor | null {
  useSyncExternalStore(subscribeMountedCodeEditors, getVersion, getVersion)
  return findMountedCodeEditorByViewStateId(viewStateId)
}
