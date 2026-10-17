import { useEffect, useState } from 'react'
import { MoreHorizontal, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import { callBuildWeb } from './build-web-client'
import { useBuildWebStore } from './build-web-store'
import { useBuildWebIssueList, useBuildWebStatus, useBuildWebTarget } from './use-build-web-data'
import { BuildWebConnect } from './BuildWebConnect'
import { BuildWebFilters } from './BuildWebFilters'
import { BuildWebIssueList } from './BuildWebIssueList'
import { BuildWebListState } from './BuildWebListState'

/** Defers the visible spinner so a fast local answer never flashes one (STYLEGUIDE, UX rule 1). */
function useDeferred(active: boolean, delayMs = 200): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!active) {
      setShown(false)
      return
    }
    const timer = window.setTimeout(() => setShown(true), delayMs)
    return () => window.clearTimeout(timer)
  }, [active, delayMs])
  return shown
}

export default function BuildWebPage(): React.JSX.Element {
  const closePage = useAppStore((s) => s.closeBuildWebPage)
  const { target, contextKey } = useBuildWebTarget()
  const { refreshStatus } = useBuildWebStatus()
  const { reload } = useBuildWebIssueList()
  const status = useBuildWebStore((s) => (s.contextKey === contextKey ? s.status : null))
  const loading = useBuildWebStore((s) => s.loading)
  const issues = useBuildWebStore((s) => s.issues)
  const error = useBuildWebStore((s) => s.error)
  const setStatus = useBuildWebStore((s) => s.setStatus)
  const patchIssue = useBuildWebStore((s) => s.patchIssue)
  const openIssue = useBuildWebStore((s) => s.openIssue)
  const spinning = useDeferred(loading)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target
      if (event.key !== 'Escape' || event.defaultPrevented || !(target instanceof HTMLElement)) {
        return
      }
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) {
        return
      }
      event.preventDefault()
      if (useBuildWebStore.getState().openIssueId) {
        openIssue(null)
        return
      }
      closePage()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closePage, openIssue])

  const toggleFavorite = async (issue: BuildWebIssueRow): Promise<void> => {
    const on = !issue.favorite
    patchIssue(issue.id, { favorite: on })
    const result = await callBuildWeb(target, 'setFavorite', { id: issue.id, on }).catch(
      (failure) => ({
        ok: false as const,
        error: failure instanceof Error ? failure.message : String(failure)
      })
    )
    if (!result.ok) {
      patchIssue(issue.id, { favorite: !on })
      toast.error(result.error)
    }
  }

  const disconnect = async (): Promise<void> => {
    setStatus(contextKey, await callBuildWeb(target, 'disconnect'))
  }

  const connected = status?.connected === true
  return (
    <main className="relative flex h-full min-h-0 flex-1 flex-col bg-background pt-5 text-foreground md:pt-6">
      <header
        className="flex shrink-0 flex-wrap items-center gap-3 px-3 pb-3 md:px-5"
        // Why: no stacked titlebar on this page; keep the header clear of the window controls.
        style={{ paddingRight: 'max(0.75rem, var(--window-controls-width, 0px))' }}
      >
        <h1 className="truncate text-base leading-8 font-semibold">
          {translate('buildWeb.page.title', 'Issues')}
        </h1>
        <div className="flex-1" />
        {connected ? (
          <>
            <span className="truncate text-xs text-muted-foreground">
              {status.login} · {status.baseUrl?.replace(/^https?:\/\//, '')}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={reload}
                  disabled={loading}
                  aria-label={translate('buildWeb.page.refresh', 'Refresh')}
                >
                  <RefreshCw className={cn(spinning && 'animate-spin')} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{translate('buildWeb.page.refresh', 'Refresh')}</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={translate('buildWeb.page.more', 'More')}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void refreshStatus()}>
                  {translate('buildWeb.page.recheck', 'Check connection')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void disconnect()}>
                  {translate('buildWeb.page.disconnect', 'Disconnect')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
      </header>
      {status === null ? (
        <BuildWebListState
          kind={error ? 'error' : 'loading'}
          error={error}
          onRetry={() => void refreshStatus()}
        />
      ) : !connected ? (
        <BuildWebConnect target={target} onConnected={(next) => setStatus(contextKey, next)} />
      ) : (
        <>
          <BuildWebFilters />
          {error ? (
            <BuildWebListState kind="error" error={error} onRetry={reload} />
          ) : issues.length === 0 ? (
            <BuildWebListState kind={loading ? 'loading' : 'empty'} />
          ) : (
            <BuildWebIssueList onFavorite={(issue) => void toggleFavorite(issue)} />
          )}
        </>
      )}
    </main>
  )
}
