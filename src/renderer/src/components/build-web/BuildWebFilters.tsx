import { Bot, Star, Ticket, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import type { BuildWebProduct } from '../../../../shared/build-web-types'
import { useBuildWebStore } from './build-web-store'
import { BuildWebStatusFilter, BuildWebToWorkToggle } from './BuildWebStatusFilter'
import { quickFilterLabel } from './build-web-labels'
import { ProductChip } from './BuildWebToneChip'
import { QUICK_FILTERS, type QuickFilter } from './build-web-view-prefs'

const QUICK_ICON: Record<QuickFilter, React.ReactNode> = {
  mine: <User />,
  ai: <Bot />,
  favorite: <Star />,
  jira: <Ticket />
}
const PRODUCTS: readonly BuildWebProduct[] = ['sa', 'dc', 'ap', 'storage', 'tools']

export function BuildWebFilters(): React.JSX.Element {
  const quick = useBuildWebStore((s) => s.quick)
  const query = useBuildWebStore((s) => s.query)
  const product = useBuildWebStore((s) => s.product)
  const toggleQuick = useBuildWebStore((s) => s.toggleQuick)
  const setQuery = useBuildWebStore((s) => s.setQuery)
  const setProduct = useBuildWebStore((s) => s.setProduct)

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 md:px-5">
      {/* Combined like build-web's: Mine and For AI together is my tasks handed to the model. */}
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
              <ProductChip product={p} />
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
