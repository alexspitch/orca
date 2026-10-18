import React, { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'

export type GitLogPickerOption = {
  id: string
  label: string
  detail?: string
  badge?: string
}

/** A searchable header picker — `Command` inside `Popover`, per the style guide. */
export function GitLogPicker({
  value,
  options,
  placeholder,
  searchLabel,
  emptyLabel,
  onPick
}: {
  value: GitLogPickerOption | null
  options: readonly GitLogPickerOption[]
  placeholder: string
  searchLabel: string
  emptyLabel: string
  onPick: (id: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 max-w-[16rem] min-w-0 items-center gap-1 rounded-md px-2 text-[13px] hover:bg-accent data-[state=open]:bg-accent"
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value?.label ?? placeholder}
          </span>
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <Command>
          <CommandInput placeholder={searchLabel} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.label} ${option.detail ?? ''} ${option.id}`}
                  onSelect={() => {
                    onPick(option.id)
                    setOpen(false)
                  }}
                  className="gap-2"
                >
                  <Check
                    className={cn(
                      'size-3.5 shrink-0',
                      option.id === value?.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.detail ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {option.detail}
                      </span>
                    ) : null}
                  </span>
                  {option.badge ? (
                    <span className="shrink-0 text-2xs text-muted-foreground">{option.badge}</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function gitLogPickerSearchLabels(): {
  project: string
  worktree: string
  empty: string
} {
  return {
    project: translate('gitLog.picker.searchProjects', 'Search projects'),
    worktree: translate('gitLog.picker.searchWorktrees', 'Search worktrees'),
    empty: translate('gitLog.picker.noMatches', 'Nothing matches')
  }
}
