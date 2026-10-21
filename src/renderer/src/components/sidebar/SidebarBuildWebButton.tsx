import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ListTodo } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { HideSidebarMenu } from './sidebar-nav-controls'
import { issueSummaryQueryOf, useBuildWebStore } from '../build-web/build-web-store'
import { callBuildWeb } from '../build-web/build-web-client'
import { useBuildWebBadge, type BuildWebBadge } from './use-build-web-badge'
import { SidebarCountBadge } from './SidebarCountBadge'
import { blockerFilterNames } from './sidebar-blocker-filters'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'

/** The search as typed a moment ago: the badge asks the console once typing pauses, as the list does. */
function useSettledQuery(query: string): string {
  const [settled, setSettled] = useState(query)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(query), 300)
    return () => window.clearTimeout(timer)
  }, [query])
  return settled
}

/** «Issues»: build-web's tasks and images. Hidden with the sidebar menu, shown again from Settings. */
export function SidebarBuildWebButton(): React.JSX.Element | null {
  const show = useAppStore((s) => s.settings?.showBuildWebButton === true)
  const active = useAppStore((s) => s.activeView === 'build-web')
  const openPage = useAppStore((s) => s.openBuildWebPage)
  const updateSettings = useAppStore((s) => s.updateSettings)
  // Why the list's filters and search: the number is the open blockers among the tasks the Issues
  // page shows.
  const quick = useBuildWebStore((s) => s.quick)
  const statuses = useBuildWebStore((s) => s.statuses)
  const product = useBuildWebStore((s) => s.product)
  const query = useSettledQuery(useBuildWebStore((s) => s.query))
  const filters = useMemo(
    () => issueSummaryQueryOf({ quick, statuses, product, query }),
    [product, query, quick, statuses]
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
            <SidebarCountBadge
              count={blockers.capped ? `${blockers.count}+` : blockers.count}
              tone="red"
              hint={
                <BlockersHint
                  count={blockers.count}
                  capped={blockers.capped}
                  filters={blockerFilterNames({ quick, statuses, product, query })}
                />
              }
            />
          ) : null}
        </button>
      </ContextMenuTrigger>
      <HideSidebarMenu onHide={() => void updateSettings({ showBuildWebButton: false })} />
    </ContextMenu>
  )
}

function BlockersHint({
  count,
  capped,
  filters
}: {
  count: number
  capped: boolean
  filters: string[]
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span>
        {translate(
          'buildWeb.sidebar.blockersHint',
          'Blockers: open tasks at the highest priority (Jira Highest, Blocker, Critical), within the Issues filters'
        )}
      </span>
      <span>
        {filters.length
          ? translate('buildWeb.sidebar.blockersFilters', 'Filters: {{filters}}', {
              filters: filters.join(' · ')
            })
          : translate('buildWeb.sidebar.blockersAll', 'No filter: every open task')}
      </span>
      {capped ? (
        <span>
          {translate(
            'buildWeb.sidebar.blockersCapped',
            'At least {{count}}: only the {{count}} highest-priority tasks are read',
            { count }
          )}
        </span>
      ) : null}
    </div>
  )
}
