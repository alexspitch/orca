import { useEffect, useRef } from 'react'

const OWNS_ESCAPE =
  'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]'

/** Escape on an Issues or Images page steps back one level; fields, dialogs and menus keep theirs. */
export function useBuildWebPageEscape(onEscape: () => void): void {
  const latest = useRef(onEscape)
  latest.current = onEscape
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target
      if (event.key !== 'Escape' || event.defaultPrevented || !(target instanceof HTMLElement)) {
        return
      }
      if (target.closest(OWNS_ESCAPE)) {
        return
      }
      event.preventDefault()
      latest.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
