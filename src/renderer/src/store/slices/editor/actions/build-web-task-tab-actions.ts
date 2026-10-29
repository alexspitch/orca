import type { EditorGet, EditorSet } from '../types/editor-set-get'
import type { EditorSlice } from '../types/editor-slice'
import type { OpenFile } from '../types/open-file'
import { openWorkspaceEditorItem } from '../tabs/workspace-editor-item'

/** One tab per task in a worktree: opening the task again focuses it. */
export function buildWebTaskTabId(worktreeId: string, issueId: string): string {
  return `${worktreeId}::build-web-task::${issueId}`
}

export function createBuildWebTaskTabActions(
  set: EditorSet,
  get: EditorGet
): Pick<EditorSlice, 'openBuildWebTaskTab'> {
  return {
    openBuildWebTaskTab: (worktreeId, task) => {
      const id = buildWebTaskTabId(worktreeId, task.issueId)
      const label = task.key
      set((s) => {
        const focus = {
          activeFileId: id,
          activeTabType: 'editor' as const,
          activeFileIdByWorktree: { ...s.activeFileIdByWorktree, [worktreeId]: id },
          activeTabTypeByWorktree: { ...s.activeTabTypeByWorktree, [worktreeId]: 'editor' as const }
        }
        if (s.openFiles.some((f) => f.id === id)) {
          return {
            openFiles: s.openFiles.map((f) =>
              f.id === id ? { ...f, relativePath: label, buildWebTask: task } : f
            ),
            ...focus
          }
        }
        const file: OpenFile = {
          id,
          filePath: id,
          relativePath: label,
          worktreeId,
          language: 'plaintext',
          isDirty: false,
          mode: 'build-web-task',
          buildWebTask: task
        }
        return { openFiles: [...s.openFiles, file], ...focus }
      })
      void openWorkspaceEditorItem(get(), id, worktreeId, label, 'check-details')
    }
  }
}
