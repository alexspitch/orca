import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { BuildLogDialog } from '../images/BuildLogDialog'
import { ImagePushProgress } from '../images/ImagePushProgress'
import { writesRuns } from '../issue/issue-card-facts'
import { TestHistoryView } from './history/TestHistoryView'
import { TestingIssueDialog } from './TestingIssueDialog'
import { TestingTable } from './TestingTable'
import { readTestingViewPrefs, writeTestingViewPrefs, type TestingTab } from './testing-view-prefs'

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
function TestingView({
  target,
  perms
}: {
  target: RuntimeClientTarget
  perms: string[]
}): React.JSX.Element {
  const [state, setState] = useState<BuildWebWatchState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [branches, setBranches] = useState<{ name: string; fromTree: boolean }[]>([])
  // Empty until read (or on an older host): every build started here then runs the tests.
  const treeBranches = useMemo(
    () => new Set(branches.filter((b) => b.fromTree).map((b) => b.name)),
    [branches]
  )

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
  useEffect(() => {
    void callBuildWeb(target, 'branches').then(setBranches, () => setBranches([]))
  }, [target])

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

  // Over the list, not on Issues: the list keeps its place, and closing the card reads it again.
  const openTask = (issueId: string, tab: BuildWebCardTab) => {
    useBuildWebStore.getState().openIssue(issueId, true, tab)
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
      <ImagePushProgress target={target} onSettled={() => void load()} />
      {state.entries.length === 0 ? (
        <p className="px-3 py-10 text-center text-sm text-muted-foreground">
          {translate(
            'buildWeb.testing.none',
            'Nothing to watch — no task in {{watching}} has images left to build or publish.',
            { watching: watching || 'testing' }
          )}
        </p>
      ) : (
        <TestingTable
          entries={state.entries}
          done={done}
          onOpenTask={openTask}
          target={target}
          canWrite={writesRuns(perms)}
          treeBranches={treeBranches}
          onChanged={() => void load()}
        />
      )}
      <TestingIssueDialog onClosed={() => void load()} />
    </div>
  )
}

function NoAccess({ section }: { section: string }): React.JSX.Element {
  return (
    <p className="px-3 py-10 text-center text-sm text-muted-foreground md:px-5">
      {translate(
        'buildWeb.testing.noSection',
        'build-web has not given you its {{section}} section. Ask a build-web administrator for it.',
        { section }
      )}
    </p>
  )
}

/** The two tabs: build-web's watch, and its test history. Both stay mounted once shown. */
function TestingTabs({
  target,
  perms,
  baseUrl
}: {
  target: RuntimeClientTarget
  perms: string[]
  baseUrl: string
}): React.JSX.Element {
  const [tab, setTab] = useState<TestingTab>(() => readTestingViewPrefs().tab)
  const [historySeen, setHistorySeen] = useState(tab === 'history')
  const pick = (value: string) => {
    const next: TestingTab = value === 'history' ? 'history' : 'watch'
    writeTestingViewPrefs({ tab: next })
    setTab(next)
    setHistorySeen((seen) => seen || next === 'history')
  }
  // A test run from the task list: the history opens on it.
  const toRun = useBuildWebStore((s) => s.focus?.kind === 'test-run')
  useEffect(() => {
    if (toRun) {
      setTab('history')
      setHistorySeen(true)
    }
  }, [toRun])
  return (
    <Tabs value={tab} onValueChange={pick} className="min-h-0 flex-1">
      <div className="px-3 md:px-5">
        <TabsList variant="line">
          <TabsTrigger value="watch">
            {translate('buildWeb.testing.tabs.watch', 'In testing')}
          </TabsTrigger>
          <TabsTrigger value="history">
            {translate('buildWeb.testing.tabs.history', 'Test history')}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="watch" className="flex min-h-0 flex-col">
        {perms.includes('watch') ? (
          <TestingView target={target} perms={perms} />
        ) : (
          <NoAccess section="Watch" />
        )}
      </TabsContent>
      {/* Why mounted once shown: the run picked and the workspaces opened survive a look at the watch. */}
      <TabsContent
        value="history"
        forceMount
        hidden={tab !== 'history'}
        className="flex min-h-0 flex-col"
      >
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-4 md:px-5">
          {!historySeen ? null : perms.includes('tests') ? (
            <TestHistoryView target={target} baseUrl={baseUrl} />
          ) : (
            <NoAccess section="Tests" />
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}

/** build-web's watch and test history: tasks in testing with images left, and the test runs. */
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
      ) : (
        <TestingTabs
          key={contextKey}
          target={target}
          perms={status.perms}
          baseUrl={status.baseUrl ?? ''}
        />
      )}
      <BuildLogDialog target={target} />
    </main>
  )
}
