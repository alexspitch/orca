import { useRef } from 'react'
import { Archive, Bot, FoldVertical, Star, Ticket, UnfoldVertical, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'
import { useBuildWebStore } from './build-web-store'
import { BuildWebStatusFilter, BuildWebToWorkToggle } from './BuildWebStatusFilter'
import { BuildWebAssigneeFilter, BuildWebProductFilter } from './BuildWebListFilterMenus'
import { quickFilterLabel } from './build-web-labels'
import { QUICK_FILTERS, type QuickFilter } from './build-web-view-prefs'
import { familiesOf, foldedOf, useIssueFolds } from './build-web-families'

const QUICK_ICON: Record<QuickFilter, React.ReactNode> = {
  ai: <Bot />,
  favorite: <Star />,
  jira: <Ticket />,
  archived: <Archive />
}

/** Fold or unfold every family on the page at once, as build-web's toolbar does. */
function FoldAllButton(): React.JSX.Element {
  const issues = useBuildWebStore((s) => s.issues)
  const foldAll = useIssueFolds((s) => s.foldAll)
  const toggled = useIssueFolds((s) => s.toggled)
  const setFoldAll = useIssueFolds((s) => s.setFoldAll)
  const kids = familiesOf(issues)
  const folded = foldedOf(foldAll, toggled, kids)
  const allFolded = kids.size > 0 && [...kids.keys()].every((id) => folded.has(id))
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={kids.size === 0}
      onClick={() => setFoldAll(!allFolded)}
    >
      {allFolded ? <UnfoldVertical /> : <FoldVertical />}
      {allFolded
        ? translate('buildWeb.filters.unfoldAll', 'Show subtasks')
        : translate('buildWeb.filters.foldAll', 'Hide subtasks')}
    </Button>
  )
}

/** The key-or-title search, with a button that empties it. */
function SearchField(): React.JSX.Element {
  const query = useBuildWebStore((s) => s.query)
  const setQuery = useBuildWebStore((s) => s.setQuery)
  const inputRef = useRef<HTMLInputElement>(null)
  const label = translate('buildWeb.filters.search', 'Search by key or title')
  return (
    <div className="relative min-w-48 flex-1">
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={label}
        aria-label={label}
        className={query ? 'h-8 pr-8' : 'h-8'}
        data-escape-clears-value="true"
      />
      {query ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          aria-label={translate('buildWeb.filters.clearSearch', 'Clear search')}
          // Why: the click must not blur the field it hands focus back to.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setQuery('')
            inputRef.current?.focus()
          }}
        >
          <X />
        </Button>
      ) : null}
    </div>
  )
}

export function BuildWebFilters(): React.JSX.Element {
  const quick = useBuildWebStore((s) => s.quick)
  const toggleQuick = useBuildWebStore((s) => s.toggleQuick)

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 md:px-5">
      {/* Combined with AND like build-web's; Mine is in the assignee list. */}
      <ToggleGroup
        type="multiple"
        variant="outline"
        size="sm"
        value={QUICK_FILTERS.filter((q) => quick.has(q))}
        onValueChange={(next) => {
          const changed = QUICK_FILTERS.find((q) => next.includes(q) !== quick.has(q))
          if (changed) {
            toggleQuick(changed)
          }
        }}
        aria-label={translate('buildWeb.filters.quick', 'Quick filters')}
      >
        {QUICK_FILTERS.map((q) => (
          <ToggleGroupItem key={q} value={q}>
            {QUICK_ICON[q]}
            {quickFilterLabel(q)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <BuildWebToWorkToggle />
      <BuildWebStatusFilter />
      <BuildWebProductFilter />
      <BuildWebAssigneeFilter />
      <SearchField />
      <FoldAllButton />
    </div>
  )
}
