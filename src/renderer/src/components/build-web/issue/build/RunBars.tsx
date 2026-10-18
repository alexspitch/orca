import { useState } from 'react'
import { ChevronDown, Copy, Loader2, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebCombo,
  BuildWebFreshnessRef,
  BuildWebPushAfter
} from '../../../../../../shared/build-web-run-types'
import { RUN_DISTS, RUN_PRODUCT_FILTERS, type RunFilter } from '../../build-web-view-prefs'
import { comboOf, type Cell } from './run-cells'
import { formatAt } from './RunCellChips'
import { BuildMenu, PushMenu } from './RunMenus'
import { ImagePicker } from './ImagePicker'

// The strips around a task's image list, after build-web's Progress: what the rows are measured
// against, how the list is narrowed, what the ticked rows can do, and how a row is added.

export function RunRefBar({
  refs,
  ticket,
  scanning,
  note,
  onRescan
}: {
  refs: BuildWebFreshnessRef[]
  ticket: string | null
  scanning: boolean
  note: string | null
  onRescan: () => void
}): React.JSX.Element | null {
  if (refs.length === 0 && !scanning) {
    return null
  }
  return (
    <div className="flex flex-col gap-1 rounded-md bg-muted/50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-muted-foreground">
          {ticket
            ? translate('buildWeb.run.ticketCommit', 'last commit of {{ticket}}', { ticket })
            : translate('buildWeb.run.lastCommit', 'last commit')}
        </span>
        {refs.map((r) => (
          <span
            key={r.branch}
            className="font-mono"
            title={`${r.commit.slice(0, 12)} — ${r.subject}`}
          >
            <b>{r.branch}</b> · {formatAt(r.date) ?? r.date}
          </span>
        ))}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="xs"
          disabled={scanning}
          onClick={onRescan}
          title={translate(
            'buildWeb.run.rescanTip',
            'Fetch from Bitbucket and compare every built image with its branch again'
          )}
        >
          {scanning ? <Loader2 className="animate-spin" /> : <RotateCw />}
          {scanning
            ? translate('buildWeb.run.scanning', 'Scanning…')
            : translate('buildWeb.run.rescan', 'Rescan')}
        </Button>
      </div>
      {note ? <p className="text-2xs text-muted-foreground">{note}</p> : null}
    </div>
  )
}

