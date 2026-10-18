import { Play, RotateCw, CircleStop, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebBuildFreshness,
  BuildWebCombo,
  BuildWebLastBuilt,
  BuildWebPushAfter
} from '../../../../../../shared/build-web-run-types'
import { BuildWebToneChip } from '../../BuildWebToneChip'
import { useBuildLogViewer } from '../../images/build-log-viewer'
import { comboOf, isSelectable, type Cell } from './run-cells'
import {
  CellStateChip,
  FreshnessChip,
  LastBuiltChips,
  RegistryChip,
  TipChip,
  formatAt
} from './RunCellChips'
import { BuildMenu } from './RunMenus'

/** The columns: pick, image, dist, state, freshness, registry, actions. */
export const RUN_ROW_GRID =
  'grid grid-cols-[32px_minmax(0,1fr)_56px_150px_150px_150px_290px] items-center gap-x-2 pr-3'

export type RunRowContext = {
  runBranch: string
  ticket: string | null
  now: number
  busy: boolean
  building: boolean
  /** A push is running somewhere on the run. */
  pushingAny: boolean
  treeBranches: ReadonlySet<string>
  testDirs: Record<string, string[]>
  baseUrl: string | null
  onBuild: (combos: BuildWebCombo[], pushAfter: BuildWebPushAfter, skipTests: boolean) => void
  onPush: (cells: Cell[], moveMainTag: boolean) => void
  onCancel: (cell: Cell) => void
  onRemove: (combo: BuildWebCombo) => void
}

function IconAction({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function RunImageRow({
  cell: c,
  picked,
  onPick,
  pushing,
  cancelling,
  lastBuilt,
  freshness,
  ctx
}: {
  cell: Cell
  picked: boolean
  onPick: () => void
  pushing: boolean
  cancelling: boolean
  lastBuilt: BuildWebLastBuilt | undefined
  freshness: BuildWebBuildFreshness | undefined
  ctx: RunRowContext
}): React.JSX.Element {
  const live = c.state === 'queued' || c.state === 'building'
  const testDirs = ctx.testDirs[c.image] ?? []
  const meta = [c.number !== null ? `#${c.number}` : null, formatAt(c.startedAt)]
    .filter(Boolean)
    .join(' · ')
  const buildTrigger = (icon: React.ReactNode, label: string) => (
    <BuildMenu
      combos={[comboOf(c)]}
      treeBranches={ctx.treeBranches}
      disabled={ctx.busy}
      onBuild={ctx.onBuild}
    >
      <Button variant="ghost" size="icon-xs" aria-label={label} title={label}>
        {icon}
      </Button>
    </BuildMenu>
  )
  return (
    <div className={`${RUN_ROW_GRID} min-h-11 border-b border-border/60 text-xs last:border-b-0`}>
      <div className="flex justify-center">
        {isSelectable(c) ? (
          <Checkbox
            emphasis="strong"
            checked={picked}
            onCheckedChange={onPick}
            aria-label={translate('buildWeb.run.selectRow', 'Select {{image}} ({{dist}})', {
              image: c.image,
              dist: c.dist
            })}
          />
        ) : null}
      </div>
      <div className="min-w-0 py-1">
        <div className="truncate font-mono">{c.image}</div>
        {c.branch !== ctx.runBranch ? (
          <div className="truncate font-mono text-2xs text-muted-foreground" title={c.branch}>
            {c.branch}
          </div>
        ) : null}
      </div>
      <span className="text-muted-foreground">{c.dist}</span>
      <div className="min-w-0">
        <CellStateChip cell={c} now={ctx.now} />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 py-1">
        {c.testsSkipped && c.state !== 'pending' ? (
          <TipChip
            label={translate('buildWeb.run.noTests', 'no tests')}
            tone="amber"
            tip={translate(
              'buildWeb.run.noTestsTip',
              'Built without «Run tests»: the tree’s suites did not check this image'
            )}
          />
        ) : null}
        {c.state === 'pending' && lastBuilt ? <LastBuiltChips entry={lastBuilt} /> : null}
        {c.state === 'done' && c.status === 'SUCCESS' && freshness ? (
          <FreshnessChip freshness={freshness} ticket={ctx.ticket} />
        ) : null}
      </div>
      <div className="min-w-0">
        <RegistryChip
          cell={c}
          pushing={pushing}
          queueing={ctx.pushingAny}
          menuDisabled={ctx.building || ctx.busy}
          onPush={ctx.onPush}
        />
      </div>
      <div className="flex items-center justify-end gap-1">
        {c.url ? (
          <button
            type="button"
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => {
              if (c.url) {
                useBuildLogViewer
                  .getState()
                  .show(c.url, `${c.image} (${c.dist})${c.number !== null ? ` #${c.number}` : ''}`)
              }
            }}
          >
            {translate('buildWeb.run.console', 'console')}
          </button>
        ) : null}
        {meta ? (
          <span
            className="truncate font-mono text-2xs text-muted-foreground"
            title={c.tags.join('\n')}
          >
            {meta}
          </span>
        ) : null}
        {c.state === 'done' && testDirs.length > 0 && ctx.baseUrl ? (
          <button
            type="button"
            className="shrink-0 hover:opacity-80"
            title={translate(
              'buildWeb.run.testsTip',
              'Run the tests of {{n}} workspace(s) of this image in build-web',
              { n: String(testDirs.length) }
            )}
            onClick={() =>
              void window.api.shell.openUrl(
                `${ctx.baseUrl}/tests?preselect=${encodeURIComponent(testDirs.join(','))}`
              )
            }
          >
            <BuildWebToneChip
              label={translate('buildWeb.run.testsCount', 'Tests · {{n}}', {
                n: String(testDirs.length)
              })}
              tone={null}
            />
          </button>
        ) : null}
        {live ? (
          <IconAction
            label={translate('buildWeb.run.cancel', 'Cancel this build')}
            disabled={cancelling}
            onClick={() => ctx.onCancel(c)}
          >
            <CircleStop />
          </IconAction>
        ) : null}
        {c.state === 'pending'
          ? buildTrigger(
              <Play className="text-primary" />,
              translate('buildWeb.run.buildOne', 'Build this image — and choose what it publishes')
            )
          : null}
        {c.state === 'done'
          ? buildTrigger(
              <RotateCw />,
              translate('buildWeb.run.rebuildOne', 'Rebuild — and choose what it publishes')
            )
          : null}
        {c.state === 'pending' || c.state === 'done' ? (
          <IconAction
            label={translate('buildWeb.run.removeOne', 'Remove from list')}
            disabled={ctx.building || ctx.busy}
            onClick={() => ctx.onRemove(comboOf(c))}
          >
            <Trash2 />
          </IconAction>
        ) : null}
      </div>
    </div>
  )
}
