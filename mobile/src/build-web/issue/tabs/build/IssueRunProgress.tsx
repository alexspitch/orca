import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Play } from 'lucide-react-native'
import { distsOfChoice, repoField } from '../../../../../../src/shared/build-web-repos'
import { useDistRules } from '../../../use-dist-rules'
import { withoutTwins } from '../../../../../../src/shared/build-web-redos-twin'
import type {
  BuildWebBranch,
  BuildWebCombo,
  BuildWebRun
} from '../../../../../../src/shared/build-web-run-types'
import { runStatusTone } from '../../../../../../src/renderer/src/components/build-web/build-web-tones'
import {
  readRunFilter,
  readViewPrefs,
  writeRunFilter,
  writeViewPrefs,
  type RunFilter
} from '../../../../../../src/renderer/src/components/build-web/build-web-view-prefs'
import {
  cellKey,
  comboOf,
  failedCells,
  isRetrying,
  isSelectable,
  pendingCells,
  pickedCells,
  picksTwin,
  rhelBuildKeysOf,
  productOfImage,
  staleCells,
  unpushedCells,
  type Cell
} from '../../../../../../src/renderer/src/components/build-web/issue/build/run-cells'
import { LoadingSpinner } from '../../../../components/LoadingSpinner'
import type { BuildWebDistChoice } from '../../../../../../src/shared/build-web-dist-links'
import { runLinksByDist } from '../../../../../../src/renderer/src/components/build-web/issue/build/run-links'
import { useClipboardWriter } from '../../../../platform/clipboard'
import { chipTones, colors, spacing } from '../../../../theme/mobile-theme'
import { useBuildWebScreen } from '../../../build-web-screen-context'
import { BuildWebToneChip } from '../../../BuildWebToneChip'
import { useIssueConfirm } from '../../use-issue-confirm'
import { messageOf, useBuildTabCall } from './build-tab-call'
import { BuildLogSheet } from './BuildLogSheet'
import { BuildTabButton, BuildTabError, BuildTabSection, buildTabText } from './BuildTabControls'
import { RunAddImage, RunFilters, RunRefBar, RunSelectionBar } from './RunBars'
import { RunImageRow, type RunRowContext } from './RunImageRow'
import { RunMenuSheet, type RunMenu } from './RunMenus'
import { useRunActions } from './use-run-actions'
import { useRunProgress } from './use-run-progress'
import { useRunScan } from './use-run-scan'

