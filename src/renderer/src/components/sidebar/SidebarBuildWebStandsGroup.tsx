import { useEffect } from 'react'
import { ChevronRight, Lock, Server } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { HideSidebarMenu } from './sidebar-nav-controls'
import { useBuildWebTarget } from '../build-web/use-build-web-data'
import { useStandGroups } from '../build-web/stands/stand-groups-store'
import { showsBuildWebStands } from '../../../../shared/sidebar-button-settings'

/** «Stands»: build-web's stands, folded under one item; a stand opens on the Stands page. */
export function SidebarBuildWebStandsGroup(): React.JSX.Element | null {
  const show = useAppStore((s) => showsBuildWebStands(s.settings))
  const onPage = useAppStore((s) => s.activeView === 'build-web-stands')
  const openPage = useAppStore((s) => s.openBuildWebStandsPage)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const { target, contextKey } = useBuildWebTarget()
  const expanded = useStandGroups((s) => s.expanded)
  const setExpanded = useStandGroups((s) => s.setExpanded)
  const groups = useStandGroups((s) => (s.contextKey === contextKey ? s.groups : null))
  const error = useStandGroups((s) => (s.contextKey === contextKey ? s.error : null))
  const selectedKey = useStandGroups((s) => s.selectedKey)
  const select = useStandGroups((s) => s.select)
  const load = useStandGroups((s) => s.load)
  useEffect(() => {
    if (show && expanded) {
      void load(target, contextKey)
    }
  }, [contextKey, expanded, load, show, target])
  if (!show) {
    return null
  }
  const headerActive = onPage && !groups?.some((g) => g.key === selectedKey)
  const toggleLabel = expanded
    ? translate('buildWeb.sidebar.hideStands', 'Hide stands')
    : translate('buildWeb.sidebar.showStands', 'Show stands')
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              'flex w-full items-center rounded-md transition-colors',
              headerActive
                ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
                : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
            )}
          >
            <button
              type="button"
              onClick={() => {
                select(null)
                setExpanded(true)
                openPage()
              }}
              aria-current={headerActive ? 'page' : undefined}
              className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-[13px] font-medium tracking-tight"
            >
              <Server
                className={cn(
                  'size-4 shrink-0',
                  !headerActive && 'text-worktree-sidebar-foreground/30'
                )}
                strokeWidth={headerActive ? 2.25 : 1.75}
              />
              <span className="flex-1">{translate('buildWeb.sidebar.stands', 'Stands')}</span>
            </button>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                aria-label={toggleLabel}
                title={toggleLabel}
                className="mr-1 flex size-6 shrink-0 items-center justify-center rounded-sm hover:bg-worktree-sidebar-foreground/8"
              >
                <ChevronRight
                  className={cn(
                    'size-3.5 transition-transform motion-reduce:transition-none',
                    expanded && 'rotate-90'
                  )}
                />
              </button>
            </CollapsibleTrigger>
          </div>
        </ContextMenuTrigger>
        <HideSidebarMenu onHide={() => void updateSettings({ showBuildWebStandsButton: false })} />
      </ContextMenu>
      <CollapsibleContent animation="height">
        <ul className="flex flex-col gap-px py-0.5">
          {groups === null ? (
            <li
              className="truncate py-1 pr-2 pl-8 text-xs text-worktree-sidebar-foreground/45"
              title={error ?? undefined}
            >
              {error ?? translate('buildWeb.sidebar.standsLoading', 'Loading…')}
            </li>
          ) : groups.length === 0 ? (
            <li className="py-1 pr-2 pl-8 text-xs text-worktree-sidebar-foreground/45">
              {translate('buildWeb.sidebar.noStands', 'No stands')}
            </li>
          ) : (
            groups.map((group) => {
              const active = onPage && group.key === selectedKey
              return (
                <li key={group.key}>
                  <button
                    type="button"
                    onClick={() => {
                      select(group.key)
                      openPage()
                    }}
                    aria-current={active ? 'page' : undefined}
                    title={`${group.sshHost}:${group.dir}${group.branch ? ` · ${group.branch}` : ''}`}
                    className={cn(
                      'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 pl-8 text-left text-xs transition-colors',
                      active
                        ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
                        : group.enabled
                          ? 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
                          : 'text-worktree-sidebar-foreground/35 hover:bg-worktree-sidebar-foreground/8'
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{group.name}</span>
                    {group.lock ? <Lock className="size-3 shrink-0" /> : null}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
