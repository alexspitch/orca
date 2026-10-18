import type React from 'react'
import { useSidebarResize } from '@/hooks/useSidebarResize'
import { useWindowWidth } from '../right-sidebar/use-window-width'
import { useBuildWebStore } from './build-web-store'
import { DRAWER_MIN_WIDTH } from './build-web-view-prefs'

const KEY_STEP = 32
// Why a margin: the list behind the card must stay reachable to click another task.
const WINDOW_MARGIN = 160

/** The side card's width: dragged at its left edge or moved with the arrow keys, and remembered. */
export function useBuildWebDrawerWidth(): {
  containerRef: React.RefObject<HTMLDivElement | null>
  width: number
  minWidth: number
  maxWidth: number
  onResizeStart: (event: React.MouseEvent) => void
  onKeyDown: (event: React.KeyboardEvent) => void
} {
  const stored = useBuildWebStore((s) => s.drawerWidth)
  const setDrawerWidth = useBuildWebStore((s) => s.setDrawerWidth)
  const windowWidth = useWindowWidth()
  const maxWidth = Math.max(DRAWER_MIN_WIDTH, (windowWidth ?? 1280) - WINDOW_MARGIN)
  const width = Math.min(Math.max(stored, DRAWER_MIN_WIDTH), maxWidth)
  const { containerRef, onResizeStart } = useSidebarResize<HTMLDivElement>({
    isOpen: true,
    width,
    minWidth: DRAWER_MIN_WIDTH,
    maxWidth,
    deltaSign: -1,
    setWidth: setDrawerWidth
  })
  const onKeyDown = (event: React.KeyboardEvent) => {
    // The card opens from the right, so ← widens it and → narrows it.
    const delta = event.key === 'ArrowLeft' ? KEY_STEP : event.key === 'ArrowRight' ? -KEY_STEP : 0
    if (delta) {
      event.preventDefault()
      setDrawerWidth(Math.min(Math.max(width + delta, DRAWER_MIN_WIDTH), maxWidth))
    }
  }
  return { containerRef, width, minWidth: DRAWER_MIN_WIDTH, maxWidth, onResizeStart, onKeyDown }
}
