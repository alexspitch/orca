import React from 'react'
import { TrainFront } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { HideSidebarMenu } from './sidebar-nav-controls'

/** «Trains»: build-web's build trains. Hidden with the sidebar menu, shown again from Settings. */
export function SidebarBuildWebTrainsButton(): React.JSX.Element | null {
  const show = useAppStore((s) => s.settings?.showBuildWebTrainsButton === true)
  const active = useAppStore((s) => s.activeView === 'build-web-trains')
  const openPage = useAppStore((s) => s.openBuildWebTrainsPage)
  const updateSettings = useAppStore((s) => s.updateSettings)
  if (!show) {
    return null
  }
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={openPage}
          aria-current={active ? 'page' : undefined}
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
          <span className="flex-1">{translate('buildWeb.sidebar.trains', 'Trains')}</span>
        </button>
      </ContextMenuTrigger>
      <HideSidebarMenu onHide={() => void updateSettings({ showBuildWebTrainsButton: false })} />
    </ContextMenu>
  )
}
