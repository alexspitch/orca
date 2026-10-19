import React from 'react'
import { TrainFront } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { callBuildWeb } from '../build-web/build-web-client'
import { HideSidebarMenu } from './sidebar-nav-controls'
import { useBuildWebBadge } from './use-build-web-badge'
import { showsBuildWebTrains } from '../../../../shared/sidebar-button-settings'
import type { BuildWebTrainsRolling } from '../../../../shared/build-web-train-types'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'

const readRolling = (target: RuntimeClientTarget): Promise<BuildWebTrainsRolling> =>
  callBuildWeb(target, 'trainsRolling')

/**
 * «Trains»: build-web's build trains, with how many images they are rolling out now. Hidden with
 * the sidebar menu, shown again from Settings.
 */
export function SidebarBuildWebTrainsButton(): React.JSX.Element | null {
  const show = useAppStore((s) => showsBuildWebTrains(s.settings))
  const active = useAppStore((s) => s.activeView === 'build-web-trains')
  const openPage = useAppStore((s) => s.openBuildWebTrainsPage)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const rolling = useBuildWebBadge(show, readRolling)
  if (!show) {
    return null
  }
  const images = rolling?.images ?? 0
  const label = translate('buildWeb.sidebar.trains', 'Trains')
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={openPage}
          aria-current={active ? 'page' : undefined}
          aria-label={
            images
              ? translate('buildWeb.sidebar.trainsRolling', '{{label}}, {{count}} rolling out', {
                  label,
                  count: images
                })
              : label
          }
          title={
            images
              ? translate(
                  'buildWeb.sidebar.trainsRollingHint',
                  'Images on their way to a stand in {{trains}} train(s)',
                  { trains: rolling?.trains ?? 0 }
                )
              : undefined
          }
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
            active
              ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
              : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
          )}
        >
          <TrainFront
            className={cn('size-4 shrink-0', !active && 'text-worktree-sidebar-foreground/30')}
            strokeWidth={active ? 2.25 : 1.75}
          />
          <span className="flex-1">{label}</span>
          {images ? (
            <span
              aria-hidden="true"
              className="min-w-5 rounded-full bg-worktree-sidebar-foreground/10 px-1.5 text-center text-2xs leading-5 tabular-nums"
            >
              {images}
            </span>
          ) : null}
        </button>
      </ContextMenuTrigger>
      <HideSidebarMenu onHide={() => void updateSettings({ showBuildWebTrainsButton: false })} />
    </ContextMenu>
  )
}
