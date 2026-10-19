import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebStandGroup,
  BuildWebStandOpKind
} from '../../../../../shared/build-web-stand-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { BuildWebJobPanel } from '../BuildWebJobPanel'
import { BuildWebListState } from '../BuildWebListState'
import { ResizableSplit } from '../issue/ResizableSplit'
import { useStandGroups } from './stand-groups-store'
import { StandLogPanel } from './StandLogPanel'
import { StandServicesTable } from './StandServicesTable'
import { useStandStatus } from './use-stand-status'

const message = (failure: unknown) => (failure instanceof Error ? failure.message : String(failure))

/** What the stand runs; restart one service or bring the whole stand up, and read a service's log. */
export function StandServicesTab({
  target,
  group
}: {
  target: RuntimeClientTarget
  group: BuildWebStandGroup
}): React.JSX.Element {
  const { status, error, loading, reload } = useStandStatus(target, group.statusCardId)
  const job = useStandGroups((s) => s.jobs[group.key] ?? null)
  const setJob = useStandGroups((s) => s.setJob)
  const confirm = useConfirmationDialog()
  const [logService, setLogService] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [opError, setOpError] = useState<string | null>(null)
  const running = job?.status === 'queued' || job?.status === 'running'
  const canOperate = group.opsCardId !== null && !starting && !running

  // Why: an operation started elsewhere (build-web, another window) shows here too.
  const cardIds = group.cards.map((c) => c.id).join(',')
  useEffect(() => {
    let alive = true
    void callBuildWeb(target, 'standJobs', { standIds: cardIds.split(',') })
      .then((result) => {
        if (alive && result.ok && result.value[0] && !useStandGroups.getState().jobs[group.key]) {
          setJob(group.key, result.value[0])
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [cardIds, group.key, setJob, target])

  const place = `${group.sshHost}:${group.dir}`
  const lockNote = group.lock
    ? ` ${translate('buildWeb.stands.ops.lockNote', 'The stand is held by {{holder}}; the operation waits for it.', { holder: group.lock.heldBy })}`
    : ''
  const runOp = async (kind: BuildWebStandOpKind, service?: string): Promise<void> => {
    if (!group.opsCardId) {
      return
    }
    const ok = await confirm(
      kind === 'up'
        ? {
            title: translate('buildWeb.stands.ops.upTitle', 'Bring {{stand}} up?', {
              stand: group.name
            }),
            description:
              translate(
                'buildWeb.stands.ops.upDescription',
                'docker compose up -d in {{place}}: every service is created or recreated as its compose files say.',
                { place }
              ) + lockNote,
            confirmLabel: translate('buildWeb.stands.ops.upConfirm', 'Run up -d')
          }
        : {
            title: translate('buildWeb.stands.ops.restartTitle', 'Restart {{service}}?', {
              service: service ?? ''
            }),
            description:
              translate(
                'buildWeb.stands.ops.restartDescription',
                'docker compose restart {{service}} in {{place}}.',
                { service: service ?? '', place }
              ) + lockNote,
            confirmLabel: translate('buildWeb.stands.ops.restartConfirm', 'Restart')
          }
    )
    if (!ok) {
      return
    }
    setStarting(true)
    setOpError(null)
    try {
      const result = await callBuildWeb(target, 'standOp', {
        standId: group.opsCardId,
        kind,
        ...(service ? { services: [service] } : {})
      })
      if (result.ok) {
        setJob(group.key, result.value)
      } else {
        setOpError(result.error)
      }
    } catch (failure) {
      setOpError(message(failure))
    } finally {
      setStarting(false)
    }
  }

  const services = status?.services ?? []
  const table = (compact: boolean) => (
    <StandServicesTable
      services={services}
      compact={compact}
      logService={logService}
      canRestart={canOperate}
      onLog={setLogService}
      onRestart={(service) => void runOp('restart', service)}
    />
  )
  const upLabel = translate('buildWeb.stands.ops.up', 'docker compose up -d')
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {status
            ? translate('buildWeb.stands.services.count', '{{n}} services', { n: services.length })
            : null}
        </span>
        {status?.detailsError ? (
          <span className="truncate text-xs text-muted-foreground" title={status.detailsError}>
            {translate('buildWeb.stands.services.noBuilds', 'Build numbers could not be read.')}
          </span>
        ) : null}
        <div className="flex-1" />
        {group.opsCardId ? null : (
          <span className="text-xs text-muted-foreground">
            {translate('buildWeb.stands.ops.disabled', 'The stand is disabled in build-web.')}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={translate('buildWeb.stands.refresh', 'Read again')}
          disabled={loading}
          onClick={reload}
        >
          <RefreshCw />
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={!canOperate}
              onClick={() => void runOp('up')}
            >
              {upLabel}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {translate('buildWeb.stands.ops.upHint', 'Every service of the stand')}
          </TooltipContent>
        </Tooltip>
      </div>
      {opError ? (
        <p role="alert" className="text-xs text-destructive">
          {opError}
        </p>
      ) : null}
      {job ? (
        <div className="flex items-start gap-2 rounded-md border border-border p-3">
          <div className="min-w-0 flex-1">
            <BuildWebJobPanel
              key={job.id}
              target={target}
              jobId={job.id}
              label={job.kind}
              onJob={(next) => setJob(group.key, next)}
              onDone={reload}
            />
          </div>
          {running ? null : (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={translate('buildWeb.stands.ops.dismiss', 'Hide')}
              onClick={() => setJob(group.key, null)}
            >
              <X />
            </Button>
          )}
        </div>
      ) : null}
      {status === null ? (
        <BuildWebListState
          kind={error ? 'error' : 'loading'}
          error={error}
          onRetry={reload}
          loadingLabel={translate('buildWeb.stands.services.loading', 'Reading the stand…')}
        />
      ) : (
        <>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          {logService ? (
            <ResizableSplit
              panel="stand-services"
              side="left"
              defaultWidth={460}
              minWidth={340}
              ruled
              className="min-h-0 flex-1 overflow-hidden rounded-md border border-border"
              aside={table(true)}
            >
              <StandLogPanel
                key={`${group.statusCardId}/${logService}`}
                target={target}
                standId={group.statusCardId}
                service={logService}
                onClose={() => setLogService(null)}
              />
            </ResizableSplit>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border">
              {table(false)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
