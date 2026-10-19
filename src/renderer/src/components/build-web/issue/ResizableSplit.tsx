import { useCallback } from 'react'
import type React from 'react'
import { useSidebarResize } from '@/hooks/useSidebarResize'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { useWindowWidth } from '../../right-sidebar/use-window-width'
import { useBuildWebStore } from '../build-web-store'

const KEY_STEP = 32
// Why: the card sits beside Orca's own sidebar; the flexible side keeps at least this much.
const RESERVED_WIDTH = 640

/**
 * Two columns of a full-screen card tab with a draggable rule between them. `side` is the column
 * whose width is set (and remembered per `panel`); the other one takes the rest.
 */
export function ResizableSplit({
  panel,
  side,
  defaultWidth,
  minWidth,
  children,
  aside,
  ruled = false,
  className
}: {
  panel: string
  side: 'left' | 'right'
  defaultWidth: number
  minWidth: number
  /** The flexible column. */
  children: React.ReactNode
  /** The sized column. */
  aside: React.ReactNode
  /** The rule shows at rest, not only on hover — for columns with no gap of their own. */
  ruled?: boolean
  className?: string
}): React.JSX.Element {
  const stored = useBuildWebStore((s) => s.panelWidths[panel])
  const setPanelWidth = useBuildWebStore((s) => s.setPanelWidth)
  const windowWidth = useWindowWidth()
  const maxWidth = Math.max(minWidth, (windowWidth ?? 1280) - RESERVED_WIDTH)
  const width = Math.min(Math.max(stored ?? defaultWidth, minWidth), maxWidth)
  // Why stable: a new setter each render restarts the resize hook's listeners, ending a drag at once.
  const setWidth = useCallback((next: number) => setPanelWidth(panel, next), [panel, setPanelWidth])
  const { containerRef, isResizing, onResizeStart } = useSidebarResize<HTMLDivElement>({
    isOpen: true,
    width,
    minWidth,
    maxWidth,
    deltaSign: side === 'right' ? -1 : 1,
    setWidth
  })
  const onKeyDown = (event: React.KeyboardEvent) => {
    const toward = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (toward) {
      event.preventDefault()
      const delta = toward * KEY_STEP * (side === 'right' ? -1 : 1)
      setWidth(Math.min(Math.max(width + delta, minWidth), maxWidth))
    }
  }
  const sized = (
    <div ref={containerRef} style={{ width }} className="min-w-0 shrink-0">
      {aside}
    </div>
  )
  const rule = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={translate('buildWeb.card.resizePanel', 'Resize the panel')}
      aria-valuenow={width}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      tabIndex={0}
      onMouseDown={onResizeStart}
      onKeyDown={onKeyDown}
      className="group flex w-5 shrink-0 cursor-col-resize justify-center self-stretch focus-visible:outline-none"
    >
      <div
        className={cn(
          'w-px transition-colors',
          isResizing ? 'bg-ring' : 'group-hover:bg-ring/50 group-focus-visible:bg-ring',
          ruled && !isResizing && 'bg-border'
        )}
      />
    </div>
  )
  return (
    <div className={cn('flex min-w-0 items-stretch', className)}>
      {side === 'left' ? sized : null}
      {side === 'left' ? rule : null}
      <div className="min-w-0 flex-1">{children}</div>
      {side === 'right' ? rule : null}
      {side === 'right' ? sized : null}
    </div>
  )
}
