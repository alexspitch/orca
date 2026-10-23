import { useEffect } from 'react'
import { CircleArrowUp, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type {
  BuildWebStandGroup,
  BuildWebStandHealth,
  BuildWebStandHealthMap
} from '../../../../../shared/build-web-stand-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { useStandGroups } from './stand-groups-store'
import { productsOf, StandFacts } from './StandFacts'
import { StandHealthCell } from './StandHealthCell'
import { StandProductChip } from './StandProductChip'
import { useStandOp } from './use-stand-op'
import { isJobActive, useStandJobFollow } from './use-stand-job-follow'

function HideToggle({
  hidden,
  onToggle
}: {
  hidden: boolean
  onToggle: () => void
}): React.JSX.Element {
  const label = hidden
    ? translate('buildWeb.stands.unhide', 'Show in the list and monitor again')
    : translate('buildWeb.stands.hide', 'Hide from the list and stop monitoring')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          onClick={(event) => {
            event.stopPropagation()
            onToggle()
          }}
        >
          {hidden ? <Eye /> : <EyeOff />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** `docker compose up -d` of the stand, from its row; the row's Monitoring cell follows it. */
function StandUpButton({
  target,
  group
}: {
  target: RuntimeClientTarget
  group: BuildWebStandGroup
}): React.JSX.Element {
  const op = useStandOp(target, group)
  useEffect(() => {
    if (op.error) {
      toast.error(op.error)
    }
  }, [op.error])
  const label = !group.opsCardId
    ? translate('buildWeb.stands.ops.disabled', 'The stand is disabled in build-web.')
    : op.running
      ? translate('buildWeb.stands.ops.running', 'An operation is already running on the stand')
      : translate('buildWeb.stands.ops.upRow', 'Update the stand: docker compose up -d')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Why the span: a disabled button gets no pointer events, so no tooltip. */}
        <span tabIndex={op.canOperate ? -1 : 0}>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            disabled={!op.canOperate}
            onClick={(event) => {
              event.stopPropagation()
              void op.run('up')
            }}
          >
            {op.running ? <Loader2 className="animate-spin" /> : <CircleArrowUp />}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** The Monitoring cell: the stand's operation while it goes or after it failed, then its health. */
function StandMonitoringCell({
  target,
  group,
  health
}: {
  target: RuntimeClientTarget
  group: BuildWebStandGroup
  health: BuildWebStandHealth | undefined
}): React.JSX.Element {
  const job = useStandJobFollow(target, group, group.enabled)
  if (job && isJobActive(job)) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        <BuildWebToneChip
          label={
            job.status === 'queued'
              ? translate('buildWeb.stands.ops.queued', 'waiting to update')
              : translate('buildWeb.stands.ops.updating', 'updating…')
          }
          tone="blue"
        />
      </span>
    )
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      {job && job.status !== 'success' ? (
        <BuildWebToneChip
          label={translate('buildWeb.stands.ops.updateFailed', 'update {{status}}', {
            status: job.status
          })}
          tone="red"
          title={job.error ?? job.status}
        />
      ) : null}
      <StandHealthCell health={health} />
    </span>
  )
}

/** Every stand, one row each, for a page opened without one picked; hidden ones only on request. */
export function StandDirectory({
  target,
  groups,
  health,
  onSelect
}: {
  target: RuntimeClientTarget
  groups: BuildWebStandGroup[]
  health: BuildWebStandHealthMap | null
  onSelect: (key: string) => void
}): React.JSX.Element {
  const hiddenKeys = useStandGroups((s) => s.hiddenKeys)
  const showHidden = useStandGroups((s) => s.showHidden)
  const setHidden = useStandGroups((s) => s.setHidden)
  const setShowHidden = useStandGroups((s) => s.setShowHidden)
  if (groups.length === 0) {
    return (
      <p className="px-3 py-10 text-center text-sm text-muted-foreground">
        {translate(
          'buildWeb.stands.none',
          'No stands yet. They are added in build-web’s settings.'
        )}
      </p>
    )
  }
  const hidden = new Set(hiddenKeys)
  // Why counted over the directory: a key may outlive the stand it hid.
  const hiddenCount = groups.filter((g) => hidden.has(g.key)).length
  const rows = showHidden ? groups : groups.filter((g) => !hidden.has(g.key))
  return (
    <div className="flex min-h-0 flex-col gap-2">
      {hiddenCount > 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {translate('buildWeb.stands.hiddenCount', '{{count}} hidden', { count: hiddenCount })}
          </span>
          <Button variant="ghost" size="xs" onClick={() => setShowHidden(!showHidden)}>
            {showHidden
              ? translate('buildWeb.stands.collapseHidden', 'Leave them out')
              : translate('buildWeb.stands.showHidden', 'Show them')}
          </Button>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="px-3 py-10 text-center text-sm text-muted-foreground">
          {translate('buildWeb.stands.allHidden', 'Every stand is hidden.')}
        </p>
      ) : (
        <div className="scrollbar-sleek min-h-0 overflow-auto rounded-md border border-border">
          <table className="w-full min-w-[560px] table-fixed border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b border-border text-left text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="py-2 pl-3">{translate('buildWeb.stands.columns.name', 'Name')}</th>
                <th className="w-[22%] py-2">
                  {translate('buildWeb.stands.columns.product', 'Product')}
                </th>
                <th className="w-[26%] py-2">
                  {translate('buildWeb.stands.columns.health', 'Monitoring')}
                </th>
                <th className="w-20 py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((group) => {
                const isHidden = hidden.has(group.key)
                return (
                  <tr
                    key={group.key}
                    onClick={() => onSelect(group.key)}
                    className={cn(
                      'cursor-pointer border-b border-border/60 align-top last:border-b-0 hover:bg-accent',
                      isHidden && 'text-muted-foreground'
                    )}
                  >
                    <td className="max-w-0 py-2 pr-3 pl-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onSelect(group.key)
                        }}
                        className="block max-w-full truncate rounded-sm text-left text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {group.name}
                      </button>
                      <StandFacts group={group} withProducts={false} />
                    </td>
                    <td className="py-2 pr-3">
                      <span className="flex flex-wrap gap-1">
                        {productsOf(group).map((p) => (
                          <StandProductChip key={p} product={p} />
                        ))}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {/* Why nothing read for these: the host skips a disabled or hidden stand. */}
                      {isHidden ? (
                        <BuildWebToneChip
                          label={translate('buildWeb.stands.health.hidden', 'hidden')}
                          tone="faint"
                        />
                      ) : group.enabled ? (
                        <StandMonitoringCell
                          target={target}
                          group={group}
                          health={health?.[group.key]}
                        />
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className="flex justify-end gap-0.5">
                        {isHidden ? null : <StandUpButton target={target} group={group} />}
                        <HideToggle
                          hidden={isHidden}
                          onToggle={() => setHidden(group.key, !isHidden)}
                        />
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
