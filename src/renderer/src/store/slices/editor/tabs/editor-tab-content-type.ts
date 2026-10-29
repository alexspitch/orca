import type { Tab } from '../../../../../../shared/tab-types'
import type { OpenFile } from '../types/open-file'

export type EditorTabContentType = Extract<
  Tab['contentType'],
  'editor' | 'diff' | 'conflict-review' | 'check-details'
>

export function isEditorTabContentType(
  contentType: Tab['contentType']
): contentType is EditorTabContentType {
  return (
    contentType === 'editor' ||
    contentType === 'diff' ||
    contentType === 'conflict-review' ||
    contentType === 'check-details'
  )
}

/** Editor tabs with no file behind them: their path is a synthetic id, never a workspace path. */
export function isVirtualEditorFile(file: Pick<OpenFile, 'mode'>): boolean {
  return file.mode === 'check-details' || file.mode === 'build-web-task'
}

export function editorTabContentTypeForMode(mode: OpenFile['mode']): EditorTabContentType {
  // Why check-details: a task card is the same memory-only virtual tab, a kind every client knows.
  if (mode === 'build-web-task') {
    return 'check-details'
  }
  return mode === 'conflict-review' || mode === 'check-details' || mode === 'diff' ? mode : 'editor'
}
