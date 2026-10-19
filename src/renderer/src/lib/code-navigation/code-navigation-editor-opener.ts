import type { editor, IPosition, IRange, Uri } from 'monaco-editor'
import { useAppStore } from '@/store'
import {
  findMountedCodeEditorByEditor,
  getLastFocusedCodeEditor
} from '@/components/editor/mounted-code-editor-registry'
import {
  editorLocationOf,
  findTabGroupIdForTab,
  openEditorLocation,
  recordEditorJumpFrom
} from '@/components/editor/editor-location-navigation'
import { resolveCodeNavigationModelContext } from './code-navigation-document'

function startOf(selectionOrPosition: IRange | IPosition | undefined): IPosition {
  if (!selectionOrPosition) {
    return { lineNumber: 1, column: 1 }
  }
  if ('startLineNumber' in selectionOrPosition) {
    return {
      lineNumber: selectionOrPosition.startLineNumber,
      column: selectionOrPosition.startColumn
    }
  }
  return selectionOrPosition
}

/**
 * Monaco opens definition targets in other models through this hook. Orca answers with its own
 * tab + reveal flow; jumps inside the same model stay Monaco's and are only recorded for Back.
 */
export const codeNavigationEditorOpener: editor.ICodeEditorOpener = {
  openCodeEditor(
    source: editor.ICodeEditor,
    resource: Uri,
    selectionOrPosition?: IRange | IPosition
  ): boolean {
    const position = startOf(selectionOrPosition)
    const registered = findMountedCodeEditorByEditor(source)
    const targetUri = resource.toString()
    if (source.getModel()?.uri.toString() === targetUri) {
      const current = registered ? editorLocationOf(registered) : null
      if (current) {
        recordEditorJumpFrom(registered, {
          ...current,
          line: position.lineNumber,
          column: position.column
        })
      }
      return false
    }
    // Peek's embedded editor is not registered; its jumps count from the editor that opened it.
    const sourceEntry = registered ?? getLastFocusedCodeEditor()
    const context = resolveCodeNavigationModelContext(targetUri)
    if (!context) {
      return false
    }
    const state = useAppStore.getState()
    const target = {
      worktreeId: context.worktreeId,
      filePath: context.filePath,
      relativePath: context.relativePath,
      runtimeEnvironmentId: context.runtimeEnvironmentId,
      groupId:
        sourceEntry && sourceEntry.worktreeId === context.worktreeId
          ? findTabGroupIdForTab(state, context.worktreeId, sourceEntry.viewStateId)
          : undefined,
      line: position.lineNumber,
      column: position.column
    }
    recordEditorJumpFrom(sourceEntry, target)
    void openEditorLocation(target, { checkExists: false })
    return true
  }
}
