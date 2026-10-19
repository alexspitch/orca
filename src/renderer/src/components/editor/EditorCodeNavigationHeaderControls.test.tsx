// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  state: {
    codeOutlineVisible: false,
    canGoBack: true,
    canGoForward: false
  },
  setCodeOutlineVisible: vi.fn(),
  navigateEditorHistory: vi.fn(async () => {})
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      codeOutlineVisible: mocks.state.codeOutlineVisible,
      setCodeOutlineVisible: mocks.setCodeOutlineVisible
    })
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <span data-tooltip-content>{children}</span>
  )
}))

vi.mock('./editor-navigation-history-store', () => ({
  useEditorNavigationAvailability: () => ({
    canGoBack: mocks.state.canGoBack,
    canGoForward: mocks.state.canGoForward
  })
}))

vi.mock('./editor-location-navigation', () => ({
  navigateEditorHistory: mocks.navigateEditorHistory
}))

const { EditorCodeNavigationHeaderControls } = await import('./EditorCodeNavigationHeaderControls')

describe('EditorCodeNavigationHeaderControls', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mocks.state.codeOutlineVisible = false
    mocks.setCodeOutlineVisible.mockReset()
    mocks.navigateEditorHistory.mockClear()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(canShowOutline: boolean): void {
    act(() =>
      root.render(
        <EditorCodeNavigationHeaderControls
          viewStateId="tab-1"
          worktreeId="wt-1"
          canShowOutline={canShowOutline}
        />
      )
    )
  }

  function button(label: string): HTMLButtonElement | null {
    return container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  }

  it('enables Back/Forward from the worktree history and steps through it', () => {
    render(false)

    expect(button('Previous location')?.disabled).toBe(false)
    expect(button('Next location')?.disabled).toBe(true)
    act(() => button('Previous location')?.click())
    expect(mocks.navigateEditorHistory).toHaveBeenCalledWith('back', null)
  })

  it('offers the outline toggle only where the file has an outline', () => {
    render(false)
    expect(button('Outline')).toBeNull()

    render(true)
    expect(button('Outline')?.getAttribute('aria-pressed')).toBe('false')
    act(() => button('Outline')?.click())
    expect(mocks.setCodeOutlineVisible).toHaveBeenCalledWith(true)
  })

  it('shows the toggle pressed while the outline is visible', () => {
    mocks.state.codeOutlineVisible = true
    render(true)

    expect(button('Outline')?.getAttribute('aria-pressed')).toBe('true')
    act(() => button('Outline')?.click())
    expect(mocks.setCodeOutlineVisible).toHaveBeenCalledWith(false)
  })
})
