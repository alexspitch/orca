import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader2, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import type { GitHistoryItem } from '../../../../shared/git-history'
import type { GitHistoryItemViewModel } from '../../../../shared/git-history-graph'
import {
  GitHistoryGraphSvg,
  graphColor
} from '../right-sidebar/source-control/sync/git-history-graph-svg'
import { formatGitLogRowDate, gitLogRefLabels } from './git-log-format'

const ROW_HEIGHT = 24
const MAX_REF_LABELS = 3
const LOAD_MORE_THRESHOLD = 40

type GitLogTableProps = {
  /** The commits as loaded; actions and arrow keys follow their real parents. */
  items: readonly GitHistoryItem[]
  /** One per item, only for drawing the graph (parentless while a filter is on). */
  viewModels: readonly GitHistoryItemViewModel[]
  /** Commits reachable from HEAD, lightly tinted as WebStorm does. */
  headCommits: ReadonlySet<string>
  selectedId: string | null
  onSelect: (item: GitHistoryItem) => void
  onOpen: (item: GitHistoryItem) => void
  hasMore: boolean
  /** The first page (or a refresh) is loading. */
  loading: boolean
  /** The next page is loading at the end of the list. */
  loadingMore: boolean
  onLoadMore: () => void
  renderContextMenu: (item: GitHistoryItem) => React.ReactNode
  emptyLabel: string | null
}

function GitLogRefPills({ item }: { item: GitHistoryItem }): React.JSX.Element | null {
  const labels = gitLogRefLabels(item.references)
  if (labels.length === 0) {
    return null
  }
  const shown = labels.slice(0, MAX_REF_LABELS)
  const hidden = labels.length - shown.length
  return (
    <span className="flex shrink-0 items-center gap-1 pl-2">
      {shown.map((ref) => (
        <span
          key={ref.key}
          title={ref.title}
          className="flex max-w-[10rem] items-center gap-1 truncate rounded-full border bg-sidebar px-1.5 py-0.5 text-3xs leading-none text-muted-foreground"
          style={
            ref.color
              ? {
                  borderColor: graphColor(ref.color),
                  color: graphColor(ref.color)
                }
              : undefined
          }
        >
          <Tag className="size-2.5 shrink-0" />
          <span className="truncate">{ref.label}</span>
        </span>
      ))}
      {hidden > 0 ? <span className="text-3xs text-muted-foreground">+{hidden}</span> : null}
    </span>
  )
}

/** The log: author | graph + subject + ref labels | date, one 24 px row per commit. */
export function GitLogTable({
  items,
  viewModels,
  headCommits,
  selectedId,
  onSelect,
  onOpen,
  hasMore,
  loading,
  loadingMore,
  onLoadMore,
  renderContextMenu,
  emptyLabel
}: GitLogTableProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12
  })
  const virtualRows = virtualizer.getVirtualItems()
  const lastIndex = virtualRows.at(-1)?.index ?? 0

  useEffect(() => {
    if (hasMore && lastIndex >= items.length - LOAD_MORE_THRESHOLD) {
      onLoadMore()
    }
  }, [hasMore, items.length, lastIndex, onLoadMore])

  const indexById = useMemo(() => {
    const map = new Map<string, number>()
    items.forEach((item, index) => map.set(item.id, index))
    return map
  }, [items])

  // Why an effect: a selection made from the menu or the keyboard must scroll into view too.
  const selectedIndex = selectedId === null ? -1 : (indexById.get(selectedId) ?? -1)
  useEffect(() => {
    if (selectedIndex >= 0) {
      virtualizer.scrollToIndex(selectedIndex, { align: 'auto' })
    }
  }, [selectedIndex, virtualizer])

  const selectIndex = useCallback(
    (index: number) => {
      const item = items[index]
      if (item) {
        onSelect(item)
      }
    },
    [items, onSelect]
  )

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = selectedIndex
    const item = items[current]
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      selectIndex(
        Math.max(0, Math.min(items.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)))
      )
    } else if (event.key === 'Enter' && item) {
      event.preventDefault()
      onOpen(item)
    } else if (event.key === 'ArrowRight' && item?.parentIds[0]) {
      // WebStorm: → goes to the parent commit, ← to the child.
      event.preventDefault()
      selectIndex(indexById.get(item.parentIds[0]) ?? current)
    } else if (event.key === 'ArrowLeft' && item) {
      event.preventDefault()
      const child = items.findIndex((candidate) => candidate.parentIds.includes(item.id))
      selectIndex(child === -1 ? current : child)
    }
  }

  return (
    <div
      ref={scrollRef}
      role="grid"
      aria-label={translate('gitLog.table.label', 'Commits')}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="scrollbar-sleek min-h-0 flex-1 overflow-auto focus-visible:outline-none"
    >
      {loading && items.length === 0 ? (
        <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {translate('gitLog.table.loading', 'Loading commits…')}
        </div>
      ) : emptyLabel ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">{emptyLabel}</div>
      ) : (
        <div
          className={cn(
            'relative w-full transition-opacity',
            // Why dimmed: a filter or refresh is replacing these rows.
            loading && !loadingMore && 'opacity-50'
          )}
          aria-busy={loading}
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualRows.map((virtualRow) => {
            const vm = viewModels[virtualRow.index]!
            const item = items[virtualRow.index]!
            const selected = item.id === selectedId
            return (
              <ContextMenu key={item.id}>
                <ContextMenuTrigger asChild>
                  <div
                    role="row"
                    aria-selected={selected}
                    data-current={selected ? 'true' : undefined}
                    onMouseDown={() => onSelect(item)}
                    onDoubleClick={() => onOpen(item)}
                    className={cn(
                      'absolute left-0 grid w-full cursor-default grid-cols-[8rem_minmax(0,1fr)_9rem] items-center text-[13px] whitespace-nowrap',
                      selected
                        ? 'bg-[color-mix(in_srgb,var(--foreground)_12%,var(--background))]'
                        : headCommits.has(item.id)
                          ? 'bg-[color-mix(in_srgb,var(--git-graph-ref)_5%,var(--background))] hover:bg-accent'
                          : 'hover:bg-accent'
                    )}
                    style={{ top: virtualRow.start, height: ROW_HEIGHT }}
                  >
                    <span role="gridcell" className="truncate pr-2 pl-3">
                      {item.author}
                    </span>
                    <span role="gridcell" className="flex h-6 min-w-0 items-center">
                      <GitHistoryGraphSvg viewModel={vm} />
                      <span className="min-w-0 flex-1 truncate pl-1.5">{item.subject}</span>
                      <GitLogRefPills item={item} />
                    </span>
                    <span role="gridcell" className="truncate pr-3 pl-3 tabular-nums">
                      {formatGitLogRowDate(item.timestamp)}
                    </span>
                  </div>
                </ContextMenuTrigger>
                {renderContextMenu(item)}
              </ContextMenu>
            )
          })}
        </div>
      )}
      {loadingMore && items.length > 0 ? (
        <div className="flex h-8 items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {translate('gitLog.table.loadingMore', 'Loading more commits…')}
        </div>
      ) : null}
    </div>
  )
}
