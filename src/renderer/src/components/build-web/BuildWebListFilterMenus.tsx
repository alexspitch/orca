import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { BUILD_WEB_PRODUCTS } from '../../../../shared/build-web-types'
import { useBuildWebStore } from './build-web-store'
import { assigneeFilterOptions, type AssigneeFilterOption } from './build-web-assignee-options'
import { assigneeFilterLabel, loginOf } from './build-web-labels'
import { ProductChip } from './BuildWebToneChip'
import { useBuildWebAssignees } from './use-build-web-data'

/** Several products at once; none ticked lists every product. */
export function BuildWebProductFilter(): React.JSX.Element {
  const products = useBuildWebStore((s) => s.products)
  const toggleProduct = useBuildWebStore((s) => s.toggleProduct)
  const setProducts = useBuildWebStore((s) => s.setProducts)
  const shown = BUILD_WEB_PRODUCTS.filter((p) => products.has(p))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={translate('buildWeb.filters.product', 'Product')}
        >
          {shown.length === 0
            ? translate('buildWeb.filters.allProducts', 'All products')
            : shown.map((p) => <ProductChip key={p} product={p} />)}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => setProducts([])}>
          {translate('buildWeb.filters.allProducts', 'All products')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {BUILD_WEB_PRODUCTS.map((p) => (
          <DropdownMenuCheckboxItem
            key={p}
            checked={products.has(p)}
            // Why: the menu stays open so several products are ticked in one go.
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => toggleProduct(p)}
          >
            <ProductChip product={p} />
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function assigneeSummary(selected: ReadonlySet<string>): string {
  if (selected.size === 0) {
    return translate('buildWeb.filters.anyAssignee', 'Any assignee')
  }
  const [only] = selected
  return selected.size === 1
    ? assigneeFilterLabel(only)
    : translate('buildWeb.filters.assigneeCount', '{{count}} assignees', { count: selected.size })
}

/** Tasks of any of the ticked people, Mine and the unassigned among them. */
export function BuildWebAssigneeFilter(): React.JSX.Element {
  const assignees = useBuildWebStore((s) => s.assignees)
  const toggleAssignee = useBuildWebStore((s) => s.toggleAssignee)
  const setAssignees = useBuildWebStore((s) => s.setAssignees)
  const me = useBuildWebStore((s) => s.status?.login ?? null)
  const [open, setOpen] = useState(false)
  const users = useBuildWebAssignees(open)
  const { own, people } = assigneeFilterOptions(users, me, assignees)
  const item = (option: AssigneeFilterOption) => (
    <DropdownMenuCheckboxItem
      key={option.value}
      checked={assignees.has(option.value)}
      onSelect={(event) => event.preventDefault()}
      onCheckedChange={() => toggleAssignee(option.value)}
    >
      <span>{option.user ? loginOf(option.user.email) : assigneeFilterLabel(option.value)}</span>
      {option.user?.name && option.user.name !== loginOf(option.user.email) ? (
        <span className="text-xs text-muted-foreground">{option.user.name}</span>
      ) : null}
    </DropdownMenuCheckboxItem>
  )
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={translate('buildWeb.filters.assignee', 'Assignee')}
        >
          {assigneeSummary(assignees)}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => setAssignees([])}>
          {translate('buildWeb.filters.anyAssignee', 'Any assignee')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {own.map(item)}
        {people.length > 0 ? <DropdownMenuSeparator /> : null}
        {people.map(item)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
