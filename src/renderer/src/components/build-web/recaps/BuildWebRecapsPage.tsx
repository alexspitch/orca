import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { BuildWebRecap, BuildWebRecapPage } from '../../../../../shared/build-web-recap-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { useBuildWebStore } from '../build-web-store'
import { useBuildWebStatus, useBuildWebTarget } from '../use-build-web-data'
import { useBuildWebPageEscape } from '../use-build-web-page-escape'
import { BuildWebConnect } from '../BuildWebConnect'
import { BuildWebListState } from '../BuildWebListState'
import { ResizableSplit } from '../issue/ResizableSplit'
import { NO_RECAP_FILTERS, hasRecapFilters, recapQuery, type RecapFilters } from './recap-filters'
import { RecapList } from './RecapList'
import { RecapReportFrame } from './RecapReportFrame'
import { RecapsFilterBar } from './RecapsFilterBar'
import { useRecapReport } from './use-recap-report'

const PAGE = 50
const message = (failure: unknown) => (failure instanceof Error ? failure.message : String(failure))

function RecapReportPane({
  target,
  contextKey,
  recap
}: {
  target: RuntimeClientTarget
  contextKey: string
  recap: BuildWebRecap
}): React.JSX.Element | null {
  const { html, error, retry } = useRecapReport(target, contextKey, recap.id)
  if (error) {
    return <BuildWebListState kind="error" error={error} onRetry={retry} />
  }
  // Why mounted only whole: the host lets a report frame load one document, never a second.
  return html === null ? (
    <BuildWebListState
      kind="loading"
      loadingLabel={translate('buildWeb.recaps.loadingReport', 'Loading the report…')}
    />
  ) : (
    <RecapReportFrame runId={recap.id} title={recap.name} html={html} />
  )
}

/** The finished reports, filtered and paged on the console; the one picked is shown beside them. */
function RecapsView({
  target,
  contextKey
}: {
  target: RuntimeClientTarget
  contextKey: string
}): React.JSX.Element {
  const [filters, setFilters] = useState<RecapFilters>(NO_RECAP_FILTERS)
  const [page, setPage] = useState(0)
  const [data, setData] = useState<BuildWebRecapPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Why: an answer to filters since changed must not land over the newer one.
  const latest = useRef(0)

  const load = useCallback(async () => {
    const mine = ++latest.current
    setLoading(true)
    try {
      const result = await callBuildWeb(target, 'recaps', recapQuery(filters, page, PAGE))
      if (mine !== latest.current) {
        return
      }
      if (!result.ok) {
        setError(result.error)
        return
      }
      const { results, total } = result.value
      // A re-read that shrank the list past this page goes to its last page instead.
      if (results.length === 0 && page > 0 && total > 0) {
        setPage(Math.ceil(total / PAGE) - 1)
        return
      }
      setData(result.value)
      setError(null)
      setSelectedId((current) =>
        results.some((r) => r.id === current) ? current : (results[0]?.id ?? null)
      )
    } catch (failure) {
      if (mine === latest.current) {
        setError(message(failure))
      }
    } finally {
      if (mine === latest.current) {
        setLoading(false)
      }
    }
  }, [filters, page, target])
  useEffect(() => {
    void load()
  }, [load])

  const changeFilters = (next: RecapFilters) => {
    setFilters(next)
    setPage(0)
  }

  if (data === null) {
    return error ? (
      <BuildWebListState kind="error" error={error} onRetry={() => void load()} />
    ) : (
      <BuildWebListState
        kind="loading"
        loadingLabel={translate('buildWeb.recaps.loading', 'Loading the reports…')}
      />
    )
  }
  const selected = data.results.find((r) => r.id === selectedId) ?? null
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-4 md:px-5">
      <RecapsFilterBar
        filters={filters}
        facets={data.facets}
        total={data.total}
        loading={loading}
        onChange={changeFilters}
        onRefresh={() => void load()}
      />
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {data.total === 0 ? (
        <div className="flex flex-col items-center gap-3 px-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {hasRecapFilters(filters)
              ? translate('buildWeb.recaps.noneFiltered', 'No reports match these filters.')
              : translate(
                  'buildWeb.recaps.none',
                  'No automation reports yet. They appear here when an automation in build-web finishes.'
                )}
          </p>
          {hasRecapFilters(filters) ? (
            <Button variant="outline" size="sm" onClick={() => changeFilters(NO_RECAP_FILTERS)}>
              {translate('buildWeb.recaps.reset', 'Reset')}
            </Button>
          ) : null}
        </div>
      ) : (
        <ResizableSplit
          panel="recaps-list"
          side="left"
          defaultWidth={320}
          minWidth={240}
          ruled
          className="min-h-0 flex-1 overflow-hidden rounded-md border border-border"
          aside={
            <section className="flex h-full min-h-0 flex-col">
              <RecapList
                recaps={data.results}
                selectedId={selected?.id ?? null}
                onSelect={setSelectedId}
                page={page}
                pageSize={PAGE}
                total={data.total}
                loading={loading}
                onPage={setPage}
              />
            </section>
          }
        >
          <section className="flex h-full min-h-0 flex-col">
            {selected ? (
              <RecapReportPane target={target} contextKey={contextKey} recap={selected} />
            ) : null}
          </section>
        </ResizableSplit>
      )}
    </div>
  )
}

/** build-web's automation reports — the finished ones only, newest first. */
export default function BuildWebRecapsPage(): React.JSX.Element {
  const closePage = useAppStore((s) => s.closeBuildWebRecapsPage)
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
          {translate('buildWeb.recaps.title', 'Recaps')}
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
          loadingLabel={translate('buildWeb.recaps.loading', 'Loading the reports…')}
        />
      ) : !connected ? (
        <BuildWebConnect target={target} onConnected={(next) => setStatus(contextKey, next)} />
      ) : (
        // Why no check of status.perms: they are saved at connect time and go stale; the console's
        // own refusal (403, naming the Automations section) is what the list shows instead.
        <RecapsView key={contextKey} target={target} contextKey={contextKey} />
      )}
    </main>
  )
}
