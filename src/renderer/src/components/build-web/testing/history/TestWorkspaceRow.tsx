import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type {
  BuildWebTestCase,
  BuildWebTestJobBreakdown
} from '../../../../../../shared/build-web-test-history-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { durationText, filterFiles, type BreakdownFilter } from './run-breakdown'
import { TestStatusMark, TransitionMark } from './test-marks'
import { shortWorkspace } from './test-run-rows'
import { useTestWorkspace } from './use-test-history'

/** The share of each outcome of one workspace, as a bar. */
function OutcomeBar({ job }: { job: BuildWebTestJobBreakdown }): React.JSX.Element {
  const total = job.passed + job.failed + job.skipped
  const part = (n: number, className: string) =>
    n > 0 ? <span className={className} style={{ width: `${(100 * n) / total}%` }} /> : null
  return (
    <span
      className="flex h-2 min-w-20 flex-1 overflow-hidden rounded-sm border border-border/60"
      aria-label={translate(
        'buildWeb.testHistory.outcomes',
        'passed {{passed}}, failed {{failed}}, skipped {{skipped}}',
        { passed: job.passed, failed: job.failed, skipped: job.skipped }
      )}
    >
      {total > 0 ? (
        <>
          {part(job.passed, 'bg-chip-tone-green')}
          {part(job.failed, 'bg-chip-tone-red')}
          {part(job.skipped, 'bg-chip-tone-neutral')}
        </>
      ) : null}
    </span>
  )
}

function TestRow({
  test,
  current,
  onOpen
}: {
  test: BuildWebTestCase
  current: boolean
  onOpen: (key: string) => void
}): React.JSX.Element {
  const full = test.suite ? `${test.suite} › ${test.name}` : test.name
  return (
    <button
      type="button"
      onClick={() => onOpen(test.key)}
      aria-pressed={current}
      className={cn(
        'flex w-full flex-col py-0.5 pr-3 pl-12 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
        current && 'bg-accent'
      )}
    >
      <span className="flex w-full items-center gap-2">
        <TestStatusMark status={test.status} className="size-3" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs" title={full}>
          {test.suite ? <span className="text-muted-foreground">{test.suite} › </span> : null}
          {test.name}
          {test.flaky ? (
            <span className="text-2xs text-chip-tone-amber">
              {' '}
              —{' '}
              {translate('buildWeb.testHistory.passedOnRetry', 'passed on retry {{count}}', {
                count: test.retries
              })}
            </span>
          ) : null}
        </span>
        {test.change && test.change !== 'unchanged' ? <TransitionMark kind={test.change} /> : null}
        <span className="w-16 shrink-0 text-right font-mono text-2xs text-muted-foreground">
          {durationText(test.durationMs)}
        </span>
      </span>
      {test.status === 'failed' && test.failureMessage ? (
        <span
          className="w-full truncate pl-5 font-mono text-2xs text-destructive"
          title={test.failureMessage}
        >
          {test.failureMessage.split('\n')[0]}
        </span>
      ) : null}
    </button>
  )
}

