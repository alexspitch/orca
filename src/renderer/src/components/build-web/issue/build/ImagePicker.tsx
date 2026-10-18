import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
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

// Why a cap: the registry holds a few hundred images; the search narrows them, the list stays short.
const SHOWN = 80

/** One image out of the registry's list, found by typing a part of its name. */
export function ImagePicker({
  images,
  value,
  onChange,
  disabled,
  className
}: {
  images: string[]
  value: string | null
  onChange: (image: string | null) => void
  disabled?: boolean
  className?: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const found = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (q ? images.filter((i) => i.toLowerCase().includes(q)) : images).slice(0, SHOWN)
  }, [images, query])
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
          disabled={disabled}
          className={cn('min-w-0 justify-between', className)}
        >
          <span className={cn('truncate', value ? 'font-mono text-xs' : 'text-muted-foreground')}>
            {value ?? translate('buildWeb.run.pickImage', 'Pick an image…')}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(440px,calc(100vw-2rem))]">
        <Command shouldFilter={false}>
          <CommandInput
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder={translate('buildWeb.run.searchImage', 'Search images')}
          />
          <CommandList>
            <CommandEmpty>{translate('buildWeb.run.noSuchImage', 'No such image.')}</CommandEmpty>
            {found.map((image) => (
              <CommandItem
                key={image}
                value={image}
                onSelect={() => {
                  onChange(image)
                  setOpen(false)
                  setQuery('')
                }}
              >
                <span className="font-mono text-xs">{image}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
