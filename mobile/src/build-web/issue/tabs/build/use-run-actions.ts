import { useCallback, useState } from 'react'
import type {
  BuildWebCombo,
  BuildWebPushAfter,
  BuildWebRun
} from '../../../../../../src/shared/build-web-run-types'
import type { BuildWebMutationResult } from '../../../../../../src/shared/build-web-types'
import {
  cellKey,
  comboOf,
  type Cell
} from '../../../../../../src/renderer/src/components/build-web/issue/build/run-cells'
import { useBuildWebScreen } from '../../../build-web-screen-context'
import { messageOf, useBuildTabCall } from './build-tab-call'

// How long the tab keeps re-reading the run after it started something on the console.
const AFTER_BUILD_MS = 30_000
const AFTER_PUSH_MS = 180_000

/** What the Build tab does to its run: build, cancel, push, add, remove, detect. */
export function useRunActions(args: {
  runId: string
  apply: (fresh: BuildWebRun, merge?: boolean) => void
  setCells: React.Dispatch<React.SetStateAction<Record<string, Cell>>>
  watch: (ms: number) => void
  onError: (message: string | null) => void
}) {
  const { runId, apply, setCells, watch, onError } = args
  const { notify } = useBuildWebScreen()
  const { call } = useBuildTabCall()
  const [busy, setBusy] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [pushingKeys, setPushingKeys] = useState<ReadonlySet<string>>(new Set())
  const [cancelling, setCancelling] = useState<ReadonlySet<string>>(new Set())
  const [retrying, setRetrying] = useState<ReadonlyMap<string, number>>(new Map())

  /** One write; a refusal goes to the tab's error line. */
  const write = useCallback(
    async <T>(run: () => Promise<BuildWebMutationResult<T>>): Promise<T | undefined> => {
      onError(null)
      try {
        const result = await run()
        if (result.ok) {
          return result.value
        }
        onError(result.error)
      } catch (failure) {
        onError(messageOf(failure))
      }
      return undefined
    },
    [onError]
  )

  const trigger = useCallback(
    async (combos: BuildWebCombo[], pushAfter: BuildWebPushAfter, skipTests: boolean) => {
      if (combos.length === 0) {
        return
      }
      setBusy(true)
      const done = await write(() => call('buildCombos', { runId, combos, pushAfter, skipTests }))
      setBusy(false)
      if (done) {
        watch(AFTER_BUILD_MS)
      }
    },
    [call, runId, watch, write]
  )

  const cancel = useCallback(
    async (cell: Cell) => {
      const key = cellKey(cell)
      setCancelling((s) => new Set([...s, key]))
      const done = await write(() => call('cancelBuild', { runId, combo: comboOf(cell) }))
      if (done) {
        watch(AFTER_BUILD_MS)
      } else {
        setCancelling((s) => new Set([...s].filter((k) => k !== key)))
      }
    },
    [call, runId, watch, write]
  )

  /** IS-230: derive a failed redos twin again; the console publishes its build tag. */
  const retryTwin = useCallback(
    async (cell: Cell) => {
      const key = cellKey(cell)
      setRetrying((m) => new Map([...m, [key, Date.now()]]))
      const done = await write(() =>
        call('retryRedosTwin', { runId, image: cell.image, branch: cell.branch })
      )
      if (done) {
        setRetrying((m) => new Map([...m, [key, Date.now()]]))
        watch(AFTER_PUSH_MS)
      } else {
        setRetrying((m) => new Map([...m].filter(([k]) => k !== key)))
      }
    },
    [call, runId, watch, write]
  )

  const push = useCallback(
    async (cells: Cell[], moveMainTag: boolean) => {
      if (cells.length === 0) {
        return
      }
      const keys = cells.map(cellKey)
      setPushingKeys((s) => new Set([...s, ...keys]))
      const done = await write(() =>
        call('pushImages', { runId, combos: cells.map(comboOf), moveMainTag })
      )
      if (done) {
        notify('Push started — build-web publishes the tags.', 'success')
        watch(AFTER_PUSH_MS)
      } else {
        setPushingKeys((s) => new Set([...s].filter((k) => !keys.includes(k))))
      }
    },
    [call, notify, runId, watch, write]
  )

  const add = useCallback(
    async (combos: BuildWebCombo[]): Promise<boolean> => {
      setBusy(true)
      const updated = await write(() => call('addRunImages', { runId, combos }))
      setBusy(false)
      if (updated === undefined) {
        return false
      }
      if (updated) {
        apply(updated)
      } else {
        setCells((shown) => {
          const next = { ...shown }
          for (const combo of combos) {
            next[cellKey(combo)] = {
              ...combo,
              state: 'pending',
              number: null,
              url: null,
              status: null,
              tags: [],
              pushed: false,
              mainTagSkipped: false,
              skippedTags: [],
              startedAt: null,
              testsSkipped: false,
              twin: null,
              note: null
            }
          }
          return next
        })
      }
      return true
    },
    [apply, call, runId, setCells, write]
  )

  const remove = useCallback(
    async (combo: BuildWebCombo): Promise<boolean> => {
      const updated = await write(() => call('removeRunImages', { runId, combos: [combo] }))
      if (updated) {
        apply(updated, false)
      }
      return updated !== undefined
    },
    [apply, call, runId, write]
  )

  /** Ask the build server how pending or lost builds stand; `silent` on the tab's own opening. */
  const detect = useCallback(
    async (silent: boolean) => {
      setDetecting(true)
      try {
        const result = await call('detectBuilt', { runId })
        if (result.ok && result.value) {
          apply(result.value)
        } else if (!result.ok && !silent) {
          onError(result.error)
        }
      } catch (failure) {
        if (!silent) {
          onError(messageOf(failure))
        }
      } finally {
        setDetecting(false)
      }
    },
    [apply, call, onError, runId]
  )

  return {
    busy,
    detecting,
    pushingKeys,
    cancelling,
    retrying,
    trigger,
    cancel,
    retryTwin,
    push,
    add,
    remove,
    detect
  }
}

export type RunActions = ReturnType<typeof useRunActions>
