import React, { useCallback, useMemo } from 'react'
import { ListTodo } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { HideSidebarMenu } from './sidebar-nav-controls'
import { issueSummaryQueryOf, useBuildWebStore } from '../build-web/build-web-store'
import { callBuildWeb } from '../build-web/build-web-client'
import { useBuildWebBadge, type BuildWebBadge } from './use-build-web-badge'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'

/** «Issues»: build-web's tasks and images. Hidden with the sidebar menu, shown again from Settings. */
export function SidebarBuildWebButton(): React.JSX.Element | null {
  const show = useAppStore((s) => s.settings?.showBuildWebButton === true)
  const active = useAppStore((s) => s.activeView === 'build-web')
  const openPage = useAppStore((s) => s.openBuildWebPage)
  const updateSettings = useAppStore((s) => s.updateSettings)
  // Why the list's filters: the number is the blockers among the tasks the Issues page shows.
  const quick = useBuildWebStore((s) => s.quick)
  const statuses = useBuildWebStore((s) => s.statuses)
  const product = useBuildWebStore((s) => s.product)
  const filters = useMemo(
    () => issueSummaryQueryOf({ quick, statuses, product }),
    [product, quick, statuses]
  )
  const readBlockers = useCallback(
    (target: RuntimeClientTarget): Promise<BuildWebBadge> =>
      callBuildWeb(target, 'issueSummary', filters).then((summary) => ({
        count: summary.blockers,
        capped: summary.capped
      })),
    [filters]
  )
  const blockers = useBuildWebBadge(show, readBlockers)
  if (!show) {
    return null
  }
  const label = translate('buildWeb.sidebar.issues', 'Issues')
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={() => {
            // Why: the sidebar item means the list — even from a card already open on the page.
            useBuildWebStore.getState().openIssue(null)
            openPage()
          }}
          aria-current={active ? 'page' : undefined}
          aria-label={
            blockers?.count
              ? translate('buildWeb.sidebar.issuesBlockers', '{{label}}, {{shown}} blockers', {
                  label,
                  shown: blockers.capped ? `${blockers.count}+` : String(blockers.count)
                })
              : label
          }
          title={
            blockers?.count
              ? translate(
                  'buildWeb.sidebar.blockersHint',
                  'Tasks at the highest priority (Jira Highest, Blocker, Critical) among those the Issues filters show'
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
          <ListTodo
            className={cn('size-4 shrink-0', !active && 'text-worktree-sidebar-foreground/30')}
            strokeWidth={active ? 2.25 : 1.75}
          />
          <span className="flex-1">{label}</span>
          {blockers?.count ? (
            <span
              aria-hidden="true"
              className="min-w-5 rounded-full bg-chip-tone-red/15 px-1.5 text-center text-2xs leading-5 text-chip-tone-red tabular-nums"
            >
              {blockers.capped ? `${blockers.count}+` : blockers.count}
            </span>
          ) : null}
        </button>
      </ContextMenuTrigger>
      <HideSidebarMenu onHide={() => void updateSettings({ showBuildWebButton: false })} />
    </ContextMenu>
  )
}
