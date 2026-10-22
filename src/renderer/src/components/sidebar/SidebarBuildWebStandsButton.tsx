import React, { useCallback } from 'react'
import { Server } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { HideSidebarMenu } from './sidebar-nav-controls'
import { useBuildWebBadge } from './use-build-web-badge'
import { SidebarCountBadge } from './SidebarCountBadge'
import { readStandHealth, standHealthTotals } from '../build-web/stands/stand-health'
import { useStandGroups } from '../build-web/stands/stand-groups-store'
import { StandUpdatesList } from '../build-web/stands/StandUpdatesList'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { showsBuildWebStands } from '../../../../shared/sidebar-button-settings'

/** «Stands»: build-web's stands, with the running ones' failing services and those to update. */
export function SidebarBuildWebStandsButton(): React.JSX.Element | null {
  const show = useAppStore((s) => showsBuildWebStands(s.settings))
  const active = useAppStore((s) => s.activeView === 'build-web-stands')
  const openPage = useAppStore((s) => s.openBuildWebStandsPage)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const hidden = useStandGroups((s) => s.hiddenKeys)
  // Why hidden in the read: a stand hidden on the page drops out of the count at once.
  const read = useCallback(
    (target: RuntimeClientTarget) => readStandHealth(target, { hidden }),
    [hidden]
  )
  const health = useBuildWebBadge(show, read)
  if (!show) {
    return null
  }
  const { failing, outdated, updates } = standHealthTotals(health)
  const label = translate('buildWeb.sidebar.stands', 'Stands')
  const withFailing = failing
    ? translate('buildWeb.sidebar.standsFailing', '{{label}}, {{count}} services failing', {
        label,
        count: failing
      })
    : label
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={openPage}
          aria-current={active ? 'page' : undefined}
          aria-label={
            outdated
              ? translate('buildWeb.sidebar.standsOutdated', '{{label}}, {{count}} to update', {
                  label: withFailing,
                  count: outdated
                })
              : withFailing
          }
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
            active
              ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
              : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
          )}
        >
          <Server
            className={cn('size-4 shrink-0', !active && 'text-worktree-sidebar-foreground/30')}
            strokeWidth={active ? 2.25 : 1.75}
          />
          <span className="flex-1">{label}</span>
          {outdated ? (
            <SidebarCountBadge
              count={outdated}
              tone="amber"
              wideHint
              hint={
                <div className="flex flex-col gap-2">
                  <span>
                    {translate(
                      'buildWeb.sidebar.standsOutdatedHint',
                      'Services on running stands with a newer image to roll out'
                    )}
                  </span>
                  {updates.map((u) => (
                    <StandUpdatesList key={u.instance} title={u.stands} updates={u.updates} />
                  ))}
                </div>
              }
            />
          ) : null}
          {failing ? (
            <SidebarCountBadge
              count={failing}
              tone="red"
              hint={translate(
                'buildWeb.sidebar.standsFailingHint',
                'Services on running stands that are down or unhealthy'
              )}
            />
          ) : null}
        </button>
      </ContextMenuTrigger>
      <HideSidebarMenu onHide={() => void updateSettings({ showBuildWebStandsButton: false })} />
    </ContextMenu>
  )
}
