import React from 'react'
import { Package } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { callBuildWeb } from '../build-web/build-web-client'
import { HideSidebarMenu } from './sidebar-nav-controls'
import { useBuildWebBadge } from './use-build-web-badge'
import { SidebarCountBadge } from './SidebarCountBadge'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import type { BuildWebImageSummary } from '../../../../shared/build-web-image-types'

const readSummary = (target: RuntimeClientTarget): Promise<BuildWebImageSummary> =>
  callBuildWeb(target, 'imageSummary')
// Why shorter than other items: builds start and end within minutes, and the console answers this cheaply.
const SUMMARY_POLL_MS = 15_000

/** «Images»: build-web's images, with how many are building now and how many failed last. */
export function SidebarBuildWebImagesButton(): React.JSX.Element | null {
  const show = useAppStore((s) => s.settings?.showBuildWebImagesButton === true)
  const active = useAppStore((s) => s.activeView === 'build-web-images')
  const openPage = useAppStore((s) => s.openBuildWebImagesPage)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const summary = useBuildWebBadge(show, readSummary, SUMMARY_POLL_MS)
  if (!show) {
    return null
  }
  const running = summary?.running ?? 0
  const failed = summary?.failed ?? 0
  const label = translate('buildWeb.sidebar.images', 'Images')
  const building = running
    ? translate('buildWeb.sidebar.imagesBuilding', '{{label}}, {{count}} building', {
        label,
        count: running
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
            failed
              ? translate('buildWeb.sidebar.imagesFailed', '{{label}}, {{count}} failed', {
                  label: building,
                  count: failed
                })
              : building
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
            <SidebarCountBadge
              count={running}
              tone="neutral"
              hint={translate(
                'buildWeb.sidebar.imagesBuildingHint',
                'Images building now, each image and distribution once'
              )}
            />
          ) : null}
          {failed ? (
            <SidebarCountBadge
              count={failed}
              tone="red"
              hint={translate(
                'buildWeb.sidebar.imagesFailedHint',
                'Images whose last build failed, as the Images page counts them'
              )}
            />
          ) : null}
        </button>
      </ContextMenuTrigger>
      <HideSidebarMenu onHide={() => void updateSettings({ showBuildWebImagesButton: false })} />
    </ContextMenu>
  )
}