export function RunFilters({
  filter,
  onFilter,
  hidePending,
  onHidePending,
  shown,
  total
}: {
  filter: RunFilter
  onFilter: (filter: RunFilter) => void
  hidePending: boolean
  onHidePending: (on: boolean) => void
  shown: number
  total: number
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <span className="text-muted-foreground">{translate('buildWeb.run.dist', 'dist')}</span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={filter.dist}
        onValueChange={(v) => {
          const dist = RUN_DISTS.find((d) => d === v)
          if (dist) {
            onFilter({ ...filter, dist })
          }
        }}
      >
        {RUN_DISTS.map((d) => (
          <ToggleGroupItem key={d} value={d}>
            {d}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <span className="text-muted-foreground">{translate('buildWeb.run.product', 'product')}</span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={filter.product}
        onValueChange={(v) => {
          const product = RUN_PRODUCT_FILTERS.find((p) => p === v)
          if (product) {
            onFilter({ ...filter, product })
          }
        }}
      >
        {RUN_PRODUCT_FILTERS.map((p) => (
          <ToggleGroupItem key={p} value={p}>
            {p}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <label className="flex items-center gap-2">
        <Checkbox
          emphasis="strong"
          checked={hidePending}
          onCheckedChange={(v) => onHidePending(v === true)}
        />
        {translate('buildWeb.run.hidePending', 'Hide pending')}
      </label>
      <div className="flex-1" />
      <span className="text-muted-foreground">
        {translate('buildWeb.run.shownOf', '{{shown}} of {{total}}', {
          shown: String(shown),
          total: String(total)
        })}
      </span>
    </div>
  )
}

const caret = <ChevronDown className="size-3 opacity-60" />

export function RunSelectionBar({
  selectable,
  picked,
  links,
  stale,
  failed,
  unpushed,
  busy,
  building,
  treeBranches,
  onPickAll,
  onCopy,
  onBuild,
  onPush
}: {
  selectable: number
  picked: number
  links: string[]
  stale: Cell[]
  failed: Cell[]
  unpushed: Cell[]
  busy: boolean
  building: boolean
  treeBranches: ReadonlySet<string>
  onPickAll: (on: boolean) => void
  onCopy: () => Promise<boolean>
  onBuild: (combos: BuildWebCombo[], pushAfter: BuildWebPushAfter, skipTests: boolean) => void
  onPush: (cells: Cell[], moveMainTag: boolean) => void
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const allPicked = selectable > 0 && picked === selectable
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Checkbox
        emphasis="strong"
        checked={allPicked ? true : picked > 0 ? 'indeterminate' : false}
        onCheckedChange={(v) => onPickAll(v === true)}
        aria-label={
          allPicked
            ? translate('buildWeb.run.clearSelection', 'Clear the selection')
            : translate('buildWeb.run.selectAll', 'Select every finished image shown')
        }
      />
      <span className="text-muted-foreground">
        {picked > 0
          ? translate('buildWeb.run.selected', '{{n}} selected · {{links}} reference(s)', {
              n: String(picked),
              links: String(links.length)
            })
          : translate(
              'buildWeb.run.selectHint',
              'select images to build, publish or copy their references'
            )}
      </span>
      <div className="flex-1" />
      <Button
        variant="outline"
        size="xs"
        disabled={links.length === 0}
        title={links.join('\n') || undefined}
        onClick={() =>
          void onCopy().then((ok) => {
            if (ok) {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            }
          })
        }
      >
        <Copy />
        {copied
          ? translate('buildWeb.run.copied', 'Copied')
          : translate('buildWeb.run.copyLinks', 'Copy links')}
      </Button>
      <BuildMenu
        combos={stale.map(comboOf)}
        treeBranches={treeBranches}
        disabled={stale.length === 0 || busy}
        onBuild={onBuild}
      >
        <Button variant="outline" size="xs">
          <RotateCw />
          {translate('buildWeb.run.rebuildStale', 'Rebuild stale ({{n}})', {
            n: String(stale.length)
          })}
          {caret}
        </Button>
      </BuildMenu>
      <BuildMenu
        combos={failed.map(comboOf)}
        treeBranches={treeBranches}
        disabled={failed.length === 0 || busy}
        onBuild={onBuild}
      >
        <Button variant="outline" size="xs">
          <RotateCw />
          {translate('buildWeb.run.rebuildFailed', 'Rebuild failed ({{n}})', {
            n: String(failed.length)
          })}
          {caret}
        </Button>
      </BuildMenu>
      <PushMenu
        cells={unpushed}
        disabled={unpushed.length === 0 || building || busy}
        onPush={onPush}
      >
        <Button variant="outline" size="xs">
          {translate('buildWeb.run.publish', 'Publish ({{n}})', { n: String(unpushed.length) })}
          {caret}
        </Button>
      </PushMenu>
    </div>
  )
}

export function RunAddImage({
  images,
  branches,
  runBranch,
  defaultDist,
  disabled,
  onAdd
}: {
  images: string[]
  branches: string[]
  runBranch: string
  defaultDist: string
  disabled: boolean
  onAdd: (image: string, dist: string, branch: string) => Promise<boolean>
}): React.JSX.Element {
  const [image, setImage] = useState<string | null>(null)
  const [dist, setDist] = useState(
    defaultDist === 'rhel' || defaultDist === 'redos' ? defaultDist : 'both'
  )
  // The branch last used: the common case is a series of images on one branch.
  const [branch, setBranch] = useState(runBranch)
  const offered = branches.includes(runBranch) ? branches : [runBranch, ...branches]
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <ImagePicker
        images={images}
        value={image}
        onChange={setImage}
        className="w-[min(380px,100%)] flex-1"
      />
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={dist}
        disabled={disabled}
        onValueChange={(v) => v && setDist(v)}
      >
        {['rhel', 'redos', 'both'].map((d) => (
          <ToggleGroupItem key={d} value={d}>
            {d}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Select value={branch} onValueChange={setBranch} disabled={disabled}>
        <SelectTrigger size="sm" className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {offered.map((b) => (
            <SelectItem key={b} value={b}>
              {b}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        disabled={!image || disabled}
        onClick={() => {
          if (image) {
            void onAdd(image, dist, branch).then((ok) => ok && setImage(null))
          }
        }}
      >
        {translate('buildWeb.run.add', 'Add')}
      </Button>
    </div>
  )
}
