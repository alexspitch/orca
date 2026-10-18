import type React from 'react'
import { useSidebarResize } from '@/hooks/useSidebarResize'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'

const KEY_STEP = 32

/**
 * A column with a fixed, draggable width next to a flexible one, split by a 1 px rule as in
 * WebStorm's tool windows. Width changes go to `onWidthChange` when a drag or key step ends.
 */
export function GitLogPaneSplit({
  side,
  width,
  minWidth,
  maxWidth,
  onWidthChange,
  aside,
  children
}: {
  side: 'left' | 'right'
  width: number
  minWidth: number
  maxWidth: number
  onWidthChange: (width: number) => void
  aside: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  const clamped = Math.min(Math.max(width, minWidth), Math.max(minWidth, maxWidth))
  const { containerRef, isResizing, onResizeStart } = useSidebarResize<HTMLDivElement>({
    isOpen: true,
    width: clamped,
    minWidth,
    maxWidth: Math.max(minWidth, maxWidth),
    deltaSign: side === 'right' ? -1 : 1,
    setWidth: onWidthChange
  })
  const onKeyDown = (event: React.KeyboardEvent) => {
    const toward = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (toward) {
      event.preventDefault()
      const next = clamped + toward * KEY_STEP * (side === 'right' ? -1 : 1)
      onWidthChange(Math.min(Math.max(next, minWidth), Math.max(minWidth, maxWidth)))
    }
  }
  const sized = (
    <div
      ref={containerRef}
      style={{ width: clamped }}
      className="flex min-h-0 min-w-0 shrink-0 flex-col"
    >
      {aside}
    </div>
  )
  const rule = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={translate('gitLog.layout.resize', 'Resize panel')}
      aria-valuenow={clamped}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      tabIndex={0}
      onMouseDown={onResizeStart}
      onKeyDown={onKeyDown}
      className="group relative w-px shrink-0 cursor-col-resize bg-border focus-visible:outline-none"
    >
      {/* Why: a 1 px rule is too thin to grab; the hit area spills 3 px each side. */}
      <div
        className={cn(
          'absolute inset-y-0 -left-[3px] -right-[3px] z-10',
          isResizing ? 'bg-ring/40' : 'group-hover:bg-ring/30 group-focus-visible:bg-ring/50'
        )}
      />
    </div>
  )
  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-stretch">
      {side === 'left' ? sized : null}
      {side === 'left' ? rule : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      {side === 'right' ? rule : null}
      {side === 'right' ? sized : null}
    </div>
  )
}
