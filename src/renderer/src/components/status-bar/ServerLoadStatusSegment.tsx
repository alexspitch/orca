import { Cpu, MemoryStick } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatMemory } from './resource-usage-metrics'
import { isServerLoadHigh, type ServerLoad, type ServerLoadResult } from './server-load'
import { useServerLoad } from './use-server-load'

export type ServerLoadHost = { id: string; label: string }

/** Each connected server's CPU and memory; its bullet turns red when either runs high. */
export function ServerLoadStatusSegment({
  servers,
  compact,
  iconOnly
}: {
  /** Connected Orca servers only, a handful; never the SSH config's host list. */
  servers: readonly ServerLoadHost[]
  compact: boolean
  iconOnly: boolean
}): React.JSX.Element | null {
  const results = useServerLoad(servers.map((server) => server.id))
  if (servers.length === 0) {
    return null
  }
  return (
    <>
      {servers.map((server) => (
        <ServerLoadChip
          key={server.id}
          label={server.label}
          result={results[server.id]}
          compact={compact}
          iconOnly={iconOnly}
        />
      ))}
    </>
  )
}

function ServerLoadChip({
  label,
  result,
  compact,
  iconOnly
}: {
  label: string
  result: ServerLoadResult | undefined
  compact: boolean
  iconOnly: boolean
}): React.JSX.Element {
  const load = result?.status === 'sampled' ? result.load : null
  const high = load ? isServerLoadHigh(load) : false
  const summary = serverLoadSummary(label, result)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={summary}
          className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span
            aria-hidden
            className={cn(
              'inline-block size-1.5 shrink-0 rounded-full',
              !load ? 'bg-muted-foreground/40' : high ? 'bg-destructive' : 'bg-status-success'
            )}
          />
          {iconOnly ? null : <span className="max-w-32 truncate text-foreground">{label}</span>}
          {iconOnly ? null : load ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 tabular-nums',
                high && 'text-destructive'
              )}
            >
              {compact ? null : <Cpu className="size-3" aria-hidden />}
              {percent(load.cpuPercent)}
              {compact ? '/' : <MemoryStick className="ml-0.5 size-3" aria-hidden />}
              {percent(load.memoryPercent)}
            </span>
          ) : (
            <span>—</span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {load ? <ServerLoadDetails label={label} load={load} high={high} /> : summary}
      </TooltipContent>
    </Tooltip>
  )
}

function ServerLoadDetails({
  label,
  load,
  high
}: {
  label: string
  load: ServerLoad
  high: boolean
}): React.JSX.Element {
  return (
    <div className="space-y-0.5">
      <div className="font-medium">{label}</div>
      <div>
        {load.cpuSource === 'busy'
          ? translate(
              'statusBar.serverLoad.cpu',
              'CPU {{value0}} · load {{value1}} on {{value2}} cores',
              {
                value0: percent(load.cpuPercent),
                value1: load.loadAverage1m.toFixed(2),
                value2: load.cpuCoreCount
              }
            )
          : translate(
              'statusBar.serverLoad.cpuFromLoad',
              'Load {{value0}} on {{value1}} cores ({{value2}})',
              {
                value0: load.loadAverage1m.toFixed(2),
                value1: load.cpuCoreCount,
                value2: percent(load.cpuPercent)
              }
            )}
      </div>
      <div>
        {translate('statusBar.serverLoad.memory', 'Memory {{value0}} of {{value1}} ({{value2}})', {
          value0: formatMemory(load.usedMemory),
          value1: formatMemory(load.totalMemory),
          value2: percent(load.memoryPercent)
        })}
      </div>
      {high ? (
        <div className="text-destructive">
          {translate('statusBar.serverLoad.high', 'High load')}
        </div>
      ) : null}
    </div>
  )
}

function serverLoadSummary(label: string, result: ServerLoadResult | undefined): string {
  switch (result?.status) {
    case undefined:
      return translate('statusBar.serverLoad.reading', '{{value0}}: reading load…', {
        value0: label
      })
    case 'unreachable':
      return translate('statusBar.serverLoad.unreachable', "Couldn't read {{value0}}'s load.", {
        value0: label
      })
    case 'update-required':
      return translate(
        'statusBar.serverLoad.update',
        'Update Orca on {{value0}} to see its load.',
        {
          value0: label
        }
      )
    case 'sampled':
      return translate(
        'statusBar.serverLoad.summary',
        '{{value0}}: CPU {{value1}}, memory {{value2}}',
        {
          value0: label,
          value1: percent(result.load.cpuPercent),
          value2: percent(result.load.memoryPercent)
        }
      )
  }
}

function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}%`
}
