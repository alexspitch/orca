import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { BuildWebStandHealth } from '../../../../../shared/build-web-stand-types'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { StandUpdatesList } from './StandUpdatesList'

function OutdatedChip({ health }: { health: BuildWebStandHealth }): React.JSX.Element {
  const chip = (
    <BuildWebToneChip
      label={translate('buildWeb.stands.health.outdated', '{{count}} to update', {
        count: health.outdated
      })}
      tone="amber"
      title={health.updates?.length ? null : undefined}
    />
  )
  if (!health.updates?.length) {
    return chip
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{chip}</span>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={6} className="max-w-[28rem]">
        <StandUpdatesList updates={health.updates} />
      </TooltipContent>
    </Tooltip>
  )
}

/** A stand's monitoring in the stands table: failing and outdated services, or why there is none. */
export function StandHealthCell({
  health
}: {
  health: BuildWebStandHealth | undefined
}): React.JSX.Element {
  if (!health) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  if (health.error) {
    return (
      <span title={health.error}>
        <BuildWebToneChip
          label={translate('buildWeb.stands.health.unknown', 'not read')}
          tone="faint"
        />
      </span>
    )
  }
  if (!health.running) {
    return (
      <BuildWebToneChip
        label={translate('buildWeb.stands.health.stopped', 'stopped')}
        tone="faint"
      />
    )
  }
  if (health.failing === 0 && health.outdated === 0) {
    return <BuildWebToneChip label={translate('buildWeb.stands.health.ok', 'OK')} tone="green" />
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      {health.failing ? (
        <BuildWebToneChip
          label={translate('buildWeb.stands.health.failing', '{{count}} failing', {
            count: health.failing
          })}
          tone="red"
        />
      ) : null}
      {health.outdated ? <OutdatedChip health={health} /> : null}
    </span>
  )
}
