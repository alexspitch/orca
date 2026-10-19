import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { detectLanguage } from '@/lib/language-detect'
import { requireRuntimeTargetForFileOwner } from '@/lib/file-owner-runtime-target'
import { getConnectionIdForFile } from '@/lib/connection-context'
import { selectMarkdownDocumentWorktreePath } from './markdown-document-worktree-path-selector'
import { runtimePathExists } from '@/runtime/runtime-file-metadata-client'
import { getOpenedEditFileIdAfterOpen } from '@/store/slices/editor/file-ids/editor-file-ids'
import { scheduleEditorLineReveal } from '@/store/slices/editor/focus/editor-focus-reveal'
import { toEditorModelUri } from './editor-model-uri'
import { getEditorModelOwnerKey } from './editor-model-owner'
import {
  findMountedCodeEditorsByModelUri,
  getLastFocusedCodeEditor,
  type MountedCodeEditor
} from './mounted-code-editor-registry'
import {
  recordEditorJump,
  dropUnreachableEditorNavigationTarget,
  stepEditorNavigationHistory,
  type EditorNavigationLocation
} from './editor-navigation-history'
import {
  getEditorNavigationHistory,
  setEditorNavigationHistory
} from './editor-navigation-history-store'

export function findTabGroupIdForTab(
  state: Pick<AppState, 'groupsByWorktree'>,
  worktreeId: string,
  tabId: string | undefined
): string | undefined {
  if (!tabId) {
    return undefined
  }
  return state.groupsByWorktree[worktreeId]?.find((group) => group.tabOrder.includes(tabId))?.id
}

/** Where a mounted editor's cursor is, as a history entry; null for non-edit surfaces. */
export function editorLocationOf(source: MountedCodeEditor): EditorNavigationLocation | null {
  const state = useAppStore.getState()
  const file = state.openFiles.find((entry) => entry.id === source.fileId)
  const position = source.editor.getPosition()
  if (!file || file.mode !== 'edit' || !position) {
    return null
  }
  return {
    worktreeId: file.worktreeId,
    filePath: file.filePath,
    relativePath: file.relativePath,
    runtimeEnvironmentId: file.runtimeEnvironmentId,
    groupId: findTabGroupIdForTab(state, file.worktreeId, source.viewStateId),
    line: position.lineNumber,
    column: position.column
  }
}

export function recordEditorJumpFrom(
  source: MountedCodeEditor | null,
  to: EditorNavigationLocation
): void {
  const from = source ? editorLocationOf(source) : null
  const worktreeId = to.worktreeId
  setEditorNavigationHistory(
    worktreeId,
    recordEditorJump(
      getEditorNavigationHistory(worktreeId),
      from && from.worktreeId === worktreeId ? from : null,
      to
    )
  )
}

/** Records a jump that started outside an editor (a search result): from the last focused one. */
export function recordEditorJumpFromLastFocused(to: EditorNavigationLocation): void {
  recordEditorJumpFrom(getLastFocusedCodeEditor(to.worktreeId), to)
}

function revealInEditor(target: MountedCodeEditor, location: EditorNavigationLocation): void {
  const position = { lineNumber: location.line, column: location.column }
  target.editor.setPosition(position)
  target.editor.revealPositionInCenterIfOutsideViewport(position)
  target.editor.focus()
}

async function locationStillExists(location: EditorNavigationLocation): Promise<boolean> {
  const state = useAppStore.getState()
  const isOpen = state.openFiles.some(
    (file) =>
      file.mode === 'edit' &&
      file.worktreeId === location.worktreeId &&
      file.filePath === location.filePath
  )
  if (isOpen) {
    return true
  }
  const worktreePath = selectMarkdownDocumentWorktreePath(state, location.worktreeId)
  if (!worktreePath) {
    return false
  }
  try {
    return await runtimePathExists(
      {
        target: requireRuntimeTargetForFileOwner(
          state,
          location.worktreeId,
          location.runtimeEnvironmentId
        ),
        worktreeId: location.worktreeId,
        worktreePath,
        connectionId: getConnectionIdForFile(location.worktreeId, location.filePath) ?? undefined
      },
      location.filePath
    )
  } catch {
    return false
  }
}

/** Shows `location`: in place when a pane already shows the file, else by opening its tab. */
export async function openEditorLocation(
  location: EditorNavigationLocation,
  options: { checkExists: boolean }
): Promise<boolean> {
  const state = useAppStore.getState()
  const openFile = state.openFiles.find(
    (file) =>
      file.mode === 'edit' &&
      file.worktreeId === location.worktreeId &&
      file.filePath === location.filePath
  )
  if (openFile) {
    const modelUri = toEditorModelUri(openFile.filePath, getEditorModelOwnerKey(openFile, state))
    const visible = findMountedCodeEditorsByModelUri(modelUri).find(
      (entry) =>
        !location.groupId ||
        findTabGroupIdForTab(state, location.worktreeId, entry.viewStateId) === location.groupId
    )
    if (visible) {
      revealInEditor(visible, location)
      return true
    }
  } else if (options.checkExists && !(await locationStillExists(location))) {
    return false
  }
  const groups = useAppStore.getState().groupsByWorktree[location.worktreeId] ?? []
  const groupId =
    location.groupId && groups.some((group) => group.id === location.groupId)
      ? location.groupId
      : useAppStore.getState().activeGroupIdByWorktree?.[location.worktreeId]
  useAppStore.getState().openFile(
    {
      filePath: location.filePath,
      relativePath: location.relativePath,
      worktreeId: location.worktreeId,
      runtimeEnvironmentId: location.runtimeEnvironmentId,
      language: detectLanguage(location.filePath),
      mode: 'edit'
    },
    { preview: true, targetGroupId: groupId, recordReplacedPreview: true, focusEditor: true }
  )
  const fileId = getOpenedEditFileIdAfterOpen(
    useAppStore.getState(),
    location.filePath,
    location.worktreeId
  )
  scheduleEditorLineReveal(
    useAppStore.getState,
    location.filePath,
    location.line,
    location.column,
    fileId
  )
  return true
}

let navigating = false

export async function navigateEditorHistory(
  direction: 'back' | 'forward',
  source: MountedCodeEditor | null = getLastFocusedCodeEditor()
): Promise<void> {
  const worktreeId = source?.worktreeId ?? useAppStore.getState().activeWorktreeId
  // Why: a held key repeats faster than a remote stat answers; overlapping steps would skip entries.
  if (!worktreeId || navigating) {
    return
  }
  navigating = true
  try {
    let current = source ? editorLocationOf(source) : null
    for (;;) {
      const step = stepEditorNavigationHistory(
        getEditorNavigationHistory(worktreeId),
        direction,
        current && current.worktreeId === worktreeId ? current : null
      )
      if (!step) {
        return
      }
      setEditorNavigationHistory(worktreeId, step.history)
      if (await openEditorLocation(step.target, { checkExists: true })) {
        return
      }
      // The file is gone: drop it and keep walking the same way.
      setEditorNavigationHistory(
        worktreeId,
        dropUnreachableEditorNavigationTarget(getEditorNavigationHistory(worktreeId), direction)
      )
      current = null
    }
  } finally {
    navigating = false
  }
}
