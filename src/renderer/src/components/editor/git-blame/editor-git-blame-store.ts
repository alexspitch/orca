import { create } from 'zustand'
import type { GitBlameCommit, GitFileBlame } from '../../../../../shared/git-blame'

export type EditorGitBlame =
  | { status: 'loading' }
  | {
      status: 'ready'
      commits: Record<string, GitBlameCommit>
      /** The sha of each line (index = line - 1) as edits have moved them; null for a new line. */
      lineShas: readonly (string | null)[]
    }

/** Git blame shown beside an editor, by open file id: it outlives a tab switch. */
export const useEditorGitBlame = create<{ byFile: Readonly<Record<string, EditorGitBlame>> }>(
  () => ({ byFile: {} })
)

export function setEditorGitBlame(fileId: string, blame: EditorGitBlame | null): void {
  useEditorGitBlame.setState((state) => {
    const byFile = { ...state.byFile }
    if (blame) {
      byFile[fileId] = blame
    } else {
      delete byFile[fileId]
    }
    return { byFile }
  })
}

export function lineShasOf(blame: GitFileBlame): (string | null)[] {
  const last = blame.ranges.reduce((end, r) => Math.max(end, r.startLine + r.lineCount - 1), 0)
  const shas: (string | null)[] = Array.from({ length: last }, () => null)
  for (const range of blame.ranges) {
    for (let i = 0; i < range.lineCount; i++) {
      shas[range.startLine - 1 + i] = range.sha
    }
  }
  return shas
}
