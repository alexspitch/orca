import { CalendarDays, List, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'
import type { BuildWebRecapPage } from '../../../../../shared/build-web-recap-types'
import { ProductChip } from '../BuildWebToneChip'
import { RECAP_VIEWS, type RecapView } from '../build-web-view-prefs'
import { RecapAutomationPicker } from './RecapAutomationPicker'
import {
  NO_RECAP_FILTERS,
  hasRecapFilters,
  recapAutomationOptions,
  recapVersionOptions,
  withRecapProduct,
  withRecapVersion,
  type RecapFilters
} from './recap-filters'

/** A date bound as a pill, like the Linear project dates; empty means no bound. */
function DateBound({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string
  value: string
  min?: string
  max?: string
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 text-xs text-foreground transition-colors hover:bg-muted/50">
      <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className="h-5 min-w-[6.75rem] cursor-pointer border-none bg-transparent p-0 text-xs text-foreground outline-none"
        aria-label={label}
      />
      {value ? (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={translate('buildWeb.recaps.clearDate', 'Clear {{label}}', { label })}
          onClick={(event) => {
            event.preventDefault()
            onChange('')
          }}
        >
          <X />
        </Button>
      ) : null}
    </label>
  )
}

export function RecapsFilterBar({
  view,
  onView,
  filters,
  facets,
  total,
  loading,
  onChange,
  onRefresh
}: {
  view: RecapView
  onView: (view: RecapView) => void
  filters: RecapFilters
  facets: BuildWebRecapPage['facets']
  total: number
  loading: boolean
  onChange: (next: RecapFilters) => void
  onRefresh: () => void
}): React.JSX.Element {
  const versions = recapVersionOptions(facets.versions, filters.product)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={view}
        // Why the guard: a single toggle group lets the pressed item be clicked off.
        onValueChange={(next) => {
          const picked = RECAP_VIEWS.find((v) => v === next)
          if (picked) {
            onView(picked)
          }
        }}
        aria-label={translate('buildWeb.recaps.view', 'View')}
      >
        <ToggleGroupItem value="calendar">
          <CalendarDays />
          {translate('buildWeb.recaps.calendarView', 'Calendar')}
        </ToggleGroupItem>
        <ToggleGroupItem value="list">
          <List />
          {translate('buildWeb.recaps.listView', 'List')}
        </ToggleGroupItem>
      </ToggleGroup>
      <Select
        value={filters.product}
        onValueChange={(next) =>
          onChange(
            withRecapProduct(filters, facets.products.find((p) => p === next) ?? 'all', facets)
          )
        }
      >
        <SelectTrigger size="sm" aria-label={translate('buildWeb.recaps.product', 'Product')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            {translate('buildWeb.recaps.allProducts', 'All products')}
          </SelectItem>
          {facets.products.map((p) => (
            <SelectItem key={p} value={p}>
              <ProductChip product={p} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.versionId}
        onValueChange={(next) => onChange(withRecapVersion(filters, next, facets))}
      >
        <SelectTrigger size="sm" aria-label={translate('buildWeb.recaps.version', 'Version')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            {translate('buildWeb.recaps.allVersions', 'All versions')}
          </SelectItem>
          {versions.map((v) => (
            <SelectItem key={v.value} value={v.value}>
              {v.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {facets.automations ? (
        <RecapAutomationPicker
          automations={recapAutomationOptions(facets.automations, filters)}
          value={filters.automationId}
          onChange={(automationId) => onChange({ ...filters, automationId })}
        />
      ) : null}
      {/* Why only in the list: the calendar's month is its date range. */}
      {view === 'list' ? (
        <>
          <DateBound
            label={translate('buildWeb.recaps.from', 'From')}
            value={filters.from}
            max={filters.to || undefined}
            onChange={(from) => onChange({ ...filters, from })}
          />
          <DateBound
            label={translate('buildWeb.recaps.to', 'To')}
            value={filters.to}
            min={filters.from || undefined}
            onChange={(to) => onChange({ ...filters, to })}
          />
        </>
      ) : null}
      {hasRecapFilters(filters) ? (
        <Button variant="ghost" size="sm" onClick={() => onChange(NO_RECAP_FILTERS)}>
          {translate('buildWeb.recaps.reset', 'Reset')}
        </Button>
      ) : null}
      <div className="flex-1" />
      <span className="text-xs whitespace-nowrap text-muted-foreground">
        {translate('buildWeb.recaps.count', 'Reports: {{n}}', { n: total })}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={loading}
        aria-label={translate('buildWeb.page.refresh', 'Refresh')}
        onClick={onRefresh}
      >
        <RefreshCw />
      </Button>
    </div>
  )
}
