// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CodeOutlineSymbol, CodePosition } from '@/lib/code-navigation/code-navigation-types'

const mocks = vi.hoisted(() => {
  const availabilityListeners = new Set<() => void>()
  return {
    availabilityListeners,
    getCodeOutline: vi.fn(),
    buildCodeNavigationDocument: vi.fn((model: { getLanguageId: () => string }) =>
      model.getLanguageId() === 'typescript' ? { doc: { model }, context: null } : null
    )
  }
})

vi.mock('@/lib/code-navigation/code-navigation-document', () => ({
  buildCodeNavigationDocument: mocks.buildCodeNavigationDocument
}))

vi.mock('@/lib/code-navigation/code-navigation-engine-registry', () => ({
  getCodeOutline: mocks.getCodeOutline,
  onDidChangeCodeNavigationAvailability: (listener: () => void) => {
    mocks.availabilityListeners.add(listener)
    return () => mocks.availabilityListeners.delete(listener)
  }
}))

const { useCodeOutlineSymbols, useCodeOutlineCursorPath, CODE_OUTLINE_MAX_MODEL_LENGTH } =
  await import('./use-code-outline')
type CodeOutlineEditor = Parameters<typeof useCodeOutlineSymbols>[0]

function symbol(id: string, startLine: number, endLine: number): CodeOutlineSymbol {
  const range = { startLineNumber: startLine, startColumn: 1, endLineNumber: endLine, endColumn: 2 }
  return { id, name: id, kind: 'function', range, selectionRange: range, children: [] }
}

/** Monaco-shaped editor whose events the test fires by hand. */
function createFakeEditor(options: { length?: number; languageId?: string } = {}) {
  const listeners = {
    content: new Set<() => void>(),
    model: new Set<() => void>(),
    language: new Set<() => void>(),
    cursor: new Set<() => void>()
  }
  let position: CodePosition | null = { lineNumber: 1, column: 1 }
  const model = {
    getValueLength: () => options.length ?? 10,
    getLanguageId: () => options.languageId ?? 'typescript'
  }
  const on = (set: Set<() => void>) => (listener: () => void) => {
    set.add(listener)
    return { dispose: () => set.delete(listener) }
  }
  const fire = (set: Set<() => void>): void => {
    for (const listener of set) {
      listener()
    }
  }
  return {
    editor: {
      getModel: () => model,
      getPosition: () => position,
      onDidChangeModel: on(listeners.model),
      onDidChangeModelContent: on(listeners.content),
      onDidChangeModelLanguage: on(listeners.language),
      onDidChangeCursorPosition: on(listeners.cursor)
    },
    listeners,
    editContent: () => fire(listeners.content),
    switchModel: () => fire(listeners.model),
    moveCursor: (next: CodePosition) => {
      position = next
      fire(listeners.cursor)
    }
  }
}

type FakeEditor = ReturnType<typeof createFakeEditor>

function asOutlineEditor(fake: FakeEditor): CodeOutlineEditor {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the hooks call only the editor and model members the fake implements.
  return fake.editor as unknown as CodeOutlineEditor
}

describe('useCodeOutline hooks', () => {
  let container: HTMLDivElement
  let root: Root
  let latest: { status: string; symbols: readonly CodeOutlineSymbol[]; path: readonly string[] }

  function Probe({ editor }: { editor: CodeOutlineEditor | null }): null {
    const outline = useCodeOutlineSymbols(editor)
    const path = useCodeOutlineCursorPath(editor, outline.symbols)
    latest = { status: outline.status, symbols: outline.symbols, path }
    return null
  }

  async function render(editor: CodeOutlineEditor | null): Promise<void> {
    await act(async () => root.render(<Probe editor={editor} />))
  }

  beforeEach(() => {
    vi.useFakeTimers()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mocks.getCodeOutline.mockReset()
    mocks.availabilityListeners.clear()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  it('outlines the model on mount and tracks the symbol around the caret', async () => {
    mocks.getCodeOutline.mockResolvedValue([symbol('first', 1, 3), symbol('second', 5, 9)])
    const fake = createFakeEditor()
    await render(asOutlineEditor(fake))

    expect(latest.status).toBe('ready')
    expect(latest.symbols.map((s) => s.id)).toEqual(['first', 'second'])
    expect(latest.path).toEqual(['first'])

    await act(async () => fake.moveCursor({ lineNumber: 6, column: 1 }))
    expect(latest.path).toEqual(['second'])
  })

  it('debounces edits and aborts a parse that a newer one supersedes', async () => {
    mocks.getCodeOutline.mockResolvedValue([symbol('first', 1, 3)])
    const fake = createFakeEditor()
    await render(asOutlineEditor(fake))
    expect(mocks.getCodeOutline).toHaveBeenCalledTimes(1)

    mocks.getCodeOutline.mockReturnValueOnce(new Promise(() => {}))
    await act(async () => {
      fake.editContent()
      vi.advanceTimersByTime(299)
    })
    expect(mocks.getCodeOutline).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTime(1))
    expect(mocks.getCodeOutline).toHaveBeenCalledTimes(2)
    const pendingSignal: AbortSignal = mocks.getCodeOutline.mock.calls[1][1]

    mocks.getCodeOutline.mockResolvedValueOnce([symbol('renamed', 1, 3)])
    await act(async () => {
      fake.editContent()
      vi.advanceTimersByTime(300)
    })
    expect(pendingSignal.aborted).toBe(true)
    expect(latest.symbols.map((s) => s.id)).toEqual(['renamed'])
  })

  it('re-asks when an engine becomes available and resets to loading on a model swap', async () => {
    mocks.getCodeOutline.mockResolvedValue([])
    const fake = createFakeEditor()
    await render(asOutlineEditor(fake))

    await act(async () => {
      for (const listener of mocks.availabilityListeners) {
        listener()
      }
      vi.advanceTimersByTime(300)
    })
    expect(mocks.getCodeOutline).toHaveBeenCalledTimes(2)

    mocks.getCodeOutline.mockReturnValueOnce(new Promise(() => {}))
    await act(async () => fake.switchModel())
    expect(latest.status).toBe('loading')
  })

  it('reports an oversized model without parsing it', async () => {
    const fake = createFakeEditor({ length: CODE_OUTLINE_MAX_MODEL_LENGTH + 1 })
    await render(asOutlineEditor(fake))

    expect(latest.status).toBe('too-large')
    expect(mocks.getCodeOutline).not.toHaveBeenCalled()
  })

  it('reads a model without an outline source as empty', async () => {
    const fake = createFakeEditor({ languageId: 'markdown' })
    await render(asOutlineEditor(fake))

    expect(latest.status).toBe('ready')
    expect(latest.symbols).toEqual([])
    expect(mocks.getCodeOutline).not.toHaveBeenCalled()
  })

  it('drops every editor listener on unmount', async () => {
    mocks.getCodeOutline.mockResolvedValue([])
    const fake = createFakeEditor()
    await render(asOutlineEditor(fake))
    await render(null)

    for (const set of Object.values(fake.listeners)) {
      expect(set.size).toBe(0)
    }
    expect(mocks.availabilityListeners.size).toBe(0)
  })
})
