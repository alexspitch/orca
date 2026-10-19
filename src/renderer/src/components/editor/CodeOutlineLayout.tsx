import React, { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { CodeOutlinePanel } from './CodeOutlinePanel'
import { editorShortcutMatches } from './editor-shortcuts'

/** Puts the code outline beside an editor surface that has one (TS/JS/Python in Monaco). */
export function CodeOutlineLayout({
  viewStateId,
  applicable,
  children
}: {
  viewStateId: string
  applicable: boolean
  children: React.ReactNode
}): React.JSX.Element {
  const visible = useAppStore((s) => s.codeOutlineVisible)
  const setVisible = useAppStore((s) => s.setCodeOutlineVisible)
  const layoutRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layout = layoutRef.current
    if (!applicable || !layout) {
      return
    }
    // Why capture: Monaco consumes keys it knows, and the outline chord is user-assigned.
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!editorShortcutMatches('editor.toggleOutline', event)) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      if (!event.repeat) {
        setVisible(!useAppStore.getState().codeOutlineVisible)
      }
    }
    layout.addEventListener('keydown', onKeyDown, true)
    return () => layout.removeEventListener('keydown', onKeyDown, true)
  }, [applicable, setVisible])

  if (!applicable) {
    return (
      <div ref={layoutRef} className="min-h-0 flex-1 relative">
        {children}
      </div>
    )
  }
  // Why the wrapper stays while the outline is hidden: changing the editor's parent would remount Monaco on every toggle.
  return (
    <div ref={layoutRef} className="@container flex min-h-0 flex-1 relative">
      <div className="relative min-w-0 flex-1">{children}</div>
      {visible ? (
        <CodeOutlinePanel viewStateId={viewStateId} onClose={() => setVisible(false)} />
      ) : null}
    </div>
  )
}
