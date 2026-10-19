import { useEffect, useState } from 'react'
import type { editor } from 'monaco-editor'
import { buildCodeNavigationDocument } from '@/lib/code-navigation/code-navigation-document'
import {
  getCodeOutline,
  onDidChangeCodeNavigationAvailability
} from '@/lib/code-navigation/code-navigation-engine-registry'
import type { CodeOutlineSymbol } from '@/lib/code-navigation/code-navigation-types'
import { useMountedCodeEditor, type MountedCodeEditor } from './mounted-code-editor-registry'
import { codeOutlinePathsEqual, findCodeOutlineSymbolPath } from './code-outline-tree'

export type CodeOutlineStatus = 'loading' | 'ready' | 'too-large' | 'error'

export type CodeOutlineState = {
  status: CodeOutlineStatus
  symbols: readonly CodeOutlineSymbol[]
}

const CODE_OUTLINE_RECOMPUTE_DEBOUNCE_MS = 300
// Why: past this a parse per edit would stall typing, so the panel says so instead.
export const CODE_OUTLINE_MAX_MODEL_LENGTH = 3 * 1024 * 1024

const LOADING_OUTLINE: CodeOutlineState = { status: 'loading', symbols: [] }
const EMPTY_PATH: readonly string[] = []

export type CodeOutlineEditor = Pick<
  editor.IStandaloneCodeEditor,
  | 'getModel'
  | 'getPosition'
  | 'onDidChangeModel'
  | 'onDidChangeModelContent'
  | 'onDidChangeModelLanguage'
  | 'onDidChangeCursorPosition'
>

/** The outline of whatever model `editor` shows, recomputed as it changes. */
export function useCodeOutlineSymbols(editor: CodeOutlineEditor | null): CodeOutlineState {
  // Why tagged with its editor: a remounted editor must read as loading, not show the old outline.
  const [snapshot, setSnapshot] = useState<{
    editor: CodeOutlineEditor
    outline: CodeOutlineState
  } | null>(null)

  useEffect(() => {
    if (!editor) {
      return
    }
    let controller: AbortController | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    const publish = (outline: CodeOutlineState): void => setSnapshot({ editor, outline })

    const compute = (): void => {
      controller?.abort()
      controller = null
      const model = editor.getModel()
      if (model && model.getValueLength() > CODE_OUTLINE_MAX_MODEL_LENGTH) {
        publish({ status: 'too-large', symbols: [] })
        return
      }
      const run = new AbortController()
      controller = run
      const fail = (error: unknown): void => {
        if (!run.signal.aborted) {
          console.warn('[code-outline] outline failed', error)
          publish({ status: 'error', symbols: [] })
        }
      }
      try {
        const built = model ? buildCodeNavigationDocument(model) : null
        if (!built) {
          publish({ status: 'ready', symbols: [] })
          return
        }
        getCodeOutline(built.doc, run.signal).then((symbols) => {
          if (!run.signal.aborted) {
            publish({ status: 'ready', symbols })
          }
        }, fail)
      } catch (error) {
        fail(error)
      }
    }
    const cancelScheduled = (): void => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }
    const schedule = (): void => {
      cancelScheduled()
      timer = setTimeout(() => {
        timer = null
        compute()
      }, CODE_OUTLINE_RECOMPUTE_DEBOUNCE_MS)
    }
    const recomputeNow = (): void => {
      cancelScheduled()
      compute()
    }

    compute()
    const subscriptions = [
      // Why debounced: edits keep the last outline on screen until the next parse lands.
      editor.onDidChangeModelContent(schedule),
      editor.onDidChangeModel(() => {
        publish(LOADING_OUTLINE)
        recomputeNow()
      }),
      editor.onDidChangeModelLanguage(recomputeNow)
    ]
    const stopAvailability = onDidChangeCodeNavigationAvailability(schedule)
    return () => {
      for (const subscription of subscriptions) {
        subscription.dispose()
      }
      stopAvailability()
      cancelScheduled()
      controller?.abort()
    }
  }, [editor])

  return snapshot && snapshot.editor === editor ? snapshot.outline : LOADING_OUTLINE
}

/** Ids from the outermost to the deepest symbol around `editor`'s caret. */
export function useCodeOutlineCursorPath(
  editor: CodeOutlineEditor | null,
  symbols: readonly CodeOutlineSymbol[]
): readonly string[] {
  const [path, setPath] = useState<readonly string[]>(EMPTY_PATH)

  useEffect(() => {
    if (!editor) {
      return
    }
    const update = (): void => {
      const next = findCodeOutlineSymbolPath(symbols, editor.getPosition())
      // Why: the caret moves on every keystroke; only a symbol change should re-render the panel.
      setPath((previous) => (codeOutlinePathsEqual(previous, next) ? previous : next))
    }
    update()
    const subscription = editor.onDidChangeCursorPosition(update)
    return () => subscription.dispose()
  }, [editor, symbols])

  return editor ? path : EMPTY_PATH
}

export type CodeOutline = CodeOutlineState & {
  mounted: MountedCodeEditor | null
  cursorPath: readonly string[]
}

/** The outline of the code editor mounted in the pane `viewStateId`, with the caret's symbol path. */
export function useCodeOutline(viewStateId: string): CodeOutline {
  const mounted = useMountedCodeEditor(viewStateId)
  const editor = mounted?.editor ?? null
  const outline = useCodeOutlineSymbols(editor)
  const cursorPath = useCodeOutlineCursorPath(editor, outline.symbols)
  return { ...outline, mounted, cursorPath }
}
