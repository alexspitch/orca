import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Loader2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebBranch,
  BuildWebCombo,
  BuildWebRun
} from '../../../../../../shared/build-web-run-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../../build-web-client'
import { useBuildWebStore } from '../../build-web-store'
import { BuildWebToneChip } from '../../BuildWebToneChip'
import { runStatusTone } from '../../build-web-tones'
import {
  readRunFilter,
  readViewPrefs,
  writeRunFilter,
  writeViewPrefs,
  type RunFilter
} from '../../build-web-view-prefs'
import {
  cellKey,
  comboOf,
  failedCells,
  imageLinks,
  isSelectable,
  pickedCells,
  productOfImage,
  staleCells,
  unpushedCells
} from './run-cells'
import { useRunProgress } from './use-run-progress'
import { useRunScan } from './use-run-scan'
import { useRunActions } from './use-run-actions'
import { RUN_ROW_GRID, RunImageRow, type RunRowContext } from './RunImageRow'
import { RunAddImage, RunFilters, RunRefBar, RunSelectionBar } from './RunBars'
import { BuildMenu } from './RunMenus'

/** A task's run, after build-web's Progress: its images, what to build, what to publish. */
export function IssueRunProgress({
  target,
  run,
  canWrite,
  onStatus
}: {
  target: RuntimeClientTarget
  run: BuildWebRun
  canWrite: boolean
  onStatus: (status: string) => void
}): React.JSX.Element {
  const confirm = useConfirmationDialog()
  const baseUrl = useBuildWebStore((s) => s.status?.baseUrl ?? null)
  const [error, setError] = useState<string | null>(null)
  // Freshness again whenever a build ends: its own date is what the rows are compared by.
  const rescanRef = useRef<() => void>(() => {})
  const { cells, setCells, status, now, apply, watch, watching } = useRunProgress(
    target,
    run,
    (next) => {
      onStatus(next)
      if (next !== 'building') {
        rescanRef.current()
      }
    }
  )
  const scan = useRunScan(target, run.id, apply, setError)
  const { scan: rescan } = scan
  rescanRef.current = () => void rescan(false)
  const actions = useRunActions({
    target,
    runId: run.id,
    apply,
    setCells,
    watch,
    onError: setError
  })
  const [images, setImages] = useState<string[]>([])
  const [branches, setBranches] = useState<BuildWebBranch[]>([])
  const [testDirs, setTestDirs] = useState<Record<string, string[]>>({})
  const [filter, setFilter] = useState<RunFilter>(() => readRunFilter(run.id))
  const [hidePending, setHidePending] = useState(() => readViewPrefs().hidePending)
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    // Optional helpers: without them the add row offers the run's own branch, and no Tests chip.
    void callBuildWeb(target, 'imageNames').then(setImages, () => setImages([]))
    void callBuildWeb(target, 'branches').then(setBranches, () => setBranches([]))
    void callBuildWeb(target, 'imageTestSources').then(setTestDirs, () => setTestDirs({}))
  }, [target])

  const list = useMemo(() => Object.values(cells), [cells])
  const building = status === 'building'
  const visible = useMemo(
    () =>
      list.filter(
        (c) =>
          (filter.dist === 'all' || c.dist === filter.dist) &&
          (filter.product === 'all' || productOfImage(c.image) === filter.product) &&
          !(hidePending && c.state === 'pending')
      ),
    [filter, hidePending, list]
  )
  const hasPending = list.some((c) => c.state === 'pending')
  const hasLost = list.some((c) => c.status === 'poll-failed')
  const hasStuck = !building && list.some((c) => c.state === 'queued' || c.state === 'building')
  const selectable = visible.filter(isSelectable)
  const pickedRows = pickedCells(visible, picked)
  const links = imageLinks(visible, picked)
  const pendingCombos = visible.filter((c) => c.state === 'pending').map(comboOf)
  const treeBranches = useMemo(
    () => new Set(branches.filter((b) => b.fromTree).map((b) => b.name)),
    [branches]
  )

  // Once per opening: how the rows stand against their branches; then settle builds the console
  // lost track of, or say what the pending ones need.
  useEffect(() => {
    if (run.status === 'building') {
      return
    }
    const pending = run.builds.some((b) => b.status === 'pending')
    const lost = run.builds.some((b) => b.status === 'poll-failed')
    const stuck = run.builds.some((b) => b.status === 'queued' || b.status === 'building')
    // Why after the first paint: the rows show at once, and the console is asked once they do.
    const timer = window.setTimeout(() => {
      void rescan(false)
      if ((run.ticket && pending) || lost || stuck) {
        void actions.detect(true)
      } else if (pending) {
        void scan.loadLastBuilt(true)
      }
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per run; the view is keyed by it.
  }, [run.id])

  // A push mark lasts until the row reads pushed, or the tab stops following the run.
  const pushingKeys = new Set(
    [...actions.pushingKeys].filter((k) => watching && cells[k] && !cells[k].pushed)
  )

  const remove = useCallback(
    async (combo: BuildWebCombo) => {
      const accepted = await confirm({
        title: translate('buildWeb.run.removeTitle', 'Remove image from the list?'),
        description: translate(
          'buildWeb.run.removeBody',
          'Remove {{image}} ({{dist}}) from this run? This only drops it from the list; already-built images on the server are not affected.',
          { image: combo.image, dist: combo.dist }
        ),
        confirmLabel: translate('buildWeb.run.remove', 'Remove'),
        confirmVariant: 'destructive'
      })
      if (accepted) {
        await actions.remove(combo)
      }
    },
    [actions, confirm]
  )

  const add = async (image: string, dist: string, branch: string): Promise<boolean> => {
    const want = dist === 'both' ? ['rhel', 'redos'] : [dist]
    const missing = want.filter((d) => !cells[cellKey({ image, dist: d, branch })])
    if (missing.length === 0) {
      setError(
        translate(
          'buildWeb.run.alreadyListed',
          '{{image}} ({{dist}}) on {{branch}} is already in the list.',
          {
            image,
            dist,
            branch
          }
        )
      )
      return false
    }
    return actions.add(missing.map((d) => ({ image, dist: d, branch })))
  }

  const copyLinks = async (): Promise<boolean> => {
    try {
      await window.api.ui.writeClipboardText(links.join('\n'))
      return true
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
      return false
    }
  }

  const ctx: RunRowContext = {
    runBranch: run.branch,
    ticket: run.ticket,
    now,
    busy: actions.busy || !canWrite,
    building,
    pushingAny: pushingKeys.size > 0,
    treeBranches,
    testDirs,
    baseUrl,
    onBuild: (combos, pushAfter, skipTests) => void actions.trigger(combos, pushAfter, skipTests),
    onPush: (rows, moveMainTag) => void actions.push(rows, moveMainTag),
    onCancel: (cell) => void actions.cancel(cell),
    onRemove: (combo) => void remove(combo)
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm">
      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span className="flex-1 whitespace-pre-wrap">{error}</span>
          <button type="button" className="hover:underline" onClick={() => setError(null)}>
            {translate('buildWeb.run.dismiss', 'Dismiss')}
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{translate('buildWeb.run.images', 'Images')}</h3>
        {building ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        <BuildWebToneChip label={status} tone={runStatusTone(status)} />
        <div className="flex-1" />
        {canWrite && (hasPending || hasLost || hasStuck) ? (
          <>
            <Button
              variant="outline"
              size="xs"
              disabled={actions.detecting || actions.busy || (!run.ticket && !hasLost && !hasStuck)}
              onClick={() => void actions.detect(false)}
              title={translate(
                'buildWeb.run.detectTip',
                'Detect images already built for this task on the build server'
              )}
            >
              {actions.detecting
                ? translate('buildWeb.run.detecting', 'Detecting…')
                : translate('buildWeb.run.detect', 'Detect images')}
            </Button>
            {hasPending ? (
              <Button
                variant="outline"
                size="xs"
                disabled={scan.lastBuiltBusy || actions.busy}
                onClick={() => void scan.loadLastBuilt(false)}
                title={translate(
                  'buildWeb.run.lastBuiltTip',
                  'For each pending image: its last CI build on that branch, and whether anything it is built from changed since'
                )}
              >
                {scan.lastBuiltBusy
                  ? translate('buildWeb.run.checking', 'Checking…')
                  : translate('buildWeb.run.lastBuilt', 'Last built')}
              </Button>
            ) : null}
            {pendingCombos.length > 0 ? (
              <BuildMenu
                combos={pendingCombos}
                treeBranches={treeBranches}
                disabled={actions.detecting || actions.busy}
                onBuild={ctx.onBuild}
              >
                <Button size="xs">
                  <Play />
                  {translate('buildWeb.run.buildAll', 'Build all ({{n}})', {
                    n: String(pendingCombos.length)
                  })}
                  <ChevronDown className="size-3 opacity-70" />
                </Button>
              </BuildMenu>
            ) : null}
          </>
        ) : null}
        {pushingKeys.size > 0 ? (
          <Loader2 className="size-4 animate-spin text-chip-tone-amber" />
        ) : null}
      </div>
      {run.error ? <p className="text-xs text-destructive">{run.error}</p> : null}
      {list.length === 0 && !run.error ? (
        <p className="text-xs text-muted-foreground">
          {translate('buildWeb.run.empty', 'No images in this run — add one below.')}
        </p>
      ) : null}
      {scan.lastBuiltNote ? (
        <p className="text-2xs text-muted-foreground">{scan.lastBuiltNote}</p>
      ) : null}
      <RunRefBar
        refs={scan.refs}
        ticket={run.ticket}
        scanning={scan.scanning}
        note={scan.scanNote}
        onRescan={() => void rescan(true)}
      />
      {list.length > 1 ? (
        <RunFilters
          filter={filter}
          onFilter={(next) => {
            setFilter(next)
            writeRunFilter(run.id, next)
          }}
          hidePending={hidePending}
          onHidePending={(on) => {
            setHidePending(on)
            writeViewPrefs({ hidePending: on })
          }}
          shown={visible.length}
          total={list.length}
        />
      ) : null}
      {list.length > 0 && visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {translate('buildWeb.run.noMatch', 'No image matches the filter.')}
        </p>
      ) : null}
      {canWrite && selectable.length > 0 ? (
        <RunSelectionBar
          selectable={selectable.length}
          picked={pickedRows.length}
          links={links}
          stale={staleCells(pickedRows, scan.freshness)}
          failed={failedCells(pickedRows)}
          unpushed={unpushedCells(pickedRows)}
          busy={actions.busy}
          building={building}
          treeBranches={treeBranches}
          onPickAll={(on) =>
            setPicked((shown) => {
              const next = new Set(shown)
              for (const c of selectable) {
                if (on) {
                  next.add(cellKey(c))
                } else {
                  next.delete(cellKey(c))
                }
              }
              return next
            })
          }
          onCopy={copyLinks}
          onBuild={ctx.onBuild}
          onPush={ctx.onPush}
        />
      ) : null}
      {visible.length > 0 ? (
        <div className="scrollbar-sleek overflow-x-auto rounded-md border border-border">
          <div className="min-w-[1040px]">
            <div
              className={`${RUN_ROW_GRID} min-h-8 border-b border-border bg-muted/50 text-2xs font-semibold tracking-wide text-muted-foreground uppercase`}
            >
              <span />
              <span>{translate('buildWeb.images.image', 'Image')}</span>
              <span>{translate('buildWeb.run.dist', 'dist')}</span>
              <span>{translate('buildWeb.run.state', 'State')}</span>
              <span>{translate('buildWeb.run.freshness', 'Freshness')}</span>
              <span>{translate('buildWeb.images.registry', 'Registry')}</span>
              <span className="text-right">{translate('buildWeb.run.actions', 'Actions')}</span>
            </div>
            {visible.map((c) => {
              const key = cellKey(c)
              return (
                <RunImageRow
                  key={key}
                  cell={c}
                  picked={picked.has(key)}
                  onPick={() =>
                    setPicked((shown) => {
                      const next = new Set(shown)
                      if (!next.delete(key)) {
                        next.add(key)
                      }
                      return next
                    })
                  }
                  pushing={pushingKeys.has(key)}
                  cancelling={actions.cancelling.has(key)}
                  lastBuilt={scan.lastBuilt[key]}
                  freshness={scan.freshness[key]}
                  ctx={ctx}
                />
              )
            })}
          </div>
        </div>
      ) : null}
      {canWrite ? (
        <RunAddImage
          images={images}
          branches={branches.map((b) => b.name)}
          runBranch={run.branch}
          defaultDist={run.dist_type}
          disabled={building || actions.busy}
          onAdd={add}
        />
      ) : null}
    </section>
  )
}