/** A task's run, after build-web's Progress: its images, what to build, what to publish. */
export function IssueRunProgress({
  run,
  canWrite,
  onStatus
}: {
  run: BuildWebRun
  canWrite: boolean
  onStatus: (status: string) => void
}) {
  const { status: connection } = useBuildWebScreen()
  const { call } = useBuildTabCall()
  const clipboard = useClipboardWriter()
  const { confirm, confirmElement } = useIssueConfirm()
  const baseUrl = connection.baseUrl
  const [error, setError] = useState<string | null>(null)
  // Freshness again whenever a build ends: its own date is what the rows are compared by.
  const rescanRef = useRef<() => void>(() => {})
  const { cells, setCells, status, now, apply, watch, watching } = useRunProgress(run, (next) => {
    onStatus(next)
    if (next !== 'building') {
      rescanRef.current()
    }
  })
  const scan = useRunScan(run.id, apply, setError)
  const { scan: rescan } = scan
  rescanRef.current = () => void rescan(false)
  const actions = useRunActions({ runId: run.id, apply, setCells, watch, onError: setError })
  const [images, setImages] = useState<string[]>([])
  const [branches, setBranches] = useState<BuildWebBranch[]>([])
  const [testDirs, setTestDirs] = useState<Record<string, string[]>>({})
  const [filter, setFilter] = useState<RunFilter>(() => readRunFilter(run.id))
  const [hidePending, setHidePending] = useState(() => readViewPrefs().hidePending)
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [menu, setMenu] = useState<RunMenu>(null)
  const [log, setLog] = useState<{ url: string; title: string } | null>(null)

  const runRepo = run.repo
  useEffect(() => {
    // Optional helpers: without them the add row offers the run's own branch, and no Tests chip.
    const args = repoField(runRepo)
    void call('imageNames', args).then(setImages, () => setImages([]))
    void call('branches', args).then(setBranches, () => setBranches([]))
    void call('imageTestSources').then(setTestDirs, () => setTestDirs({}))
  }, [call, runRepo])

  const list = useMemo(() => Object.values(cells), [cells])
  const withDist = useDistRules().choosesDist(run.repo)
  const rhelBuildKeys = useMemo(() => rhelBuildKeysOf(list), [list])
  const building = status === 'building'
  const visible = useMemo(
    () =>
      list.filter(
        (c) =>
          (!withDist || filter.dist === 'all' || c.dist === filter.dist) &&
          (filter.product === 'all' || productOfImage(c.image) === filter.product) &&
          !(hidePending && c.state === 'pending')
      ),
    [filter, hidePending, list, withDist]
  )
  const own = withoutTwins(list)
  const hasPending = pendingCells(list).length > 0
  const hasLost = own.some((c) => c.status === 'poll-failed')
  const hasStuck = !building && own.some((c) => c.state === 'queued' || c.state === 'building')
  const selectable = visible.filter(isSelectable)
  const pickedRows = pickedCells(visible, picked)
  const linksOf = (choice: BuildWebDistChoice) => runLinksByDist(visible, list, picked, choice)
  const pendingCombos = pendingCells(visible).map(comboOf)
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
    // Why without twins: the console derives them on its own, so they ask nothing of it.
    const builds = withoutTwins(run.builds)
    const pending = builds.some((b) => b.status === 'pending')
    const lost = builds.some((b) => b.status === 'poll-failed')
    const stuck = builds.some((b) => b.status === 'queued' || b.status === 'building')
    const timer = setTimeout(() => {
      void rescan(false)
      if ((run.ticket && pending) || lost || stuck) {
        void actions.detect(true)
      } else if (pending) {
        void scan.loadLastBuilt(true)
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [run.id])

  // A push mark lasts until the row reads pushed, or the tab stops following the run.
  const pushingKeys = new Set(
    [...actions.pushingKeys].filter((k) => watching && cells[k] && !cells[k].pushed)
  )

  const remove = useCallback(
    async (combo: BuildWebCombo) => {
      const accepted = await confirm({
        title: 'Remove image from the list?',
        message: `Remove ${combo.image} (${combo.dist}) from this run? This only drops it from the list; already-built images on the server are not affected.`,
        confirmLabel: 'Remove',
        destructive: true
      })
      if (accepted) {
        await actions.remove(combo)
      }
    },
    [actions, confirm]
  )

  const add = async (image: string, dist: string, branch: string): Promise<boolean> => {
    const want = distsOfChoice(dist)
    const missing = want.filter((d) => !cells[cellKey({ image, dist: d, branch })])
    if (missing.length === 0) {
      setError(`${image} (${dist}) on ${branch} is already in the list.`)
      return false
    }
    return actions.add(missing.map((d) => ({ image, dist: d, branch })))
  }

  const copyLinks = async (links: string[]): Promise<boolean> => {
    try {
      await clipboard.writeText(links.join('\n'))
      return true
    } catch (failure) {
      setError(messageOf(failure))
      return false
    }
  }

  const togglePick = useCallback((cell: Cell) => {
    const key = cellKey(cell)
    setPicked((shown) => {
      const next = new Set(shown)
      if (!next.delete(key)) {
        next.add(key)
      }
      return next
    })
  }, [])

  const ctx: RunRowContext = {
    runBranch: run.branch,
    ticket: run.ticket,
    now,
    busy: actions.busy || !canWrite,
    building,
    testDirs,
    baseUrl,
    onOpenBuild: (combos) => setMenu({ kind: 'build', combos }),
    onOpenPush: (rows) => setMenu({ kind: 'push', cells: rows }),
    onCancel: (cell) => void actions.cancel(cell),
    onRetryTwin: (cell) => void actions.retryTwin(cell),
    rhelBuildKeys,
    onRemove: (combo) => void remove(combo),
    onOpenLog: (url, title) => setLog({ url, title })
  }

  return (
    <BuildTabSection>
      {error ? <BuildTabError message={error} onDismiss={() => setError(null)} /> : null}
      <View style={styles.wrapRow}>
        <Text style={buildTabText.heading}>Images</Text>
        {building ? <LoadingSpinner size={14} color={colors.textMuted} /> : null}
        <BuildWebToneChip label={status} tone={runStatusTone(status)} />
        {pushingKeys.size > 0 ? <LoadingSpinner size={14} color={chipTones.amber} /> : null}
      </View>
      {canWrite && (hasPending || hasLost || hasStuck) ? (
        <View style={styles.wrapRow}>
          <BuildTabButton
            label={actions.detecting ? 'Detecting…' : 'Detect images'}
            accessibilityLabel="Detect images already built for this task on the build server"
            disabled={actions.detecting || actions.busy || (!run.ticket && !hasLost && !hasStuck)}
            onPress={() => void actions.detect(false)}
          />
          {hasPending ? (
            <BuildTabButton
              label={scan.lastBuiltBusy ? 'Checking…' : 'Last built'}
              accessibilityLabel="For each pending image: its last CI build on that branch, and whether anything it is built from changed since"
              disabled={scan.lastBuiltBusy || actions.busy}
              onPress={() => void scan.loadLastBuilt(false)}
            />
          ) : null}
          {pendingCombos.length > 0 ? (
            <BuildTabButton
              variant="primary"
              icon={Play}
              label={`Build all (${pendingCombos.length})`}
              disabled={actions.detecting || actions.busy}
              onPress={() => setMenu({ kind: 'build', combos: pendingCombos })}
            />
          ) : null}
        </View>
      ) : null}
      {run.error ? <Text style={buildTabText.danger}>{run.error}</Text> : null}
      {list.length === 0 && !run.error ? (
        <Text style={buildTabText.muted}>No images in this run — add one below.</Text>
      ) : null}
      {scan.lastBuiltNote ? <Text style={buildTabText.small}>{scan.lastBuiltNote}</Text> : null}
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
          withDist={withDist}
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
        <Text style={buildTabText.muted}>No image matches the filter.</Text>
      ) : null}
      {canWrite && selectable.length > 0 ? (
        <RunSelectionBar
          selectable={selectable.length}
          picked={pickedRows.length}
          linksOf={linksOf}
          stale={staleCells(pickedRows, scan.freshness)}
          failed={failedCells(pickedRows)}
          unpushed={unpushedCells(pickedRows)}
          busy={actions.busy}
          building={building}
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
          onOpenBuild={(rows) => setMenu({ kind: 'build', combos: rows.map(comboOf) })}
          onOpenPush={(rows) => setMenu({ kind: 'push', cells: rows })}
        />
      ) : null}
      <View>
        {visible.map((c) => {
          const key = cellKey(c)
          return (
            <RunImageRow
              key={key}
              cell={c}
              picked={picked.has(key)}
              onPick={togglePick}
              pushing={pushingKeys.has(key)}
              cancelling={actions.cancelling.has(key)}
              retrying={isRetrying(c, actions.retrying, now)}
              lastBuilt={scan.lastBuilt[key]}
              freshness={scan.freshness[key]}
              ctx={ctx}
            />
          )
        })}
      </View>
      {canWrite ? (
        <RunAddImage
          images={images}
          branches={branches.map((b) => b.name)}
          runBranch={run.branch}
          choosing={withDist}
          defaultDist={run.dist_type}
          disabled={building || actions.busy}
          onAdd={add}
        />
      ) : null}
      <RunMenuSheet
        menu={menu}
        treeBranches={treeBranches}
        onBuild={(combos, pushAfter, skipTests) =>
          void actions.trigger(combos, pushAfter, skipTests, picksTwin(combos, cells))
        }
        onPush={(rows, moveMainTag) => void actions.push(rows, moveMainTag)}
        onClose={() => setMenu(null)}
      />
      <BuildLogSheet log={log} onClose={() => setLog(null)} />
      {confirmElement}
    </BuildTabSection>
  )
}

const styles = StyleSheet.create({
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }
})
