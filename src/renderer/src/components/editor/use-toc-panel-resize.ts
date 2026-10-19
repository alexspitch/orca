import { useEffect, useState } from 'react'
import { useSidebarResize } from '@/hooks/useSidebarResize'
import {
  MARKDOWN_TOC_PANEL_MIN_WIDTH,
  clampMarkdownTocPanelWidth,
  computeMaxMarkdownTocPanelWidth
} from './markdown-toc-panel-width'

/**
 * Drag-resizes a TOC-style side panel within its parent layout, leaving the
 * editor beside it its minimum width. `deltaSign` is -1 for a panel on the right.
 */
export function useTocPanelResize({
  width,
  setWidth,
  deltaSign
}: {
  width: number
  setWidth: (width: number) => void
  deltaSign: 1 | -1
}): ReturnType<typeof useSidebarResize<HTMLElement>> {
  const [layoutWidth, setLayoutWidth] = useState<number | null>(null)
  const resize = useSidebarResize<HTMLElement>({
    isOpen: true,
    width: clampMarkdownTocPanelWidth(width, layoutWidth ?? undefined),
    minWidth: MARKDOWN_TOC_PANEL_MIN_WIDTH,
    maxWidth: computeMaxMarkdownTocPanelWidth(layoutWidth ?? 0),
    deltaSign,
    setWidth
  })
  const { containerRef } = resize

  useEffect(() => {
    const layout = containerRef.current?.parentElement
    if (!layout) {
      return
    }
    const updateLayoutWidth = (): void => {
      setLayoutWidth(layout.clientWidth)
    }
    updateLayoutWidth()
    const observer = new ResizeObserver(updateLayoutWidth)
    observer.observe(layout)
    return () => observer.disconnect()
  }, [containerRef])

  return resize
}
