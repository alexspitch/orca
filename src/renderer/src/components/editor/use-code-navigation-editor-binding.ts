import { useEffect } from 'react'
import type { editor } from 'monaco-editor'
import { registerMountedCodeEditor } from './mounted-code-editor-registry'
import { installEditorNavigationHistoryShortcuts } from './editor-shortcuts'
import { navigateEditorHistory } from './editor-location-navigation'

/** Makes a mounted file editor a navigation source/target and gives it Back/Forward input. */
export function useCodeNavigationEditorBinding(params: {
  mountedEditor: editor.IStandaloneCodeEditor | null
  fileId: string
  viewStateId: string | undefined
  worktreeId: string | undefined
  codeNavigationEnabled: boolean
}): void {
  const { mountedEditor, fileId, viewStateId, worktreeId, codeNavigationEnabled } = params
  useEffect(() => {
    if (!mountedEditor) {
      return
    }
    const entry = { editor: mountedEditor, fileId, viewStateId, worktreeId, codeNavigationEnabled }
    const unregister = registerMountedCodeEditor(entry)
    const uninstallShortcuts = installEditorNavigationHistoryShortcuts(
      mountedEditor.getContainerDomNode(),
      (direction) => void navigateEditorHistory(direction, entry)
    )
    return () => {
      uninstallShortcuts()
      unregister()
    }
  }, [mountedEditor, fileId, viewStateId, worktreeId, codeNavigationEnabled])
}
