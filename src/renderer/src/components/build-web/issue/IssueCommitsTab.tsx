import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { ResizableSplit } from './ResizableSplit'
import type {
  BuildWebCommitDiff,
  BuildWebCommitList
} from '../../../../../shared/build-web-run-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { BuildWebListState } from '../BuildWebListState'
import { diffFilesOf, type DiffCell } from './commit-diff-rows'

const CELL_TONE: Record<DiffCell['kind'], string> = {
  same: '',
  removed: 'bg-destructive/10',
  added: 'bg-status-success-background',
  empty: 'bg-muted/40'
}

function Cell({ cell }: { cell: DiffCell }): React.JSX.Element {
  return (
    <div
      className={cn('flex min-w-0 gap-2 px-2 font-mono text-xs leading-5', CELL_TONE[cell.kind])}
    >
      <span className="w-10 shrink-0 text-right text-muted-foreground select-none">
        {cell.line ?? ''}
      </span>
      {/* Why wrap: a long line (a markdown table row) would run over the other side's column. */}
      <span className="min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]">
        {cell.text}
      </span>
    </div>
  )
}

export function IssueCommitsTab({
  target,
  issueId
}: {
  target: RuntimeClientTarget
  issueId: string
}): React.JSX.Element {
  const [list, setList] = useState<BuildWebCommitList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [sha, setSha] = useState<string | null>(null)
  const [diff, setDiff] = useState<BuildWebCommitDiff | null>(null)
  // Why its own error: a failed diff must not hide the list, and retry must fetch the diff again.
  const [diffError, setDiffError] = useState<string | null>(null)
  const [diffAttempt, setDiffAttempt] = useState(0)
  const [fileIndex, setFileIndex] = useState(0)

  const load = useCallback(
    async (fetchFirst: boolean) => {
      setFetching(fetchFirst)
      try {
        setList(await callBuildWeb(target, 'issueCommits', { id: issueId, fetch: fetchFirst }))
        setError(null)
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : String(failure))
      } finally {
        setFetching(false)
      }
    },
    [issueId, target]
  )
  useEffect(() => {
    void load(false)
  }, [load])
  useEffect(() => {
    if (!sha) {
      return
    }
    let alive = true
    setDiff(null)
    setDiffError(null)
    setFileIndex(0)
    void callBuildWeb(target, 'commitDiff', { id: issueId, sha })
      .then((next) => alive && setDiff(next))
      .catch(
        (failure) =>
          alive && setDiffError(failure instanceof Error ? failure.message : String(failure))
      )
    return () => {
      alive = false
    }
  }, [diffAttempt, issueId, sha, target])
  const files = useMemo(() => (diff ? diffFilesOf(diff.diff) : []), [diff])
  const file = files[fileIndex] ?? null

  if (error) {
    return <BuildWebListState kind="error" error={error} onRetry={() => void load(false)} />
  }
  if (!list) {
    return (
      <BuildWebListState
        kind="loading"
        loadingLabel={translate('buildWeb.state.loadingCard', 'Loading…')}
      />
    )
  }
  return (
    <ResizableSplit
      panel="commits"
      side="left"
      defaultWidth={380}
      minWidth={260}
      aside={
        <section className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <h3 className="flex-1 text-sm font-semibold">
              {translate('buildWeb.commits.title', 'Commits · {{count}}', {
                count: list.commits.length
              })}
            </h3>
            <Button variant="ghost" size="sm" disabled={fetching} onClick={() => void load(true)}>
              {fetching
                ? translate('buildWeb.commits.fetching', 'Reading…')
                : translate('buildWeb.commits.fetch', 'Update from git')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {translate(
              'buildWeb.commits.note',
              'Branches come from the task’s release: its branch and every newer one, down to master. A change carried over by cherry-pick is shown once.'
            )}
          </p>
          {list.commits.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {translate(
                'buildWeb.commits.none',
                'No commits with the task’s key on these branches.'
              )}
            </p>
          ) : (
            <ul className="flex flex-col rounded-lg border border-border">
              {list.commits.map((c) => (
                <li key={c.sha}>
                  <button
                    type="button"
                    onClick={() => setSha(c.sha)}
                    aria-current={sha === c.sha ? 'true' : undefined}
                    className={cn(
                      'flex w-full flex-col gap-1 border-b border-border px-3 py-2 text-left hover:bg-accent',
                      sha === c.sha && 'bg-accent'
                    )}
                  >
                    <span className="text-sm">{c.subject}</span>
                    <span className="text-xs text-muted-foreground">
                      <span className="font-mono">{c.sha.slice(0, 9)}</span> · {c.author} ·{' '}
                      {c.branches.join(', ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      }
    >
      <section className="flex min-w-0 flex-col gap-2 rounded-lg border border-border">
        {!sha ? (
          <p className="p-4 text-sm text-muted-foreground">
            {translate(
              'buildWeb.commits.pick',
              'Pick a commit to see its files and the diff: before on the left, after on the right.'
            )}
          </p>
        ) : diffError ? (
          <BuildWebListState
            kind="error"
            error={diffError}
            onRetry={() => setDiffAttempt((n) => n + 1)}
          />
        ) : !diff ? (
          <BuildWebListState
            kind="loading"
            loadingLabel={translate('buildWeb.state.loadingCard', 'Loading…')}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-1 border-b border-border p-2">
              {files.map((f, n) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => setFileIndex(n)}
                  aria-pressed={n === fileIndex}
                  className={cn(
                    'rounded px-2 py-1 font-mono text-xs hover:bg-accent',
                    n === fileIndex && 'bg-accent'
                  )}
                >
                  {f.path}{' '}
                  <span className="text-muted-foreground">
                    +{f.added} −{f.removed}
                  </span>
                </button>
              ))}
            </div>
            {diff.truncated ? (
              <p className="px-3 text-xs text-muted-foreground">
                {translate(
                  'buildWeb.commits.truncated',
                  'The patch is long and was cut; open the commit in build-web for all of it.'
                )}
              </p>
            ) : null}
            {file ? (
              <div className="scrollbar-sleek max-h-[60vh] overflow-auto">
                <div className="grid min-w-[720px] grid-cols-2">
                  {file.rows.map((row, n) => (
                    <div
                      key={`${row.left.line ?? 'x'}-${row.right.line ?? 'y'}-${n}`}
                      className="contents"
                    >
                      <Cell cell={row.left} />
                      <Cell cell={row.right} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                {translate('buildWeb.commits.noFiles', 'No file changes.')}
              </p>
            )}
          </>
        )}
      </section>
    </ResizableSplit>
  )
}
