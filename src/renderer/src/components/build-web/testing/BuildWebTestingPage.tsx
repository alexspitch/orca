import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebWatchState,
  BuildWebWatchTick
} from '../../../../../shared/build-web-watch-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { useBuildWebStore, type BuildWebCardTab } from '../build-web-store'
import { useBuildWebStatus, useBuildWebTarget } from '../use-build-web-data'
import { useBuildWebPageEscape } from '../use-build-web-page-escape'
import { BuildWebConnect } from '../BuildWebConnect'
import { BuildWebListState } from '../BuildWebListState'
import { TestingTable } from './TestingTable'

const message = (failure: unknown) => (failure instanceof Error ? failure.message : String(failure))

function checkNote(result: BuildWebWatchTick): string {
  if (result.busy) {
    return translate(
      'buildWeb.testing.busy',
      'A check was already running — try again in a moment.'
    )
  }
  const { checked, transitions, images, builds } = result
  const note = translate(
    'buildWeb.testing.checkResult',
    'Checked {{checked}} ticket(s): {{transitions}} status change(s), {{images}} image(s) queued for push.',
    { checked, transitions, images }
  )
  if (builds === 0) {
    return note
  }
  const first = translate(
    'buildWeb.testing.checkedBuilds',
    '{{builds}} of them to be built first.',
    { builds }
  )
  return `${note} ${first}`
}

/** The watch, after build-web's WatchView: what is left, a pass on demand, and the task behind a row. */
function TestingView({ target }: { target: RuntimeClientTarget }): React.JSX.Element {
  const [state, setState] = useState<BuildWebWatchState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setState(await callBuildWeb(target, 'watch'))
      setError(null)
    } catch (failure) {
      setError(message(failure))
    }
  }, [target])
  useEffect(() => {
    void load()
  }, [load])

  const checkNow = async () => {
    setChecking(true)
    setError(null)
    setNote(null)
    try {
      const result = await callBuildWeb(target, 'watchCheck')
      if (result.ok) {
        setState(result.value)
        setNote(checkNote(result.value.result))
      } else {
        setError(result.error)
      }
    } catch (failure) {
      setError(message(failure))
    } finally {
      setChecking(false)
    }
  }

  const openTask = (issueId: string, tab: BuildWebCardTab) => {
    useBuildWebStore.getState().openIssue(issueId, tab !== 'overview', tab)
    useAppStore.getState().openBuildWebPage()
  }

  if (state === null) {
    return error ? (
      <BuildWebListState kind="error" error={error} onRetry={() => void load()} />
    ) : (
      <BuildWebListState
        kind="loading"
        loadingLabel={translate('buildWeb.testing.loading', 'Loading the watch…')}
      />
    )
  }
  const watching = state.from_statuses.join(' / ')
  const done = state.to_statuses.join(' / ') || 'Done'
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-4 md:px-5">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs text-muted-foreground">
          {translate(
            'buildWeb.testing.about',
            'Watching {{watching}} · build the missing images and publish them on → {{done}} · every {{seconds}}s',
            { watching, done, seconds: Math.round(state.interval_ms / 1000) }
          )}
        </p>
        <Button variant="outline" size="xs" disabled={checking} onClick={() => void checkNow()}>
          {checking
            ? translate('buildWeb.testing.checking', 'Checking…')
            : translate('buildWeb.testing.checkNow', 'Check now')}
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={translate('buildWeb.page.refresh', 'Refresh')}
              onClick={() => void load()}
            >
              <RefreshCw />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {translate('buildWeb.page.refresh', 'Refresh')}
          </TooltipContent>
        </Tooltip>
      </div>
      {state.enabled ? null : (
        <p className="rounded-md border border-status-warning-border bg-status-warning-background px-3 py-2 text-xs">
          {translate(
            'buildWeb.testing.off',
            'Monitoring is off on this console (WATCH_ENABLED=0): nothing is built or published automatically. Check now still works.'
          )}
        </p>
      )}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {note ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs">
          <span className="flex-1">{note}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={translate('buildWeb.testing.dismiss', 'Dismiss')}
            onClick={() => setNote(null)}
          >
            <X />
          </Button>
        </div>
      ) : null}
      {state.entries.length === 0 ? (
        <p className="px-3 py-10 text-center text-sm text-muted-foreground">
          {translate(
            'buildWeb.testing.none',
            'Nothing to watch — no task in {{watching}} has images left to build or publish.',
            { watching: watching || 'testing' }
          )}
        </p>
      ) : (
        <TestingTable entries={state.entries} done={done} onOpenTask={openTask} />
      )}
    </div>
  )
}

/** build-web's watch: tasks in testing whose images are not built or published yet. */
export default function BuildWebTestingPage(): React.JSX.Element {
  const closePage = useAppStore((s) => s.closeBuildWebTestingPage)
  const { target, contextKey } = useBuildWebTarget()
  const { refreshStatus } = useBuildWebStatus()
  const status = useBuildWebStore((s) => (s.contextKey === contextKey ? s.status : null))
  const error = useBuildWebStore((s) => s.error)
  const setStatus = useBuildWebStore((s) => s.setStatus)
  useBuildWebPageEscape(closePage)

  const connected = status?.connected === true
  return (
    <main className="relative flex h-full min-h-0 flex-1 flex-col bg-background pt-5 text-foreground md:pt-6">
      <header
        className="flex shrink-0 items-center gap-3 px-3 pb-3 md:px-5"
        // Why: no stacked titlebar on this page; keep the header clear of the window controls.
        style={{ paddingRight: 'max(0.75rem, var(--window-controls-width, 0px))' }}
      >
        <h1 className="truncate text-base leading-8 font-semibold">
          {translate('buildWeb.testing.title', 'Testing')}
        </h1>
        <div className="flex-1" />
        {connected ? (
          <span className="truncate text-xs text-muted-foreground">
            {status.login} · {status.baseUrl?.replace(/^https?:\/\//, '')}
          </span>
        ) : null}
      </header>
      {status === null ? (
        <BuildWebListState
          kind={error ? 'error' : 'loading'}
          error={error}
          onRetry={() => void refreshStatus()}
          loadingLabel={translate('buildWeb.testing.loading', 'Loading the watch…')}
        />
      ) : !connected ? (
        <BuildWebConnect target={target} onConnected={(next) => setStatus(contextKey, next)} />
      ) : status.perms.includes('watch') ? (
        <TestingView target={target} />
      ) : (
        <p className="px-3 py-10 text-center text-sm text-muted-foreground md:px-5">
          {translate(
            'buildWeb.testing.noAccess',
            'build-web has not given you its Watch section. Ask a build-web administrator for it.'
          )}
        </p>
      )}
    </main>
  )
}
