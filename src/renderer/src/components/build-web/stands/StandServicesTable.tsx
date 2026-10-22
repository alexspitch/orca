import { RotateCw, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { BuildWebStandService } from '../../../../../shared/build-web-stand-types'
import { BuildWebToneChip } from '../BuildWebToneChip'
import {
  buildNumberOf,
  imagePartsOf,
  isNotApplied
} from '../../../../../shared/build-web-stand-services'
import { serviceStateLabel, serviceStateTone } from './stand-service-rows'

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—')

function RowAction({
  label,
  disabled,
  onClick,
  children
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function ServiceRow({
  service,
  compact,
  current,
  canRestart,
  onLog,
  onRestart
}: {
  service: BuildWebStandService
  compact: boolean
  current: boolean
  canRestart: boolean
  onLog: () => void
  onRestart: () => void
}): React.JSX.Element {
  const image = imagePartsOf(service.image)
  const build = buildNumberOf(service.build)
  const notApplied = isNotApplied(service)
  return (
    <tr
      data-current={current ? 'true' : undefined}
      className={cn(
        'border-b border-border/60 align-top last:border-b-0 hover:bg-accent',
        current && 'bg-accent'
      )}
    >
      <td className="max-w-0 py-2 pr-3 pl-3">
        <span className="block truncate font-mono text-xs" title={service.container ?? undefined}>
          {service.service}
        </span>
      </td>
      <td className="max-w-0 py-2 pr-3">
        <BuildWebToneChip label={serviceStateLabel(service)} tone={serviceStateTone(service)} />
        {service.status ? (
          <span className="mt-0.5 block truncate text-2xs text-muted-foreground">
            {service.status}
          </span>
        ) : null}
      </td>
      {compact ? null : (
        <td className="max-w-0 py-2 pr-3">
          <span
            className="block truncate font-mono text-xs text-muted-foreground"
            title={service.image}
          >
            {image.path}
          </span>
          {notApplied ? (
            <BuildWebToneChip
              className="mt-0.5"
              label={translate('buildWeb.stands.services.notApplied', 'not applied')}
              tone="amber"
            />
          ) : null}
        </td>
      )}
      {compact ? null : (
        <td className="max-w-0 py-2 pr-3">
          <span className="block truncate font-mono text-xs" title={image.tag}>
            {image.tag}
          </span>
        </td>
      )}
      <td className="max-w-0 py-2 pr-3">
        {build ? (
          <span className="block font-mono text-xs" title={service.build ?? undefined}>
            #{build}
          </span>
        ) : (
          <span className="block text-xs text-muted-foreground">—</span>
        )}
        {service.imageCreatedAt ? (
          <span
            className="mt-0.5 block truncate text-2xs text-muted-foreground"
            title={translate('buildWeb.stands.services.builtAt', 'Image built {{when}}', {
              when: when(service.imageCreatedAt)
            })}
          >
            {when(service.imageCreatedAt)}
          </span>
        ) : null}
      </td>
      {compact ? null : (
        <td className="py-2 text-xs whitespace-nowrap text-muted-foreground">
          {when(service.startedAt)}
        </td>
      )}
      <td className="py-1.5 pr-3">
        <span className="flex justify-end gap-0.5">
          <RowAction label={translate('buildWeb.stands.services.log', 'Log')} onClick={onLog}>
            <ScrollText />
          </RowAction>
          <RowAction
            label={translate('buildWeb.stands.services.restart', 'Restart')}
            disabled={!canRestart}
            onClick={onRestart}
          >
            <RotateCw />
          </RowAction>
        </span>
      </td>
    </tr>
  )
}

/** The stand's services as its compose names them, with what each one runs right now. */
export function StandServicesTable({
  services,
  compact,
  logService,
  canRestart,
  onLog,
  onRestart
}: {
  services: BuildWebStandService[]
  /** Beside an open log: the columns that name and judge a service only. */
  compact: boolean
  logService: string | null
  canRestart: boolean
  onLog: (service: string) => void
  onRestart: (service: string) => void
}): React.JSX.Element {
  return (
    <div className="scrollbar-sleek h-full min-h-0 overflow-auto">
      <table
        className={cn(
          'w-full table-fixed border-collapse text-sm',
          compact ? 'min-w-[380px]' : 'min-w-[900px]'
        )}
      >
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b border-border text-left text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
            <th className="w-[26%] py-2 pl-3">
              {translate('buildWeb.stands.services.service', 'Service')}
            </th>
            <th className={cn('py-2', compact ? 'w-[34%]' : 'w-[18%]')}>
              {translate('buildWeb.stands.services.state', 'State')}
            </th>
            {compact ? null : (
              <th className="py-2">{translate('buildWeb.stands.services.image', 'Image')}</th>
            )}
            {compact ? null : (
              <th className="w-28 py-2">{translate('buildWeb.stands.services.tag', 'Tag')}</th>
            )}
            <th className="w-40 py-2">{translate('buildWeb.stands.services.build', 'Build')}</th>
            {compact ? null : (
              <th className="w-40 py-2">
                {translate('buildWeb.stands.services.started', 'Started')}
              </th>
            )}
            <th className="w-20 py-2 pr-3" />
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <ServiceRow
              key={service.service}
              service={service}
              compact={compact}
              current={service.service === logService}
              canRestart={canRestart}
              onLog={() => onLog(service.service)}
              onRestart={() => onRestart(service.service)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
