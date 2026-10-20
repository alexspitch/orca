import React, { useMemo, useState } from 'react'
import { AlertTriangle, MoreHorizontal, Play, RefreshCw, Square, Unplug } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type { DevServicesStatus } from '../../../../shared/dev-services-contract'
import { DevServicesSection } from './DevServicesSection'
import { DevServiceIconAction } from './DevServiceIconAction'
import {
  groupDevServices,
  isDevServiceRunning,
  runningDevServiceIds
} from './dev-services-sections'
import { devServicesActionKey, type DevServicesActions } from './use-dev-services-actions'
import type { DevServicesNotice } from './use-dev-services-status'

const NOTICE_CLASS: Record<DevServicesNotice['kind'], string> = {
  failed: 'border-destructive/40 text-destructive',
  unavailable: 'border-status-warning-border bg-status-warning-background text-foreground',
  unverifiable: 'border-border text-muted-foreground'
}

function Header({
  status,
  refreshing,
  onRefresh,
  actions
}: {
  status: DevServicesStatus | null
  refreshing: boolean
  onRefresh: () => void
  actions: DevServicesActions
}): React.JSX.Element {
  const anyRunning = status ? runningDevServiceIds(status).length > 0 : false
  const confirm = useConfirmationDialog()
  const slot = status?.worktree?.slot
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {translate('devServices.title', 'Services')}
        </span>
        {status?.worktree?.label && (
          <span className="truncate text-2xs tabular-nums text-muted-foreground">
            {status.worktree.label}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <DevServiceIconAction
          label={translate('devServices.refresh', 'Refresh Services')}
          icon={<RefreshCw className={cn('size-3', refreshing && 'animate-spin')} />}
          onClick={onRefresh}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={translate('devServices.more', 'More Services Actions')}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={!anyRunning}
              onSelect={() =>
                actions.run({
                  verb: 'stop',
                  args: ['--all'],
                  label: translate('devServices.stopAll', 'Stop All Services')
                })
              }
            >
              <Square />
              {translate('devServices.stopAll', 'Stop All Services')}
            </DropdownMenuItem>
            {typeof slot === 'number' && slot > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() =>
                    void confirm({
                      title: translate(
                        'devServices.releaseConfirm.title',
                        'Release slot {{value0}}?',
                        {
                          value0: slot
                        }
                      ),
                      description: translate(
                        'devServices.releaseConfirm.description',
                        "Stops every service of this worktree and frees its slot; the repository's command decides what else it cleans up."
                      ),
                      confirmLabel: translate('devServices.release', 'Release Slot'),
                      confirmVariant: 'destructive'
                    }).then((confirmed) => {
                      if (confirmed) {
                        actions.run({
                          verb: 'release',
                          args: [],
                          label: translate('devServices.release', 'Release Slot')
                        })
                      }
                    })
                  }
                >
                  <Unplug />
                  {translate('devServices.release', 'Release Slot')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function Notice({ notice }: { notice: DevServicesNotice }): React.JSX.Element {
  return (
    <div
      className={cn('mx-3 mt-2 rounded-md border px-2 py-1.5 text-2xs', NOTICE_CLASS[notice.kind])}
    >
      {notice.kind === 'unverifiable'
        ? translate(
            'devServices.notice.unverifiable',
            "Couldn't check the services — showing their last known state. {{value0}}",
            { value0: notice.message }
          )
        : notice.message}
    </div>
  )
}

function CommandRows({
  status,
  actions
}: {
  status: DevServicesStatus
  actions: DevServicesActions
}): React.JSX.Element | null {
  if (status.actions.length === 0 && status.problems.length === 0) {
    return null
  }
  return (
    <div className="flex flex-col gap-1.5 border-b border-border px-3 py-2">
      {status.problems.map((problem) => (
        <div
          key={problem.message}
          className="flex items-start gap-2 rounded-md border border-status-warning-border bg-status-warning-background px-2 py-1.5 text-2xs"
        >
          <AlertTriangle className="mt-0.5 size-3 shrink-0 text-status-warning" />
          <span className="min-w-0 flex-1 break-words">{problem.message}</span>
          {problem.action && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={actions.pending.has(
                devServicesActionKey(problem.action.verb, problem.action.args)
              )}
              onClick={() => problem.action && actions.run(problem.action)}
            >
              {problem.action.label}
            </Button>
          )}
        </div>
      ))}
      {status.actions.map((action) => (
        <div key={action.id} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="max-w-full"
              disabled={actions.pending.has(devServicesActionKey(action.verb, action.args))}
              onClick={() => actions.run(action)}
            >
              {action.tone === 'warning' && <AlertTriangle className="text-status-warning" />}
              <span className="truncate">{action.label}</span>
            </Button>
            {action.detail && (
              <div
                className={cn(
                  'mt-0.5 truncate text-2xs',
                  action.tone === 'warning' ? 'text-status-warning' : 'text-muted-foreground'
                )}
              >
                {action.detail}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptySlot({
  status,
  actions
}: {
  status: DevServicesStatus
  actions: DevServicesActions
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-6 text-center text-xs text-muted-foreground">
      <p>
        {translate(
          'devServices.empty',
          "Services haven't run in this worktree yet. Starting a profile reserves its ports."
        )}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {status.profiles.map((profile) => (
          <Button
            key={profile.id}
            type="button"
            variant="outline"
            size="xs"
            disabled={actions.pending.has(devServicesActionKey('start', [profile.id]))}
            onClick={() =>
              actions.run({
                verb: 'start',
                args: [profile.id],
                label: translate('devServices.profile.start', 'Start {{value0}}', {
                  value0: profile.title ?? profile.id
                })
              })
            }
          >
            <Play />
            {profile.title ?? profile.id}
          </Button>
        ))}
      </div>
    </div>
  )
}

/** The Services list itself, without the surface it sits in (a sidebar tab today). */
export function DevServicesBody({
  status,
  notice,
  refreshing,
  onRefresh,
  actions
}: {
  status: DevServicesStatus | null
  notice: DevServicesNotice | null
  refreshing: boolean
  onRefresh: () => void
  actions: DevServicesActions
}): React.JSX.Element {
  const groups = useMemo(() => (status ? groupDevServices(status) : null), [status])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const isCollapsed = (id: string, runningInside: boolean): boolean =>
    !(expanded[id] ?? runningInside)
  const toggle = (id: string, runningInside: boolean): void =>
    setExpanded((prev) => ({ ...prev, [id]: !(prev[id] ?? runningInside) }))
  const neverStarted = status?.worktree?.slot === null && !status.services.some(isDevServiceRunning)

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-sleek">
      <Header status={status} refreshing={refreshing} onRefresh={onRefresh} actions={actions} />
      {notice && <Notice notice={notice} />}
      {!status && !notice && (
        <div className="px-3 py-4 text-xs text-muted-foreground">
          {translate('devServices.loading', 'Checking services…')}
        </div>
      )}
      {status?.supported === false && (
        <div className="px-3 py-4 text-xs text-muted-foreground">
          {translate('devServices.unsupported', 'Services are not supported on this host.')}
        </div>
      )}
      {status && status.supported !== false && (
        <>
          <CommandRows status={status} actions={actions} />
          {neverStarted ? (
            <EmptySlot status={status} actions={actions} />
          ) : (
            groups?.profiles.map(({ profile, services }) => (
              <DevServicesSection
                key={profile.id}
                id={`profile-${profile.id}`}
                title={profile.title ?? profile.id}
                count={`${profile.ready}/${profile.total}`}
                collapsed={isCollapsed(profile.id, profile.running > 0)}
                onToggle={() => toggle(profile.id, profile.running > 0)}
                profile={profile}
                services={services}
                actions={actions}
              />
            ))
          )}
          {groups && groups.other.length > 0 && (
            <DevServicesSection
              id="other-services"
              title={translate('devServices.otherServices', 'Other Services')}
              collapsed={isCollapsed('other-services', groups.other.some(isDevServiceRunning))}
              onToggle={() => toggle('other-services', groups.other.some(isDevServiceRunning))}
              services={groups.other}
              actions={actions}
            />
          )}
          {status.others.length > 0 && (
            <div className="px-3 pt-2 pb-3">
              <button
                type="button"
                className="flex w-full items-center gap-1 border-b border-border/40 py-1 text-left text-3xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                aria-expanded={!isCollapsed('other-worktrees', false)}
                onClick={() => toggle('other-worktrees', false)}
              >
                {translate('devServices.otherWorktrees', 'Other Worktrees')}
                <span className="ml-1 font-normal tabular-nums text-muted-foreground/60">
                  {status.others.length}
                </span>
              </button>
              {!isCollapsed('other-worktrees', false) &&
                status.others.map((other) => (
                  <div
                    key={other.path}
                    className="flex items-baseline gap-2 py-1 text-xs"
                    title={other.path}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{other.name}</span>
                    <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
                      {translate(
                        'devServices.otherWorktreeSummary',
                        'slot {{value0}} · {{value1}} running',
                        {
                          value0: other.slot ?? '—',
                          value1: other.running
                        }
                      )}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
