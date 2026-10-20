import { useEffect, useState } from 'react'
import * as monaco from 'monaco-editor'
import type { editor } from 'monaco-editor'
import { setEditorGitBlame, useEditorGitBlame, type EditorGitBlame } from './editor-git-blame-store'

function readLineShas(
  model: editor.ITextModel,
  ids: readonly string[],
  shas: readonly string[]
): (string | null)[] {
  const out: (string | null)[] = Array.from({ length: model.getLineCount() }, () => null)
  const whole = new Set<number>()
  ids.forEach((id, i) => {
    const range = model.getDecorationRange(id)
    if (!range) {
      return
    }
    const at = range.startLineNumber - 1
    // Why: a deleted line's decoration collapses onto its neighbour; the neighbour's own one wins.
    if (out[at] === null || (!range.isEmpty() && !whole.has(at))) {
      out[at] = shas[i]
      if (!range.isEmpty()) {
        whole.add(at)
      }
    }
  })
  return out
}

/**
 * The blamed sha of each line while the text is edited: every line carries a decoration Monaco
 * moves with it, so a typed line has none and the lines around it keep theirs.
 */
export function useMonacoGitBlameLines(
  mountedEditor: editor.IStandaloneCodeEditor | null,
  fileId: string,
  blame: EditorGitBlame | undefined
): readonly (string | null)[] {
  const ready = blame?.status === 'ready' ? blame : null
  const [lines, setLines] = useState<readonly (string | null)[]>([])
  useEffect(() => {
    const model = mountedEditor?.getModel()
    if (!model || !ready) {
      setLines([])
      return
    }
    const placed = ready.lineShas.flatMap((sha, i) =>
      sha && i < model.getLineCount() ? [{ sha, line: i + 1 }] : []
    )
    const ids = model.deltaDecorations(
      [],
      placed.map(({ line }) => ({
        range: new monaco.Range(line, 1, line, model.getLineMaxColumn(line)),
        options: {
          description: 'orca-git-blame-line',
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      }))
    )
    const shas = placed.map((p) => p.sha)
    setLines(readLineShas(model, ids, shas))
    const subscription = model.onDidChangeContent(() => setLines(readLineShas(model, ids, shas)))
    return () => {
      subscription.dispose()
      if (model.isDisposed()) {
        return
      }
      const edited = readLineShas(model, ids, shas)
      model.deltaDecorations(ids, [])
      // Why: a tab switch unmounts the editor; the next mount starts where the edits left the lines.
      // A newer blame or a hide replaced this one, so only an unchanged entry is kept.
      if (useEditorGitBlame.getState().byFile[fileId] === ready) {
        setEditorGitBlame(fileId, { ...ready, lineShas: edited })
      }
    }
  }, [mountedEditor, fileId, ready])
  return lines
}
