import { useCallback, useEffect, useState } from 'react'
import { Eye, Play, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { BuildWebTrain } from '../../../../../shared/build-web-train-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { useBuildWebStore } from '../build-web-store'
import { useBuildWebStatus, useBuildWebTarget } from '../use-build-web-data'
import { useBuildWebPageEscape } from '../use-build-web-page-escape'
import { BuildWebConnect } from '../BuildWebConnect'
import { BuildWebListState } from '../BuildWebListState'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { BuildLogDialog } from '../images/BuildLogDialog'
import { TrainHistory } from './TrainHistory'
import { TrainPreviewDialog } from './TrainPreviewDialog'
import { trainRunTone } from './train-tones'

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—')
const GRID =
  'grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_120px_minmax(0,1fr)_minmax(0,1.4fr)_72px] items-center gap-x-3'

function TrainIcon({
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
          onClick={(event) => {
            event.stopPropagation()
            onClick()
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** The trains on top, the windows of the one picked below — after build-web's TrainsView. */
function TrainsView({ target, canRun }: { target: RuntimeClientTarget; canRun: boolean }) {
  const confirm = useConfirmationDialog()
  const [trains, setTrains] = useState<BuildWebTrain[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<BuildWebTrain | null>(null)
  const [starting, setStarting] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const next = await callBuildWeb(target, 'listTrains')
      setTrains(next)
      setError(null)
      setSelected((current) => current ?? next[0]?.id ?? null)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    }
  }, [target])
  useEffect(() => {
    void load()
  }, [load])

  const openIssue = (id: string) => {
    useBuildWebStore.getState().openIssue(id)
    useAppStore.getState().openBuildWebPage()
  }

  /** Depart now; the schedule stays — the next hour still departs. */
  const runNow = async (train: BuildWebTrain) => {
    const accepted = await confirm({
      title: translate('buildWeb.trains.runTitle', 'Depart «{{name}}» now?', { name: train.name }),
      description: translate(
        'buildWeb.trains.runBody',
        'The window builds what accumulated on {{branch}}, puts it on {{stand}} and moves the tasks that rode along. The schedule stays as it is.',
        { branch: train.branch, stand: train.stand_name }
      ),
      confirmLabel: translate('buildWeb.trains.run', 'Depart now')
    })
    if (!accepted) {
      return
    }
    setStarting(train.id)
    try {
      const result = await callBuildWeb(target, 'runTrain', { trainId: train.id })
      if (result.ok) {
        toast.success(
          translate('buildWeb.trains.departed', '«{{name}}» departed — the scan is under way.', {
            name: train.name
          })
        )
        setSelected(train.id)
        setReloadKey((k) => k + 1)
        void load()
      } else {
        toast.error(result.error)
      }
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setStarting(null)
    }
  }

  if (trains === null) {
    return error ? (
      <BuildWebListState kind="error" error={error} onRetry={() => void load()} />
    ) : (
      <BuildWebListState
        kind="loading"
        loadingLabel={translate('buildWeb.trains.loading', 'Loading trains…')}
      />
    )
  }
  const current = trains.find((t) => t.id === selected) ?? null
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-3 pb-4 md:px-5">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs text-muted-foreground">
          {translate(
            'buildWeb.trains.about',
            'On a schedule: build what fell behind, update the stand, move the tasks on to testing.'
          )}
        </p>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={translate('buildWeb.page.refresh', 'Refresh')}
          onClick={() => void load()}
        >
          <RefreshCw />
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="scrollbar-sleek shrink-0 overflow-x-auto rounded-md border border-border">
        <div className="min-w-[980px] text-sm">
          <div
            className={`${GRID} min-h-8 border-b border-border bg-muted/50 px-3 text-2xs font-semibold tracking-wide text-muted-foreground uppercase`}
          >
            <span>{translate('buildWeb.trains.name', 'Name')}</span>
            <span>{translate('buildWeb.trains.branch', 'Branch')}</span>
            <span>{translate('buildWeb.trains.stand', 'Stand')}</span>
            <span>{translate('buildWeb.trains.hours', 'Hours')}</span>
            <span>{translate('buildWeb.trains.lastWindow', 'Last window')}</span>
            <span>{translate('buildWeb.trains.lastRun', 'Last run')}</span>
            <span />
          </div>
          {trains.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={cn(
                GRID,
                'min-h-10 cursor-pointer border-b border-border/60 px-3 last:border-b-0 hover:bg-muted/40',
                t.id === selected && 'bg-accent',
                t.last_run?.status === 'failed' && 'bg-destructive/5',
                !t.enabled && 'opacity-55'
              )}
            >
              <button
                type="button"
                aria-pressed={t.id === selected}
                className="truncate text-left font-medium hover:underline"
                onClick={() => setSelected(t.id)}
              >
                {t.name}
              </button>
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-mono text-xs">{t.branch}</span>
                <BuildWebToneChip label={t.dist} tone={null} />
              </span>
              <span className="truncate text-xs">{t.stand_name}</span>
              <span className="truncate font-mono text-xs">{t.hours.join(', ') || '—'}</span>
              <span className="flex min-w-0 items-center gap-1.5 text-xs">
                <span className="truncate">{when(t.last_window)}</span>
                {t.window_due && t.enabled ? (
                  <span
                    title={translate('buildWeb.trains.dueHint', 'window {{at}} not taken yet', {
                      at: when(t.current_window)
                    })}
                  >
                    <BuildWebToneChip
                      label={translate('buildWeb.trains.due', 'window waits')}
                      tone="blue"
                    />
                  </span>
                ) : null}
              </span>
              <span
                className="flex min-w-0 items-center gap-1.5 text-xs"
                title={t.last_run?.error ?? undefined}
              >
                {t.last_run ? (
                  <>
                    <BuildWebToneChip
                      label={t.last_run.status}
                      tone={trainRunTone(t.last_run.status)}
                    />
                    <span
                      className={cn(
                        'truncate',
                        t.last_run.status === 'failed'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      )}
                    >
                      {t.last_run.error ?? when(t.last_run.window_at)}
                    </span>
                  </>
                ) : (
                  '—'
                )}
              </span>
              <span className="flex justify-end gap-0.5">
                <TrainIcon
                  label={translate('buildWeb.trains.preview', 'What boards now')}
                  onClick={() => setPreviewing(t)}
                >
                  <Eye />
                </TrainIcon>
                {canRun ? (
                  <TrainIcon
                    label={translate(
                      'buildWeb.trains.runHint',
                      'Depart now, without waiting for the scheduled hour'
                    )}
                    disabled={starting !== null}
                    onClick={() => void runNow(t)}
                  >
                    <Play />
                  </TrainIcon>
                ) : null}
              </span>
            </div>
          ))}
          {trains.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              {translate('buildWeb.trains.none', 'No trains yet')}
            </p>
          ) : null}
        </div>
      </div>
      {current ? (
        <TrainHistory
          target={target}
          train={current}
          reloadKey={reloadKey}
          onOpenIssue={openIssue}
        />
      ) : null}
      {previewing ? (
        <TrainPreviewDialog
          target={target}
          train={previewing}
          onClose={() => setPreviewing(null)}
        />
      ) : null}
    </div>
  )
}

