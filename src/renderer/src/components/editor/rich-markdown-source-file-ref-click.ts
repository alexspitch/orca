import { getMarkRange } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'
import { parseSourceFileRef } from '@/components/source-file-ref/source-file-ref'
import { activateSourceFileRef } from '@/components/source-file-ref/source-file-ref-activate'

/** Opens the source file an inline code span at `pos` names; false when it names none. */
export function openRichMarkdownSourceFileRef(
  view: EditorView,
  pos: number,
  worktreeId: string
): boolean {
  const type = view.state.schema.marks.code
  const range = type ? getMarkRange(view.state.doc.resolve(pos), type) : undefined
  const ref = range ? parseSourceFileRef(view.state.doc.textBetween(range.from, range.to)) : null
  if (!range || !ref) {
    return false
  }
  const start = view.coordsAtPos(range.from)
  void activateSourceFileRef(
    ref,
    worktreeId,
    new DOMRect(start.left, start.top, 0, start.bottom - start.top)
  )
  return true
}
