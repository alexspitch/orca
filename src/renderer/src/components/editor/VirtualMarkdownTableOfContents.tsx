import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { motionSafeScrollBehavior } from '@/hooks/usePrefersReducedMotion'
import { isMarkdownTocItemExpanded } from './markdown-toc-collapse-state'

type VirtualTreeItem<T> = { id: string; children: readonly T[] }

export function VirtualMarkdownTableOfContents<T extends VirtualTreeItem<T>>({
  items,
  collapsedIds,
  renderRow,
  revealId = null
}: {
  items: readonly T[]
  collapsedIds: ReadonlySet<string>
  renderRow: (item: T, depth: number) => ReactNode
  /** Scrolled into view whenever it changes (the outline's current symbol). */
  revealId?: string | null
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => {
    const result: { item: T; depth: number }[] = []
    const visit = (entries: readonly T[], depth: number): void => {
      for (const item of entries) {
        result.push({ item, depth })
        if (isMarkdownTocItemExpanded(collapsedIds, item)) {
          visit(item.children, depth + 1)
        }
      }
    }
    visit(items, 0)
    return result
  }, [items, collapsedIds])
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 28,
    overscan: 5,
    getItemKey: (index) => rows[index].item.id
  })
  // Why: reveal once per id, so collapsing or scrolling the list never yanks it back to the cursor.
  const revealedIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (revealId === revealedIdRef.current) {
      return
    }
    const index = revealId === null ? -1 : rows.findIndex((row) => row.item.id === revealId)
    if (revealId !== null && index < 0) {
      return
    }
    revealedIdRef.current = revealId
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: 'auto', behavior: motionSafeScrollBehavior() })
    }
  }, [revealId, rows, virtualizer])
  return (
    <div ref={scrollRef} className="markdown-toc-list scrollbar-editor">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${row.start}px)` }}
          >
            {renderRow(rows[row.index].item, rows[row.index].depth)}
          </div>
        ))}
      </div>
    </div>
  )
}
