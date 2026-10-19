import React, { useMemo, useState } from 'react'
import { ChevronsDownUp, ChevronsUpDown, ListTree, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { CodeOutlineSymbol } from '@/lib/code-navigation/code-navigation-types'
import { CodeOutlineRow } from './CodeOutlineRow'
import { VirtualMarkdownTableOfContents } from './VirtualMarkdownTableOfContents'
import {
  collectMarkdownTocParentIds,
  toggleMarkdownTocCollapsedId
} from './markdown-toc-collapse-state'
import { MARKDOWN_TOC_LEFT_EDGE_RESIZE_HANDLE_CLASS_NAME } from './markdown-toc-panel-width'
import { useTocPanelResize } from './use-toc-panel-resize'
import { useCodeOutline, type CodeOutline } from './use-code-outline'
import {
  filterCodeOutline,
  findFirstCodeOutlineMatch,
  findVisibleCodeOutlineId
} from './code-outline-tree'
import { editorLocationOf, recordEditorJumpFrom } from './editor-location-navigation'

const NO_COLLAPSED_IDS: ReadonlySet<string> = new Set()

function revealOutlineSymbol(outline: CodeOutline, symbol: CodeOutlineSymbol): void {
  const mounted = outline.mounted
  if (!mounted) {
    return
  }
  const { startLineNumber: line, startColumn: column } = symbol.selectionRange
  const from = editorLocationOf(mounted)
  if (from) {
    recordEditorJumpFrom(mounted, { ...from, line, column })
  }
  mounted.editor.setPosition({ lineNumber: line, column })
  mounted.editor.revealRangeInCenterIfOutsideViewport(symbol.selectionRange)
  mounted.editor.focus()
}

function OutlineMessage({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="markdown-toc-list">
      <div className="markdown-toc-empty">{children}</div>
    </div>
  )
}

export function CodeOutlinePanel({
  viewStateId,
  onClose
}: {
  viewStateId: string
  onClose: () => void
}): React.JSX.Element {
  const outline = useCodeOutline(viewStateId)
  const [query, setQuery] = useState('')
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set())
  const codeOutlinePanelWidth = useAppStore((s) => s.codeOutlinePanelWidth)
  const setCodeOutlinePanelWidth = useAppStore((s) => s.setCodeOutlinePanelWidth)
  const { containerRef, onResizeStart } = useTocPanelResize({
    width: codeOutlinePanelWidth,
    setWidth: setCodeOutlinePanelWidth,
    deltaSign: -1
  })

  const filtering = query.trim().length > 0
  const visibleSymbols = useMemo(
    () => filterCodeOutline(outline.symbols, query),
    [outline.symbols, query]
  )
  // Why: a filter shows every match, so collapse state only applies to the unfiltered tree.
  const effectiveCollapsedIds = filtering ? NO_COLLAPSED_IDS : collapsedIds
  const currentId = findVisibleCodeOutlineId(
    visibleSymbols,
    outline.cursorPath,
    effectiveCollapsedIds
  )
  const parentIds = useMemo(() => collectMarkdownTocParentIds(outline.symbols), [outline.symbols])
  const anyCollapsed = [...collapsedIds].some((id) => parentIds.has(id))

  const onFilterKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (query) {
        setQuery('')
      } else {
        outline.mounted?.editor.focus()
      }
      return
    }
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      const match = findFirstCodeOutlineMatch(outline.symbols, query)
      if (match) {
        event.preventDefault()
        revealOutlineSymbol(outline, match)
      }
    }
  }

  const collapseLabel = anyCollapsed
    ? translate('auto.components.editor.CodeOutlinePanel.9357afa93d', 'Expand all')
    : translate('auto.components.editor.CodeOutlinePanel.0a782f197b', 'Collapse all')
  const closeLabel = translate(
    'auto.components.editor.CodeOutlinePanel.cf96bbe118',
    'Close outline'
  )

  let body: React.ReactNode
  if (outline.status === 'too-large') {
    body = (
      <OutlineMessage>
        {translate(
          'auto.components.editor.CodeOutlinePanel.1aa9644204',
          'This file is too large for an outline'
        )}
      </OutlineMessage>
    )
  } else if (outline.status === 'error') {
    body = (
      <OutlineMessage>
        {translate(
          'auto.components.editor.CodeOutlinePanel.b3986da273',
          'The outline could not be built'
        )}
      </OutlineMessage>
    )
  } else if (outline.status === 'loading') {
    body = (
      <OutlineMessage>
        {/* Why delayed: most outlines land within a frame, and a flashed label reads as a glitch. */}
        <span className="animate-in fade-in delay-200 [--tw-animation-fill-mode:backwards]">
          {translate('auto.components.editor.CodeOutlinePanel.164f3cd39b', 'Loading outline…')}
        </span>
      </OutlineMessage>
    )
  } else if (visibleSymbols.length === 0) {
    body = (
      <OutlineMessage>
        {filtering
          ? translate('auto.components.editor.CodeOutlinePanel.a4ceadbc59', 'No matching symbols')
          : translate('auto.components.editor.CodeOutlinePanel.8bcf1ae0c8', 'No symbols')}
      </OutlineMessage>
    )
  } else {
    body = (
      <VirtualMarkdownTableOfContents
        items={visibleSymbols}
        collapsedIds={effectiveCollapsedIds}
        revealId={currentId}
        renderRow={(symbol, depth) => (
          <CodeOutlineRow
            symbol={symbol}
            depth={depth}
            collapsedIds={effectiveCollapsedIds}
            current={symbol.id === currentId}
            onNavigate={(target) => revealOutlineSymbol(outline, target)}
            onToggleCollapsed={(id) =>
              setCollapsedIds((current) => toggleMarkdownTocCollapsedId(current, id))
            }
          />
        )}
      />
    )
  }

  return (
    <aside
      ref={containerRef}
      className="markdown-toc-panel"
      data-side="right"
      aria-label={translate('auto.components.editor.CodeOutlinePanel.346ba6048c', 'Outline')}
    >
      <div className="markdown-toc-header">
        <ListTree className="size-3.5 text-muted-foreground" />
        <span>{translate('auto.components.editor.CodeOutlinePanel.346ba6048c', 'Outline')}</span>
        <div className="markdown-toc-header-actions">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={collapseLabel}
            title={collapseLabel}
            disabled={filtering || parentIds.size === 0}
            onClick={() => setCollapsedIds(anyCollapsed ? new Set() : parentIds)}
          >
            {anyCollapsed ? (
              <ChevronsUpDown className="size-3.5" />
            ) : (
              <ChevronsDownUp className="size-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={closeLabel}
            title={closeLabel}
            onClick={onClose}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="markdown-toc-filter">
        <Input
          value={query}
          placeholder={translate(
            'auto.components.editor.CodeOutlinePanel.77869c3218',
            'Filter symbols'
          )}
          aria-label={translate(
            'auto.components.editor.CodeOutlinePanel.14533cdc0e',
            'Filter outline symbols'
          )}
          className="h-7"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onFilterKeyDown}
        />
      </div>
      {body}
      <div
        data-code-outline-resize-handle=""
        className={MARKDOWN_TOC_LEFT_EDGE_RESIZE_HANDLE_CLASS_NAME}
        role="separator"
        aria-orientation="vertical"
        aria-label={translate(
          'auto.components.editor.CodeOutlinePanel.01ae296e56',
          'Resize outline'
        )}
        onMouseDown={onResizeStart}
      />
    </aside>
  )
}
