import { Fragment } from 'react'
import { Check, ChevronDown, Layers, Monitor, Server } from 'lucide-react'
import { useAppStore } from '../../store'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import {
  isSameUsageSource,
  LOCAL_USAGE_SOURCE,
  type UsageServer,
  type UsageSource
} from '@/store/slices/usage-hosts/usage-host-types'

type SourceOption = { source: UsageSource; label: string; icon: React.JSX.Element }

function sourceOptions(servers: readonly UsageServer[], selected: UsageSource): SourceOption[] {
  // Why kept: a chosen server that dropped off still reads as chosen, with its error showing.
  const chosenMissing =
    selected.kind === 'server' && !servers.some((server) => server.id === selected.environmentId)
      ? [{ id: selected.environmentId, label: selected.label }]
      : []
  return [
    {
      source: LOCAL_USAGE_SOURCE,
      label: translate('auto.components.stats.UsageSourceSelect.thisComputer', 'This computer'),
      icon: <Monitor className="size-3.5 text-muted-foreground" />
    },
    ...[...servers, ...chosenMissing].map((server) => ({
      source: { kind: 'server' as const, environmentId: server.id, label: server.label },
      label: server.label,
      icon: <Server className="size-3.5 text-muted-foreground" />
    })),
    {
      source: { kind: 'all' },
      label: translate(
        'auto.components.stats.UsageSourceSelect.allHosts',
        'This computer and all servers'
      ),
      icon: <Layers className="size-3.5 text-muted-foreground" />
    }
  ]
}

/** Picks whose agent transcripts the usage panes read; shown once a server is paired. */
export function UsageSourceSelect({
  servers
}: {
  servers: readonly UsageServer[]
}): React.JSX.Element | null {
  const usageSource = useAppStore((s) => s.usageSource)
  const setUsageSource = useAppStore((s) => s.setUsageSource)
  if (servers.length === 0 && usageSource.kind === 'local') {
    return null
  }
  const options = sourceOptions(servers, usageSource)
  const active =
    options.find((option) => isSameUsageSource(option.source, usageSource)) ?? options[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="usage-source-select"
          aria-label={translate(
            'auto.components.stats.UsageSourceSelect.ariaLabel',
            'Usage from: {{value0}}',
            { value0: active.label }
          )}
          className="min-w-36 max-w-64 justify-between"
        >
          <span className="flex min-w-0 items-center gap-2">
            {active.icon}
            <span className="truncate">{active.label}</span>
          </span>
          <ChevronDown className="ml-1 size-3.5 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {options.map((option, index) => (
          <Fragment
            key={option.source.kind === 'server' ? option.source.environmentId : option.source.kind}
          >
            {index === options.length - 1 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem onSelect={() => setUsageSource(option.source)}>
              <span className="flex min-w-0 items-center gap-2">
                {option.icon}
                <span className="truncate">{option.label}</span>
              </span>
              <Check
                className={cn(
                  'ml-auto size-3.5',
                  isSameUsageSource(option.source, usageSource) ? 'opacity-100' : 'opacity-0'
                )}
                aria-hidden
              />
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
