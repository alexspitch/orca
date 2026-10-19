import React from 'react'
import { FlaskConical } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { callBuildWeb } from '../build-web/build-web-client'
import { HideSidebarMenu } from './sidebar-nav-controls'
import { useBuildWebBadge } from './use-build-web-badge'
import { showsBuildWebTesting } from '../../../../shared/sidebar-button-settings'
import type { BuildWebLastNightly } from '../../../../shared/build-web-test-history-types'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'

const readLastNightly = (target: RuntimeClientTarget): Promise<BuildWebLastNightly | null> =>
  callBuildWeb(target, 'testNightly')

/**
 * «Testing»: build-web's watch and test history, with the failed tests of the last nightly run of
 * master in red. Shown again from Settings.
 */
export function SidebarBuildWebTestingButton(): React.JSX.Element | null {
  const show = useAppStore((s) => showsBuildWebTesting(s.settings))
  const active = useAppStore((s) => s.activeView === 'build-web-testing')
  const openPage = useAppStore((s) => s.openBuildWebTestingPage)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const nightly = useBuildWebBadge(show, readLastNightly)
  if (!show) {
    return null
  }
  const failed = nightly?.failed ?? 0
  const label = translate('buildWeb.sidebar.testing', 'Testing')
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={openPage}
          aria-current={active ? 'page' : undefined}
          aria-label={
            failed
              ? translate('buildWeb.sidebar.testingFailed', '{{label}}, {{count}} failed', {
                  label,
                  count: failed
                })
              : label
          }
          title={
            failed
              ? translate(
                  'buildWeb.sidebar.testingFailedHint',
                  'Tests that failed in the last nightly run of master'
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
          <FlaskConical
            className={cn('size-4 shrink-0', !active && 'text-worktree-sidebar-foreground/30')}
            strokeWidth={active ? 2.25 : 1.75}
          />
          <span className="flex-1">{label}</span>
          {failed ? (
            <span
              aria-hidden="true"
              className="min-w-5 rounded-full bg-chip-tone-red/15 px-1.5 text-center text-2xs leading-5 text-chip-tone-red tabular-nums"
            >
              {failed}
            </span>
          ) : null}
        </button>
      </ContextMenuTrigger>
      <HideSidebarMenu onHide={() => void updateSettings({ showBuildWebTestingButton: false })} />
    </ContextMenu>
  )
}