/** build-web's build trains: read, and departed by hand. Their cards are edited in build-web. */
export default function BuildWebTrainsPage(): React.JSX.Element {
  const closePage = useAppStore((s) => s.closeBuildWebTrainsPage)
  const { target, contextKey } = useBuildWebTarget()
  const { refreshStatus } = useBuildWebStatus()
  const status = useBuildWebStore((s) => (s.contextKey === contextKey ? s.status : null))
  const error = useBuildWebStore((s) => s.error)
  const setStatus = useBuildWebStore((s) => s.setStatus)
  useBuildWebPageEscape(closePage)

  const connected = status?.connected === true
  return (
    <main className="relative flex h-full min-h-0 flex-1 flex-col bg-background pt-5 text-foreground md:pt-6">
      <header
        className="flex shrink-0 items-center gap-3 px-3 pb-3 md:px-5"
        // Why: no stacked titlebar on this page; keep the header clear of the window controls.
        style={{ paddingRight: 'max(0.75rem, var(--window-controls-width, 0px))' }}
      >
        <h1 className="truncate text-base leading-8 font-semibold">
          {translate('buildWeb.trains.title', 'Trains')}
        </h1>
        <div className="flex-1" />
        {connected ? (
          <span className="truncate text-xs text-muted-foreground">
            {status.login} · {status.baseUrl?.replace(/^https?:\/\//, '')}
          </span>
        ) : null}
      </header>
      {status === null ? (
        <BuildWebListState
          kind={error ? 'error' : 'loading'}
          error={error}
          onRetry={() => void refreshStatus()}
          loadingLabel={translate('buildWeb.trains.loading', 'Loading trains…')}
        />
      ) : !connected ? (
        <BuildWebConnect target={target} onConnected={(next) => setStatus(contextKey, next)} />
      ) : (
        <TrainsView target={target} canRun={status.perms.includes('trains')} />
      )}
      <BuildLogDialog target={target} />
    </main>
  )
}
