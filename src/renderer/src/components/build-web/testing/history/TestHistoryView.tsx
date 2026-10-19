import { useMemo, useState } from 'react'
import { translate } from '@/i18n/i18n'
import type { BuildWebTestJobBreakdown } from '../../../../../../shared/build-web-test-history-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { BuildWebListState } from '../../BuildWebListState'
import { useBuildLogViewer } from '../../images/build-log-viewer'
import { ResizableSplit } from '../../issue/ResizableSplit'
import {
  readTestingViewPrefs,
  writeTestingViewPrefs,
  type TestRunKind
} from '../testing-view-prefs'
import { runsOfKind, shortWorkspace } from './test-run-rows'
import { TestRunDetail } from './TestRunDetail'
import { TestRunList } from './TestRunList'
import { useTestRun, useTestRuns } from './use-test-history'

const enc = encodeURIComponent

/** build-web's test history: the runs on the left, the one picked on the right. */
export function TestHistoryView({
  target,
  baseUrl
}: {
  target: RuntimeClientTarget
  baseUrl: string
}): React.JSX.Element {
  const runs = useTestRuns(target)
  const [kind, setKind] = useState<TestRunKind>(() => readTestingViewPrefs().kind)
  const [picked, setPicked] = useState<string | null>(null)
  const shown = useMemo(() => runsOfKind(runs.data ?? [], kind), [runs.data, kind])
  // Why the newest by default: the run a person comes for is almost always the last one.
  const selectedId = picked && shown.some((r) => r.id === picked) ? picked : (shown[0]?.id ?? null)
  const detail = useTestRun(target, selectedId)

  const openLog = (job: BuildWebTestJobBreakdown) => {
    if (!selectedId) {
      return
    }
    useBuildLogViewer
      .getState()
      .show(
        `${baseUrl}/api/tests/runs/${enc(selectedId)}/jobs/${enc(job.jobId)}/log`,
        `${shortWorkspace(job.workspace)} · ${job.variant}`,
        { kind: 'test', webUrl: `${baseUrl}/tests/history/${enc(selectedId)}` }
      )
  }
  // Why the browser: the file is a download, and the browser holds the console's own sign-in.
  const openJunit = (job: BuildWebTestJobBreakdown) => {
    if (selectedId) {
      void window.api.shell.openUrl(
        `${baseUrl}/api/tests/history/${enc(selectedId)}/jobs/${enc(job.jobId)}/junit`
      )
    }
  }

  if (!runs.data) {
    return (
      <BuildWebListState
        kind={runs.error ? 'error' : 'loading'}
        error={runs.error}
        onRetry={runs.reload}
        loadingLabel={translate('buildWeb.testHistory.loading', 'Loading the test history…')}
      />
    )
  }
  if (runs.data.length === 0) {
    return (
      <p className="px-3 py-10 text-center text-sm text-muted-foreground md:px-5">
        {translate(
          'buildWeb.testHistory.empty',
          'No runs yet. The history fills after the first one; the delta appears from the second run of the same scope.'
        )}
      </p>
    )
  }
  return (
    <ResizableSplit
      panel="test-history-list"
      side="left"
      defaultWidth={320}
      minWidth={240}
      ruled
      className="min-h-0 flex-1"
      aside={
        <div className="h-full overflow-hidden rounded-md border border-border">
          <TestRunList
            runs={shown}
            total={runs.data.length}
            kind={kind}
            onKind={(next) => {
              writeTestingViewPrefs({ kind: next })
              setKind(next)
            }}
            selectedId={selectedId}
            onSelect={setPicked}
            loading={runs.loading}
            onReload={runs.reload}
          />
        </div>
      }
    >
      <div className="h-full min-h-0 overflow-hidden">
        {detail.data ? (
          <TestRunDetail
            key={detail.data.run.id}
            target={target}
            detail={detail.data}
            onOpenLog={openLog}
            onOpenJunit={openJunit}
          />
        ) : detail.error ? (
          <BuildWebListState kind="error" error={detail.error} />
        ) : detail.loading ? (
          <BuildWebListState
            kind="loading"
            loadingLabel={translate('buildWeb.testHistory.loadingRun', 'Reading the run…')}
          />
        ) : selectedId ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            {translate('buildWeb.testHistory.runGone', 'build-web no longer has this run.')}
          </p>
        ) : null}
      </div>
    </ResizableSplit>
  )
}
