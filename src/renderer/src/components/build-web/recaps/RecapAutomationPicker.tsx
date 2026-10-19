import { useMemo, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { BuildWebRecapAutomation } from '../../../../../shared/build-web-recap-types'
import { ProductChip } from '../BuildWebToneChip'

/** One automation out of those with reports, found by typing a part of its name. */
export function RecapAutomationPicker({
  automations,
  value,
  onChange
}: {
  automations: readonly BuildWebRecapAutomation[]
  /** An automation id, or 'all'. */
  value: string
  onChange: (automationId: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const found = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? automations.filter((a) => a.name.toLowerCase().includes(q)) : automations
  }, [automations, query])
  const picked = automations.find((a) => a.id === value) ?? null
  const pick = (automationId: string) => {
    onChange(automationId)
    setOpen(false)
    setQuery('')
  }
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setQuery('')
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label={translate('buildWeb.recaps.automation', 'Automation')}
          className="max-w-72 min-w-0 justify-between"
        >
          <span className="truncate">
            {picked?.name ?? translate('buildWeb.recaps.allAutomations', 'All automations')}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(420px,calc(100vw-2rem))]">
        <Command shouldFilter={false}>
          <CommandInput
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder={translate('buildWeb.recaps.searchAutomation', 'Search automations')}
          />
          <CommandList>
            <CommandEmpty>
              {translate('buildWeb.recaps.noSuchAutomation', 'No such automation.')}
            </CommandEmpty>
            {query.trim() ? null : (
              <CommandItem value="all" onSelect={() => pick('all')}>
                <Check className={cn('size-3.5', value === 'all' ? 'opacity-100' : 'opacity-0')} />
                {translate('buildWeb.recaps.allAutomations', 'All automations')}
              </CommandItem>
            )}
            {found.map((a) => (
              <CommandItem key={a.id} value={a.id} onSelect={() => pick(a.id)}>
                <Check className={cn('size-3.5', value === a.id ? 'opacity-100' : 'opacity-0')} />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <ProductChip product={a.product} />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
