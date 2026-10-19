// @vitest-environment happy-dom

import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ editorMounts: 0 }))

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  type OutlineVisibilityState = {
    codeOutlineVisible: boolean
    setCodeOutlineVisible: (visible: boolean) => void
  }
  return {
    useAppStore: create<OutlineVisibilityState>()((set) => ({
      codeOutlineVisible: false,
      setCodeOutlineVisible: (visible) => set({ codeOutlineVisible: visible })
    }))
  }
})

vi.mock('./CodeOutlinePanel', () => ({
  CodeOutlinePanel: ({ viewStateId, onClose }: { viewStateId: string; onClose: () => void }) => (
    <aside data-outline-panel={viewStateId}>
      <button type="button" onClick={onClose}>
        close
      </button>
    </aside>
  )
}))

// Why F9: the outline chord ships unbound, so the test binds one.
vi.mock('./editor-shortcuts', () => ({
  editorShortcutMatches: (actionId: string, event: KeyboardEvent) =>
    actionId === 'editor.toggleOutline' && event.key === 'F9'
}))

const { useAppStore } = await import('@/store')
const { CodeOutlineLayout } = await import('./CodeOutlineLayout')

function FakeEditor(): React.JSX.Element {
  useEffect(() => {
    mocks.editorMounts += 1
  }, [])
  return <div data-fake-editor />
}

describe('CodeOutlineLayout', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mocks.editorMounts = 0
    act(() => useAppStore.getState().setCodeOutlineVisible(false))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(applicable: boolean): void {
    act(() =>
      root.render(
        <CodeOutlineLayout viewStateId="tab-1" applicable={applicable}>
          <FakeEditor />
        </CodeOutlineLayout>
      )
    )
  }

  function pressF9(): void {
    const editor = container.querySelector('[data-fake-editor]')
    act(() => {
      editor?.dispatchEvent(new KeyboardEvent('keydown', { key: 'F9', bubbles: true }))
    })
  }

  it('keeps the plain editor wrapper where no outline applies', () => {
    act(() => useAppStore.getState().setCodeOutlineVisible(true))
    render(false)

    const wrapper = container.firstElementChild
    expect(wrapper?.className).toBe('min-h-0 flex-1 relative')
    expect(wrapper?.firstElementChild?.hasAttribute('data-fake-editor')).toBe(true)
    expect(container.querySelector('[data-outline-panel]')).toBeNull()

    pressF9()
    expect(useAppStore.getState().codeOutlineVisible).toBe(true)
  })

  it('shows and hides the outline beside the editor without remounting it', () => {
    render(true)
    expect(container.querySelector('[data-outline-panel]')).toBeNull()

    act(() => useAppStore.getState().setCodeOutlineVisible(true))
    expect(container.querySelector('[data-outline-panel="tab-1"]')).not.toBeNull()

    act(() => container.querySelector<HTMLButtonElement>('[data-outline-panel] button')?.click())
    expect(useAppStore.getState().codeOutlineVisible).toBe(false)
    expect(container.querySelector('[data-outline-panel]')).toBeNull()
    expect(mocks.editorMounts).toBe(1)
  })

  it('toggles the outline from its chord inside the editor', () => {
    render(true)

    pressF9()
    expect(useAppStore.getState().codeOutlineVisible).toBe(true)
    pressF9()
    expect(useAppStore.getState().codeOutlineVisible).toBe(false)
    expect(mocks.editorMounts).toBe(1)
  })
})
