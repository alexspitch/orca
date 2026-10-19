import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { BuildWebWatchRun } from '../../../../../shared/build-web-watch-types'
import type { BuildWebCombo, BuildWebPushAfter } from '../../../../../shared/build-web-run-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { BuildWebToneChip } from '../BuildWebToneChip'
import type { ChipTone } from '../build-web-tones'
import { BuildMenu, PushMenu } from '../issue/build/RunMenus'
import { cellsOf, comboOf, type Cell } from '../issue/build/run-cells'
import { isPushOver, pushKeyOf, useImagePushes } from '../images/image-push-runs'
import { useBuildWebBadgeKick } from '../../sidebar/use-build-web-badge'
import { workCells, type WorkChip } from './testing-rows'

const messageOf = (failure: unknown) =>
  failure instanceof Error ? failure.message : String(failure)

/**
 * One chip of the work column. To build, to push and the version tag open the Build tab's own
 * menus, filled from the run as it stands when the menu opens; images building, and a token that
 * may not write runs, open the task's build instead.
 */
export function TestingWorkChip({
  target,
  run,
  chip,
  label,
  hint,
  tone,
  canWrite,
  treeBranches,
  onOpen,
  onStarted
}: {
  target: RuntimeClientTarget
  run: BuildWebWatchRun
  chip: WorkChip
  label: string
  hint: string
  tone: ChipTone | null
  canWrite: boolean
  treeBranches: ReadonlySet<string>
  onOpen: () => void
  /** A build was started or nothing was left: the list is read again. */
  onStarted: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [cells, setCells] = useState<Cell[]>([])
  const [reading, setReading] = useState(false)
  const pushing = useImagePushes((s) =>
    s.pushes.some((p) => p.runId === run.id && !isPushOver(s.progress[p.runId]))
  )
  const track = useImagePushes((s) => s.track)
  const kickBadge = useBuildWebBadgeKick()
  const acts = canWrite && chip.kind !== 'flight'
  const busy = reading || (pushing && (chip.kind === 'push' || chip.kind === 'tag'))

  // Why read on opening: the list is minutes old, and a push names exactly the rows it publishes.
  const reveal = async (): Promise<void> => {
    setReading(true)
    try {
      const fresh = await callBuildWeb(target, 'getRun', { runId: run.id })
      const rows = workCells(Object.values(cellsOf(fresh?.builds ?? [])), chip.kind)
      if (rows.length === 0) {
        toast.message(
          translate(
            'buildWeb.testing.nothingLeft',
            'Nothing left to do here — the list is read again.'
          )
        )
        onStarted()
        return
      }
      setCells(rows)
      setOpen(true)
    } catch (failure) {
      toast.error(messageOf(failure))
    } finally {
      setReading(false)
    }
  }
  const onOpenChange = (next: boolean) => (next ? void reveal() : setOpen(false))

  const push = async (rows: Cell[], moveMainTag: boolean): Promise<void> => {
    try {
      const result = await callBuildWeb(target, 'pushImages', {
        runId: run.id,
        combos: rows.map(comboOf),
        moveMainTag
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      track({ runId: run.id, keys: rows.map(pushKeyOf), startedAt: Date.now() })
      toast.success(
        translate('buildWeb.images.pushStarted', 'Push started — build-web publishes the tags.')
      )
    } catch (failure) {
      toast.error(messageOf(failure))
    }
  }

  const build = async (
    combos: BuildWebCombo[],
    pushAfter: BuildWebPushAfter,
    skipTests: boolean
  ): Promise<void> => {
    try {
      const result = await callBuildWeb(target, 'buildCombos', {
        runId: run.id,
        combos,
        pushAfter,
        skipTests
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(translate('buildWeb.testing.buildStarted', 'Build started on build-web.'))
      kickBadge()
      onStarted()
    } catch (failure) {
      toast.error(messageOf(failure))
    }
  }

  const face = (
    <TooltipTrigger asChild>
      <button
        type="button"
        disabled={busy}
        onClick={acts ? undefined : onOpen}
        className="inline-flex items-center gap-1 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
        <BuildWebToneChip label={label} tone={tone} />
      </button>
    </TooltipTrigger>
  )
  return (
    // Why closed with the menu: the hint would sit over the choices it describes.
    <Tooltip open={open ? false : undefined}>
      {!acts ? (
        face
      ) : chip.kind === 'build' ? (
        <BuildMenu
          combos={cells.map(comboOf)}
          treeBranches={treeBranches}
          disabled={busy}
          open={open}
          onOpenChange={onOpenChange}
          onBuild={(combos, pushAfter, skipTests) => void build(combos, pushAfter, skipTests)}
        >
          {face}
        </BuildMenu>
      ) : (
        <PushMenu
          cells={cells}
          disabled={busy}
          open={open}
          onOpenChange={onOpenChange}
          onPush={(rows, moveMainTag) => void push(rows, moveMainTag)}
        >
          {face}
        </PushMenu>
      )}
      <TooltipContent side="top" sideOffset={4}>
        {hint}
      </TooltipContent>
    </Tooltip>
  )
}
