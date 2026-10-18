import React from 'react'
import { Package } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { callBuildWeb } from '../build-web/build-web-client'
import { HideSidebarMenu } from './sidebar-nav-controls'
import { useBuildWebBadge, type BuildWebBadge } from './use-build-web-badge'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'

const readRunning = (target: RuntimeClientTarget): Promise<BuildWebBadge> =>
  callBuildWeb(target, 'imageSummary').then((summary) => ({
    count: summary.running,
    capped: false
  }))

/** «Images»: build-web's images, with how many are building right now. */
export function SidebarBuildWebImagesButton(): React.JSX.Element | null {
  const show = useAppStore((s) => s.settings?.showBuildWebImagesButton === true)
  const active = useAppStore((s) => s.activeView === 'build-web-images')
  const openPage = useAppStore((s) => s.openBuildWebImagesPage)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const running = useBuildWebBadge(show, readRunning)?.count ?? null
  if (!show) {
    return null
  }
  const label = translate('buildWeb.sidebar.images', 'Images')
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={openPage}
          aria-current={active ? 'page' : undefined}
          aria-label={
            running
              ? translate('buildWeb.sidebar.imagesBuilding', '{{label}}, {{count}} building', {
                  label,
                  count: running
                })
              : label
          }
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
            active
              ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
              : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
          )}
        >
          <Package
            className={cn('size-4 shrink-0', !active && 'text-worktree-sidebar-foreground/30')}
            strokeWidth={active ? 2.25 : 1.75}
          />
          <span className="flex-1">{label}</span>
          {running ? (
            <span
              aria-hidden="true"
              className="min-w-5 rounded-full bg-worktree-sidebar-foreground/10 px-1.5 text-center text-2xs leading-5 tabular-nums"
            >
              {running}
            </span>
          ) : null}
        </button>
      </ContextMenuTrigger>
      <HideSidebarMenu onHide={() => void updateSettings({ showBuildWebImagesButton: false })} />
    </ContextMenu>
  )
}
