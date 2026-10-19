import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { CodeOutlineSymbol } from '@/lib/code-navigation/code-navigation-types'
import { isMarkdownTocItemExpanded } from './markdown-toc-collapse-state'
import { renderCodeSymbolKindIcon } from './code-outline-symbol-icons'

const OUTLINE_INDENT_BASE_PX = 4
const OUTLINE_INDENT_STEP_PX = 12

export function CodeOutlineRow({
  symbol,
  depth,
  collapsedIds,
  current,
  onNavigate,
  onToggleCollapsed
}: {
  symbol: CodeOutlineSymbol
  depth: number
  collapsedIds: ReadonlySet<string>
  current: boolean
  onNavigate: (symbol: CodeOutlineSymbol) => void
  onToggleCollapsed: (id: string) => void
}): React.JSX.Element {
  const hasChildren = symbol.children.length > 0
  const expanded = isMarkdownTocItemExpanded(collapsedIds, symbol)

  return (
    <div
      className="markdown-toc-row"
      data-current={current ? 'true' : undefined}
      style={{ paddingLeft: OUTLINE_INDENT_BASE_PX + depth * OUTLINE_INDENT_STEP_PX }}
    >
      {hasChildren ? (
        <button
          type="button"
          className="markdown-toc-disclosure"
          aria-label={
            expanded
              ? translate(
                  'auto.components.editor.CodeOutlineRow.52f4bf821e',
                  'Collapse {{value0}}',
                  {
                    value0: symbol.name
                  }
                )
              : translate('auto.components.editor.CodeOutlineRow.91755cb4bd', 'Expand {{value0}}', {
                  value0: symbol.name
                })
          }
          aria-expanded={expanded}
          onClick={() => onToggleCollapsed(symbol.id)}
        >
          <ChevronRight
            className={cn(
              'size-3 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
              expanded && 'rotate-90'
            )}
          />
        </button>
      ) : (
        // Why: a leaf keeps the chevron's slot so sibling icons line up in one column.
        <span className="size-3 shrink-0" aria-hidden="true" />
      )}
      <button
        type="button"
        className="markdown-toc-title-button gap-1.5"
        aria-current={current ? 'location' : undefined}
        onClick={() => onNavigate(symbol)}
      >
        {renderCodeSymbolKindIcon(symbol.kind, 'size-3.5 shrink-0 text-muted-foreground')}
        <span className="markdown-toc-title">{symbol.name}</span>
      </button>
    </div>
  )
}
