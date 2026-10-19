// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CodeOutlineSymbol, CodeSymbolKind } from '@/lib/code-navigation/code-navigation-types'
import type { CodeOutline } from './use-code-outline'

type FakeEditor = {
  setPosition: ReturnType<typeof vi.fn>
  revealRangeInCenterIfOutsideViewport: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
}
// The panel only touches these editor methods, so the mocked hook hands it a fake.
type FakeOutline = Omit<CodeOutline, 'mounted'> & {
  mounted: { editor: FakeEditor; fileId: string; viewStateId: string; worktreeId: string } | null
}

const mocks = vi.hoisted(() => {
  const state: { outline: FakeOutline | null } = { outline: null }
  return { state, recordEditorJumpFrom: vi.fn(), editorLocationOf: vi.fn() }
})

vi.mock('@tanstack/react-virtual', async () => {
  const { createVirtualizerStub } = await import('../automations/virtualizer-test-stub')
  return { useVirtualizer: createVirtualizerStub() }
})

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ codeOutlinePanelWidth: 240, setCodeOutlinePanelWidth: vi.fn() })
}))

vi.mock('./use-code-outline', () => ({
  useCodeOutline: () => mocks.state.outline
}))

vi.mock('./editor-location-navigation', () => ({
  editorLocationOf: mocks.editorLocationOf,
  recordEditorJumpFrom: mocks.recordEditorJumpFrom
}))

const { CodeOutlinePanel } = await import('./CodeOutlinePanel')

function symbol(
  id: string,
  kind: CodeSymbolKind,
  line: number,
  children: CodeOutlineSymbol[] = []
): CodeOutlineSymbol {
  return {
    id,
    name: id,
    kind,
    range: { startLineNumber: line, startColumn: 1, endLineNumber: line + 5, endColumn: 2 },
    selectionRange: {
      startLineNumber: line,
      startColumn: 7,
      endLineNumber: line,
      endColumn: 7 + id.length
    },
    children
  }
}

const symbols = [
  symbol('Parser', 'class', 1, [symbol('parseValue', 'method', 2), symbol('reset', 'method', 4)]),
  symbol('createParser', 'function', 10)
]

function setOutline(overrides: Partial<FakeOutline> = {}): FakeEditor {
  const editor: FakeEditor = {
    setPosition: vi.fn(),
    revealRangeInCenterIfOutsideViewport: vi.fn(),
    focus: vi.fn()
  }
  mocks.state.outline = {
    status: 'ready',
    symbols,
    cursorPath: ['Parser', 'reset'],
    mounted: { editor, fileId: 'file', viewStateId: 'tab', worktreeId: 'wt' },
    ...overrides
  }
  return editor
}

describe('CodeOutlinePanel', () => {
  let container: HTMLDivElement
  let root: Root
  const onClose = vi.fn()

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    onClose.mockReset()
    mocks.recordEditorJumpFrom.mockReset()
    mocks.editorLocationOf.mockReset()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(): void {
    act(() => root.render(<CodeOutlinePanel viewStateId="tab" onClose={onClose} />))
  }

  function rowNames(): string[] {
    return [...container.querySelectorAll('.markdown-toc-title')].map(
      (node) => node.textContent ?? ''
    )
  }

  function filterInput(): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>(
      'input[aria-label="Filter outline symbols"]'
    )
    if (!input) {
      throw new Error('filter input missing')
    }
    return input
  }

  function typeFilter(value: string): void {
    const input = filterInput()
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('renders a right-docked panel with symbols, a left-edge resize handle and the current row', () => {
    setOutline()
    render()

    const panel = container.querySelector('aside')
    expect(panel?.getAttribute('data-side')).toBe('right')
    expect(panel?.getAttribute('aria-label')).toBe('Outline')
    expect(rowNames()).toEqual(['Parser', 'parseValue', 'reset', 'createParser'])
    const handle = container.querySelector('[data-code-outline-resize-handle]')
    expect(handle?.getAttribute('aria-label')).toBe('Resize outline')
    expect(handle?.className).toContain('left-0')

    const current = container.querySelectorAll('[data-current="true"]')
    expect(current).toHaveLength(1)
    expect(current[0].textContent).toBe('reset')
  })

  it('marks the collapsed parent current when it hides the caret symbol', () => {
    setOutline()
    render()

    const collapse = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Collapse Parser"]'
    )
    act(() => collapse?.click())

    expect(rowNames()).toEqual(['Parser', 'createParser'])
    expect(container.querySelector('[data-current="true"]')?.textContent).toBe('Parser')
  })

  it('filters by name, keeps ancestors, and clears on Escape', () => {
    setOutline()
    render()

    typeFilter('VALUE')
    expect(rowNames()).toEqual(['Parser', 'parseValue'])

    typeFilter('nothing')
    expect(container.textContent).toContain('No matching symbols')

    act(() => {
      filterInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(filterInput().value).toBe('')
    expect(rowNames()).toEqual(['Parser', 'parseValue', 'reset', 'createParser'])
  })

  it('jumps to a clicked symbol and records the jump in editor history', () => {
    const editor = setOutline()
    mocks.editorLocationOf.mockReturnValue({
      worktreeId: 'wt',
      filePath: '/f.ts',
      line: 1,
      column: 1
    })
    render()

    const target = [
      ...container.querySelectorAll<HTMLButtonElement>('.markdown-toc-title-button')
    ].find((button) => button.textContent === 'createParser')
    act(() => target?.click())

    expect(mocks.recordEditorJumpFrom).toHaveBeenCalledWith(
      expect.objectContaining({ editor }),
      expect.objectContaining({ filePath: '/f.ts', line: 10, column: 7 })
    )
    expect(editor.setPosition).toHaveBeenCalledWith({ lineNumber: 10, column: 7 })
    expect(editor.revealRangeInCenterIfOutsideViewport).toHaveBeenCalledWith(
      symbols[1].selectionRange
    )
    expect(editor.focus).toHaveBeenCalled()
  })

  it('closes from the header button', () => {
    setOutline()
    render()

    act(() =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Close outline"]')?.click()
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['too-large', 'This file is too large for an outline'],
    ['error', 'The outline could not be built'],
    ['loading', 'Loading outline…']
  ] as const)('shows the %s state instead of rows', (status, message) => {
    setOutline({ status, symbols: [] })
    render()
    expect(container.textContent).toContain(message)
    expect(rowNames()).toEqual([])
  })

  it('says when the file has no symbols', () => {
    setOutline({ symbols: [], cursorPath: [] })
    render()
    expect(container.textContent).toContain('No symbols')
  })
})
