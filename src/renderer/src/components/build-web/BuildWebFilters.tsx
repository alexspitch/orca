import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import {
  BUILD_WEB_STATUSES,
  type BuildWebProduct,
  type BuildWebView
} from '../../../../shared/build-web-types'
import { useBuildWebStore, type BuildWebStatusFilter } from './build-web-store'
import { productLabel, statusLabel, viewLabel } from './build-web-labels'

const VIEWS: readonly BuildWebView[] = ['mine', 'ai', 'favorite', 'all']
const PRODUCTS: readonly BuildWebProduct[] = ['sa', 'dc', 'ap', 'storage', 'tools']

function statusFilterOf(value: string): BuildWebStatusFilter {
  if (value === 'open' || value === 'all') {
    return value
  }
  return BUILD_WEB_STATUSES.find((s) => s === value) ?? 'open'
}

export function BuildWebFilters(): React.JSX.Element {
  const view = useBuildWebStore((s) => s.view)
  const query = useBuildWebStore((s) => s.query)
  const statusFilter = useBuildWebStore((s) => s.statusFilter)
  const product = useBuildWebStore((s) => s.product)
  const setView = useBuildWebStore((s) => s.setView)
  const setQuery = useBuildWebStore((s) => s.setQuery)
  const setStatusFilter = useBuildWebStore((s) => s.setStatusFilter)
  const setProduct = useBuildWebStore((s) => s.setProduct)

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 md:px-5">
      <Tabs value={view} onValueChange={(next) => setView(VIEWS.find((v) => v === next) ?? 'mine')}>
        <TabsList>
          {VIEWS.map((v) => (
            <TabsTrigger key={v} value={v}>
              {viewLabel(v)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Select value={statusFilter} onValueChange={(next) => setStatusFilter(statusFilterOf(next))}>
        <SelectTrigger size="sm" aria-label={translate('buildWeb.filters.status', 'Status')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">{translate('buildWeb.filters.open', 'Open')}</SelectItem>
          <SelectItem value="all">
            {translate('buildWeb.filters.anyStatus', 'Any status')}
          </SelectItem>
          {BUILD_WEB_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {statusLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={product}
        onValueChange={(next) => setProduct(PRODUCTS.find((p) => p === next) ?? 'all')}
      >
        <SelectTrigger size="sm" aria-label={translate('buildWeb.filters.product', 'Product')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            {translate('buildWeb.filters.allProducts', 'All products')}
          </SelectItem>
          {PRODUCTS.map((p) => (
            <SelectItem key={p} value={p}>
              {productLabel(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={translate('buildWeb.filters.search', 'Search by key or title')}
        aria-label={translate('buildWeb.filters.search', 'Search by key or title')}
        className="h-8 min-w-48 flex-1"
        data-escape-clears-value="true"
      />
    </div>
  )
}
