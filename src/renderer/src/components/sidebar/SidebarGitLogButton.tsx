import React from 'react'
import { GitBranch } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { HideSidebarMenu } from './sidebar-nav-controls'
import { showsGitLogButton } from '../../../../shared/git-log-settings'

/** «Git»: a project's log across all branches. Hidden with the sidebar menu, shown again from Settings › Git. */
export function SidebarGitLogButton(): React.JSX.Element | null {
  const show = useAppStore((s) => showsGitLogButton(s.settings))
  const active = useAppStore((s) => s.activeView === 'git-log')
  const openPage = useAppStore((s) => s.openGitLogPage)
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
          <GitBranch
            className={cn('size-4 shrink-0', !active && 'text-worktree-sidebar-foreground/30')}
            strokeWidth={active ? 2.25 : 1.75}
          />
          <span className="flex-1">{translate('gitLog.sidebar.label', 'Git')}</span>
        </button>
      </ContextMenuTrigger>
      <HideSidebarMenu onHide={() => void updateSettings({ showGitLogButton: false })} />
    </ContextMenu>
  )
}