/** One workspace of a run: its bar and counts; opened, its files and their tests, red files open. */
export function TestWorkspaceRow({
  target,
  runId,
  job,
  filter,
  focus,
  cardKey,
  onOpenCase,
  onOpenLog,
  onOpenJunit
}: {
  target: RuntimeClientTarget
  runId: string
  job: BuildWebTestJobBreakdown
  filter: BreakdownFilter
  /** Changes each time the map asks for this workspace; null when it asks for another one. */
  focus: number | null
  cardKey: string | null
  onOpenCase: (key: string) => void
  onOpenLog: (job: BuildWebTestJobBreakdown) => void
  onOpenJunit: (job: BuildWebTestJobBreakdown) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  // Why kept once read: folding a workspace and opening it again should not read it again.
  const [read, setRead] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focus === null) {
      return
    }
    setOpen(true)
    setRead(true)
    rowRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [focus])
  const { data, error } = useTestWorkspace(target, runId, job.workspace, read)
  const [openFiles, setOpenFiles] = useState<Set<string> | null>(null)
  // A red file opens by itself: that is what the workspace was opened for.
  const opened = useMemo(
    () => openFiles ?? new Set((data?.files ?? []).filter((f) => f.failed > 0).map((f) => f.file)),
    [openFiles, data]
  )
  const files = useMemo(() => (data ? filterFiles(data.files, filter) : []), [data, filter])
  const toggleFile = (file: string) => {
    const next = new Set(opened)
    if (!next.delete(file)) {
      next.add(file)
    }
    setOpenFiles(next)
  }
  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <div ref={rowRef} className="scroll-mt-1 border-b border-border/60">
      <div className="flex items-center gap-2 px-3 py-1 hover:bg-accent/50">
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o)
            setRead(true)
          }}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Chevron className="size-3.5 shrink-0 text-muted-foreground" />
          <TestStatusMark status={job.jobStatus} />
          <span className="w-56 shrink-0 truncate text-[13px]" title={job.workspace}>
            {shortWorkspace(job.workspace)}
            {job.jobFlaky ? (
              <span
                className="text-xs text-chip-tone-amber"
                title={translate(
                  'buildWeb.testHistory.jobFlaky',
                  'red beside the other suites, green on its own'
                )}
              >
                {' '}
                ∿
              </span>
            ) : null}
          </span>
          <OutcomeBar job={job} />
          <span className="w-32 shrink-0 text-right font-mono text-xs">
            <span className="text-chip-tone-green">{job.passed}</span>
            {' / '}
            <span className={job.failed ? 'text-destructive' : 'text-muted-foreground'}>
              {job.failed}
            </span>
            {' / '}
            <span className="text-muted-foreground">{job.skipped}</span>
          </span>
          <span className="w-16 shrink-0 text-right font-mono text-2xs text-muted-foreground">
            {durationText(job.durationMs)}
          </span>
        </button>
        <Button variant="ghost" size="xs" onClick={() => onOpenLog(job)}>
          {translate('buildWeb.testHistory.log', 'Log')}
        </Button>
        {job.hasReport ? (
          <Button variant="ghost" size="xs" onClick={() => onOpenJunit(job)}>
            {translate('buildWeb.testHistory.junit', 'junit.xml')}
          </Button>
        ) : null}
      </div>
      {open ? (
        <div className="pb-1.5">
          {!data && !error ? (
            <p className="px-10 py-1 text-xs text-muted-foreground">
              {translate('buildWeb.testHistory.loadingTests', 'Reading the tests…')}
            </p>
          ) : null}
          {error ? <p className="px-10 py-1 text-xs text-destructive">{error}</p> : null}
          {data && files.length === 0 ? (
            <p className="px-10 py-1 text-xs text-muted-foreground">
              {data.files.length === 0
                ? translate(
                    'buildWeb.testHistory.noReport',
                    'No tests in the report — see the log.'
                  )
                : translate('buildWeb.testHistory.noneForFilter', 'No tests for this filter.')}
            </p>
          ) : null}
          {files.map((f) => {
            const fileOpen = opened.has(f.file)
            const FileChevron = fileOpen ? ChevronDown : ChevronRight
            return (
              <div key={f.file || '(no file)'}>
                <button
                  type="button"
                  onClick={() => toggleFile(f.file)}
                  aria-expanded={fileOpen}
                  className="flex w-full items-center gap-2 py-0.5 pr-3 pl-8 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                >
                  <FileChevron className="size-3 shrink-0 text-muted-foreground" />
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-xs',
                      f.file ? 'font-mono' : 'text-muted-foreground'
                    )}
                  >
                    {f.file || translate('buildWeb.testHistory.noFile', 'no file')}
                  </span>
                  <span className="font-mono text-2xs text-muted-foreground">
                    {f.passed} / {f.failed} / {f.skipped}
                    {f.flaky ? ` · ∿${f.flaky}` : ''}
                  </span>
                </button>
                {fileOpen
                  ? f.tests.map((t) => (
                      <TestRow
                        key={t.key}
                        test={t}
                        current={cardKey === t.key}
                        onOpen={onOpenCase}
                      />
                    ))
                  : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
