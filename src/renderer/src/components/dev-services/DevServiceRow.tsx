import React from 'react'
import { Copy, ExternalLink, Hammer, Play, RotateCw, Square, SquareTerminal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import type { DevServicesService } from '../../../../shared/dev-services-contract'
import { DevServiceStateDot } from './DevServiceStateDot'
import { DevServiceIconAction } from './DevServiceIconAction'
import { DevServiceChangedBadge } from './DevServiceChangedBadge'
import {
  formatDevServiceElapsed,
  isDevServiceActionable,
  isDevServiceRunning
} from './dev-services-sections'
import { devServicesActionKey, type DevServicesActions } from './use-dev-services-actions'

function stateLabel(service: DevServicesService): string {
  switch (service.state) {
    case 'ready':
      return translate('devServices.state.ready', 'Running')
    case 'starting':
      return translate('devServices.state.starting', 'Starting')
    case 'stopping':
      return translate('devServices.state.stopping', 'Stopping')
    case 'crashed':
      return translate('devServices.state.crashed', 'Crashed')
    case 'stopped':
      return translate('devServices.state.stopped', 'Stopped')
    case 'absent':
      return translate('devServices.state.absent', 'Not in this branch')
    case 'shared':
      return translate('devServices.state.shared', 'Shared with main')
    case 'unknown':
      return translate('devServices.state.unknown', 'Unknown state')
  }
}

/** The second line: why a service is not simply running or stopped. */
function stateDetail(service: DevServicesService): string | null {
  const since = typeof service.since === 'number' ? formatDevServiceElapsed(service.since) : null
  switch (service.state) {
    case 'starting':
      return since
        ? translate('devServices.detail.startingFor', 'Starting… {{value0}}', { value0: since })
        : translate('devServices.detail.starting', 'Starting…')
    case 'stopping':
      return translate('devServices.detail.stopping', 'Stopping…')
    case 'crashed':
      return [
        since
          ? translate('devServices.detail.crashedAgo', 'Crashed {{value0}} ago', { value0: since })
          : translate('devServices.state.crashed', 'Crashed'),
        typeof service.exit === 'number' ? `exit ${service.exit}` : null,
        service.restarts
          ? translate('devServices.detail.restart', 'restart #{{value0}}', {
              value0: service.restarts
            })
          : null,
        service.detail ?? null
      ]
        .filter(Boolean)
        .join(' · ')
    case 'absent':
    case 'shared':
    case 'unknown':
      return service.detail ?? stateLabel(service)
    case 'ready':
    case 'stopped':
      return service.detail ?? null
  }
}

export function DevServiceRow({
  service,
  actions
}: {
  service: DevServicesService
  actions: DevServicesActions
}): React.JSX.Element {
  const title = service.title ?? service.id
  const running = isDevServiceRunning(service)
  const actionable = isDevServiceActionable(service)
  const [mainPort, ...extraPorts] = service.ports
  const openUrl = running ? service.ports.find((port) => port.open && port.url)?.url : undefined
  const copyUrl = mainPort?.url
  const detail = stateDetail(service)
  const busy = (verb: string): boolean =>
    actions.pending.has(devServicesActionKey(verb, [service.id]))
  const runVerb = (verb: 'start' | 'stop' | 'restart' | 'rebuild', label: string): void =>
    actions.run({ verb, args: [service.id], label: `${label} ${title}` })

  const labels = {
    open: translate('devServices.row.open', 'Open in Browser'),
    copy: translate('devServices.row.copy', 'Copy Address'),
    console: translate('devServices.row.console', 'Open Console'),
    restart: translate('devServices.row.restart', 'Restart'),
    stop: translate('devServices.row.stop', 'Stop'),
    start: translate('devServices.row.start', 'Start'),
    rebuild: translate('devServices.row.rebuild', 'Rebuild and Restart')
  }
  // Why on a marked service only: `rebuild <id>` builds what its change touches, then restarts it.
  const rebuildable = Boolean(service.changed)
  const consoleCommand = service.console
  const openConsole = consoleCommand ? () => actions.openConsole(consoleCommand, title) : undefined

  return (
    <ContextMenu>
      <div className="group -mx-1 flex items-start gap-2 rounded px-1 py-1 transition-colors hover:bg-accent/50">
        <ContextMenuTrigger asChild>
          <div
            className="flex min-w-0 flex-1 items-start gap-2 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            tabIndex={0}
            aria-label={`${title}, ${stateLabel(service)}`}
          >
            <DevServiceStateDot state={service.state} label={stateLabel(service)} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-baseline gap-1.5">
                <span
                  className={cn(
                    'truncate text-xs',
                    running ? 'font-medium text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {title}
                </span>
                {mainPort && (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    :{mainPort.port}
                  </span>
                )}
                {extraPorts.length > 0 && (
                  <span
                    className="shrink-0 rounded border border-border px-1 text-3xs tabular-nums text-muted-foreground"
                    title={extraPorts.map((port) => `:${port.port}`).join(', ')}
                  >
                    +{extraPorts.length}
                  </span>
                )}
                {service.changed && <DevServiceChangedBadge changed={service.changed} />}
              </div>
              {detail && (
                <div
                  className={cn(
                    'truncate text-2xs',
                    service.state === 'crashed' ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  {detail}
                </div>
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        {actionable && (
          <div className="flex items-center gap-0.5 transition-opacity can-hover:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
            {openUrl && (
              <DevServiceIconAction
                label={labels.open}
                icon={<ExternalLink />}
                onClick={(event) => actions.openUrl(openUrl, event.detail > 0 ? event : undefined)}
              />
            )}
            {running && openConsole && (
              <DevServiceIconAction
                label={labels.console}
                icon={<SquareTerminal />}
                onClick={openConsole}
              />
            )}
            {rebuildable && (
              <DevServiceIconAction
                label={labels.rebuild}
                icon={<Hammer />}
                busy={busy('rebuild')}
                onClick={() => runVerb('rebuild', labels.rebuild)}
              />
            )}
            {running && (
              <DevServiceIconAction
                label={labels.restart}
                icon={<RotateCw />}
                busy={busy('restart')}
                onClick={() => runVerb('restart', labels.restart)}
              />
            )}
            {running ? (
              <DevServiceIconAction
                label={labels.stop}
                icon={<Square />}
                busy={busy('stop')}
                onClick={() => runVerb('stop', labels.stop)}
              />
            ) : (
              <DevServiceIconAction
                label={labels.start}
                icon={<Play />}
                busy={busy('start')}
                onClick={() => runVerb('start', labels.start)}
              />
            )}
          </div>
        )}
      </div>
      <ContextMenuContent>
        <ContextMenuLabel>{title}</ContextMenuLabel>
        {openUrl && (
          <ContextMenuItem onSelect={() => actions.openUrl(openUrl)}>
            <ExternalLink />
            {labels.open}
          </ContextMenuItem>
        )}
        {copyUrl && (
          <ContextMenuItem onSelect={() => actions.copyText(copyUrl)}>
            <Copy />
            {labels.copy}
          </ContextMenuItem>
        )}
        {openConsole && (
          <ContextMenuItem onSelect={openConsole}>
            <SquareTerminal />
            {labels.console}
          </ContextMenuItem>
        )}
        {actionable && (
          <>
            <ContextMenuSeparator />
            {rebuildable && (
              <ContextMenuItem onSelect={() => runVerb('rebuild', labels.rebuild)}>
                <Hammer />
                {labels.rebuild}
              </ContextMenuItem>
            )}
            {running ? (
              <>
                <ContextMenuItem onSelect={() => runVerb('restart', labels.restart)}>
                  <RotateCw />
                  {labels.restart}
                </ContextMenuItem>
                <ContextMenuItem
                  variant="destructive"
                  onSelect={() => runVerb('stop', labels.stop)}
                >
                  <Square />
                  {labels.stop}
                </ContextMenuItem>
              </>
            ) : (
              <ContextMenuItem onSelect={() => runVerb('start', labels.start)}>
                <Play />
                {labels.start}
              </ContextMenuItem>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
