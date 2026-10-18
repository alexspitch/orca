import React, { useEffect, useRef, useState } from 'react'
import { CaseSensitive, Cherry, ChevronDown, Loader2, RefreshCw, Regex, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { Toggle } from '@/components/ui/toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { GitLogIconButton } from './GitLogIconButton'
import type { GitLogFilters } from './git-log-filters'

const TEXT_DEBOUNCE_MS = 250
const ALL = '__all__'

export type GitLogFilterSection = {
  id: string
  title?: string
  options: { value: string; label: string }[]
}

function FilterDropdown({
  name,
  value,
  valueLabel,
  sections,
  onPick
}: {
  name: string
  value: string | null
  valueLabel: string | null
  sections: GitLogFilterSection[]
  onPick: (value: string | null) => void
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-6 shrink-0 items-center gap-0.5 rounded-md pr-1 pl-1.5 text-xs whitespace-nowrap hover:bg-accent data-[state=open]:bg-accent',
            value ? 'font-medium text-foreground' : 'text-muted-foreground'
          )}
        >
          {valueLabel ? `${name}: ${valueLabel}` : name}
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 w-60">
        <DropdownMenuRadioGroup
          value={value ?? ALL}
          onValueChange={(next) => onPick(next === ALL ? null : next)}
        >
          <DropdownMenuRadioItem value={ALL}>
            {translate('gitLog.filter.all', 'All')}
          </DropdownMenuRadioItem>
          {sections.map((section) =>
            section.options.length === 0 ? null : (
              <React.Fragment key={section.id}>
                <DropdownMenuSeparator />
                {section.title ? <DropdownMenuLabel>{section.title}</DropdownMenuLabel> : null}
                {section.options.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </React.Fragment>
            )
          )}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** "Text or hash" with regex and match-case toggles, then Branch, User and Date, as WebStorm's log. */
export function GitLogFilterBar({
  filters,
  onChange,
  branchSections,
  branchLabel,
  userSections,
  loading,
  onRefresh,
  onCherryPick,
  canCherryPick
}: {
  filters: GitLogFilters
  onChange: (filters: GitLogFilters) => void
  branchSections: GitLogFilterSection[]
  /** The Branch filter's short name, shown on the dropdown. */
  branchLabel: string | null
  userSections: GitLogFilterSection[]
  loading: boolean
  onRefresh: () => void
  /** Cherry-picks the selected commit; the button is left out when the host can't. */
  onCherryPick?: () => void
  canCherryPick?: boolean
}): React.JSX.Element {
  const [text, setText] = useState(filters.text)
  const latest = useRef({ filters, onChange })
  latest.current = { filters, onChange }

  useEffect(() => {
    if (text === latest.current.filters.text) {
      return
    }
    const timer = window.setTimeout(
      () => latest.current.onChange({ ...latest.current.filters, text }),
      TEXT_DEBOUNCE_MS
    )
    return () => window.clearTimeout(timer)
  }, [text])

  const dateSections: GitLogFilterSection[] = [
    {
      id: 'dates',
      options: [
        {
          value: '1',
          label: translate('gitLog.filter.last24h', 'Last 24 hours')
        },
        { value: '7', label: translate('gitLog.filter.last7d', 'Last 7 days') },
        {
          value: '30',
          label: translate('gitLog.filter.last30d', 'Last 30 days')
        }
      ]
    }
  ]
  const dateLabel =
    dateSections[0]!.options.find((option) => option.value === String(filters.sinceDays))?.label ??
    null
  const userLabel = userSections
    .flatMap((section) => section.options)
    .find((option) => option.value === filters.author)?.label

  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 border-b px-1.5">
      <label className="mr-1.5 flex h-7 w-60 shrink-0 items-center gap-1.5 rounded-md border border-input pr-0.5 pl-2 text-muted-foreground focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        <Search className="size-3.5 shrink-0" />
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={translate('gitLog.filter.text', 'Text or hash')}
          aria-label={translate('gitLog.filter.text', 'Text or hash')}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <Toggle
          size="xs"
          aria-label={translate('gitLog.filter.regex', 'Regex')}
          pressed={filters.regex}
          onPressedChange={(regex) => onChange({ ...filters, regex })}
        >
          <Regex className="size-3.5" />
        </Toggle>
        <Toggle
          size="xs"
          aria-label={translate('gitLog.filter.matchCase', 'Match Case')}
          pressed={filters.matchCase}
          onPressedChange={(matchCase) => onChange({ ...filters, matchCase })}
        >
          <CaseSensitive className="size-3.5" />
        </Toggle>
      </label>
      <FilterDropdown
        name={translate('gitLog.filter.branch', 'Branch')}
        value={filters.branch}
        valueLabel={branchLabel}
        sections={branchSections}
        onPick={(branch) => onChange({ ...filters, branch })}
      />
      <FilterDropdown
        name={translate('gitLog.filter.user', 'User')}
        value={filters.author}
        valueLabel={filters.author ? (userLabel ?? filters.author) : null}
        sections={userSections}
        onPick={(author) => onChange({ ...filters, author })}
      />
      <FilterDropdown
        name={translate('gitLog.filter.date', 'Date')}
        value={filters.sinceDays ? String(filters.sinceDays) : null}
        valueLabel={dateLabel}
        sections={dateSections}
        onPick={(days) => onChange({ ...filters, sinceDays: days ? Number(days) : null })}
      />
      <div className="flex-1" />
      {loading ? <Loader2 className="mr-1 size-3.5 animate-spin text-muted-foreground" /> : null}
      {onCherryPick ? (
        <GitLogIconButton
          label={translate('gitLog.commitMenu.cherryPick', 'Cherry-Pick')}
          icon={Cherry}
          disabled={!canCherryPick}
          onClick={onCherryPick}
        />
      ) : null}
      <GitLogIconButton
        label={translate('gitLog.filter.refresh', 'Refresh')}
        icon={RefreshCw}
        onClick={onRefresh}
      />
    </div>
  )
}
