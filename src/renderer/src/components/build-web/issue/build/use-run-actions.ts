import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebCombo,
  BuildWebPushAfter,
  BuildWebRun
} from '../../../../../../shared/build-web-run-types'
import type { BuildWebMutationResult } from '../../../../../../shared/build-web-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../../build-web-client'
import { useBuildWebBadgeKick } from '../../../sidebar/use-build-web-badge'
import { cellKey, comboOf, type Cell } from './run-cells'

// How long the tab keeps re-reading the run after it started something on the console.
const AFTER_BUILD_MS = 30_000
const AFTER_PUSH_MS = 180_000

const messageOf = (failure: unknown) =>
  failure instanceof Error ? failure.message : String(failure)

/** What the Build tab does to its run: build, cancel, push, add, remove, detect. */
export function useRunActions(args: {
  target: RuntimeClientTarget
  runId: string
  apply: (fresh: BuildWebRun, merge?: boolean) => void
  setCells: React.Dispatch<React.SetStateAction<Record<string, Cell>>>
  watch: (ms: number) => void
  onError: (message: string | null) => void
}) {
  const { target, runId, apply, setCells, watch, onError } = args
  const kickBadge = useBuildWebBadgeKick()
  const [busy, setBusy] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [pushingKeys, setPushingKeys] = useState<ReadonlySet<string>>(new Set())
  const [cancelling, setCancelling] = useState<ReadonlySet<string>>(new Set())

  /** One write; a refusal goes to the tab's error line. */
  const write = useCallback(
    async <T>(call: () => Promise<BuildWebMutationResult<T>>): Promise<T | undefined> => {
      onError(null)
      try {
        const result = await call()
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
      const done = await write(() =>
        callBuildWeb(target, 'buildCombos', { runId, combos, pushAfter, skipTests })
      )
      setBusy(false)
      if (done) {
        watch(AFTER_BUILD_MS)
        kickBadge()
      }
    },
    [kickBadge, runId, target, watch, write]
  )

  const cancel = useCallback(
    async (cell: Cell) => {
      const key = cellKey(cell)
      setCancelling((s) => new Set([...s, key]))
      const done = await write(() =>
        callBuildWeb(target, 'cancelBuild', { runId, combo: comboOf(cell) })
      )
      if (done) {
        watch(AFTER_BUILD_MS)
      } else {
        setCancelling((s) => new Set([...s].filter((k) => k !== key)))
      }
    },
    [runId, target, watch, write]
  )

  const push = useCallback(
    async (cells: Cell[], moveMainTag: boolean) => {
      if (cells.length === 0) {
        return
      }
      const keys = cells.map(cellKey)
      setPushingKeys((s) => new Set([...s, ...keys]))
      const done = await write(() =>
        callBuildWeb(target, 'pushImages', { runId, combos: cells.map(comboOf), moveMainTag })
      )
      if (done) {
        toast.success(
          translate('buildWeb.images.pushStarted', 'Push started — build-web publishes the tags.')
        )
        watch(AFTER_PUSH_MS)
      } else {
        setPushingKeys((s) => new Set([...s].filter((k) => !keys.includes(k))))
      }
    },
    [runId, target, watch, write]
  )

  const add = useCallback(
    async (combos: BuildWebCombo[]): Promise<boolean> => {
      setBusy(true)
      const updated = await write(() => callBuildWeb(target, 'addRunImages', { runId, combos }))
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
              testsSkipped: false
            }
          }
          return next
        })
      }
      return true
    },
    [apply, runId, setCells, target, write]
  )

  const remove = useCallback(
    async (combo: BuildWebCombo): Promise<boolean> => {
      const updated = await write(() =>
        callBuildWeb(target, 'removeRunImages', { runId, combos: [combo] })
      )
      if (updated) {
        apply(updated, false)
      }
      return updated !== undefined
    },
    [apply, runId, target, write]
  )

  /** Ask the build server how pending or lost builds stand; `silent` on the tab's own opening. */
  const detect = useCallback(
    async (silent: boolean) => {
      setDetecting(true)
      try {
        const result = await callBuildWeb(target, 'detectBuilt', { runId })
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
    [apply, onError, runId, target]
  )

  return {
    busy,
    detecting,
    pushingKeys,
    cancelling,
    trigger,
    cancel,
    push,
    add,
    remove,
    detect
  }
}

export type RunActions = ReturnType<typeof useRunActions>
