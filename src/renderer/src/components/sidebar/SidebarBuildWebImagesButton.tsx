import React, { useEffect, useState } from 'react'
import { Package } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { callBuildWeb } from '../build-web/build-web-client'
import { useBuildWebTarget } from '../build-web/use-build-web-data'
import { HideSidebarMenu } from './sidebar-nav-controls'

const POLL_MS = 60_000
// Why: not connected, no access or a locked token will not fix itself within a minute.
const FAILED_POLL_MS = 5 * 60_000

/** Images building right now in build-web, or null when unknown (not connected, no access). */
function useRunningImageCount(enabled: boolean): number | null {
  const { target } = useBuildWebTarget()
  const [running, setRunning] = useState<number | null>(null)
  useEffect(() => {
    if (!enabled) {
      setRunning(null)
      return
    }
    let alive = true
    let timer = 0
    const read = async (): Promise<void> => {
      let delay = POLL_MS
      // Why: a hidden window has nobody to show the count to; skip the console round-trip.
      if (document.visibilityState !== 'hidden') {
        try {
          const summary = await callBuildWeb(target, 'imageSummary')
          if (alive) {
            setRunning(summary.running)
          }
        } catch {
          delay = FAILED_POLL_MS
          if (alive) {
            setRunning(null)
          }
        }
      }
      if (alive) {
        timer = window.setTimeout(() => void read(), delay)
      }
    }
    void read()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [enabled, target])
  return running
}

/** «Images»: build-web's images, with how many are building right now. */
export function SidebarBuildWebImagesButton(): React.JSX.Element | null {
  const show = useAppStore((s) => s.settings?.showBuildWebImagesButton === true)
  const active = useAppStore((s) => s.activeView === 'build-web-images')
  const openPage = useAppStore((s) => s.openBuildWebImagesPage)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const running = useRunningImageCount(show)
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
