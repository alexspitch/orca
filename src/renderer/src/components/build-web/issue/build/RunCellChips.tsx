import { Loader2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type {
  BuildWebBuildFreshness,
  BuildWebLastBuilt
} from '../../../../../../shared/build-web-run-types'
import { BuildWebToneChip } from '../../BuildWebToneChip'
import type { ChipTone } from '../../build-web-tones'
import { cellLabel, type Cell } from './run-cells'
import { PushMenu } from './RunMenus'

// The chips of one image row, after build-web's Progress: its state, how it stands against its
// branch, and where it is in the registry — each with the reason in its tooltip.

/** «2026-08-12 14:03» in the reader's own time zone. */
export function formatAt(iso: string | null): string | null {
  if (!iso) {
    return null
  }
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) {
    return null
  }
  const p = (n: number) => String(n).padStart(2, '0')
  return `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())} ${p(at.getHours())}:${p(at.getMinutes())}`
}

export function TipChip({
  label,
  tone,
  tip,
  onClick,
  icon
}: {
  label: string
  tone: ChipTone | null
  tip: string
  onClick?: () => void
  icon?: React.ReactNode
}): React.JSX.Element {
  const chip = (
    <span className="inline-flex items-center gap-1">
      {icon}
      <BuildWebToneChip label={label} tone={tone} />
    </span>
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {onClick ? (
          <button type="button" onClick={onClick} className="cursor-pointer hover:opacity-80">
            {chip}
          </button>
        ) : (
          chip
        )}
      </TooltipTrigger>
      <TooltipContent className="max-w-sm whitespace-pre-line">{tip}</TooltipContent>
    </Tooltip>
  )
}

function stateTone(cell: Cell): ChipTone | null {
  if (cell.state === 'pending') {
    return null
  }
  if (cell.state !== 'done') {
    return 'blue'
  }
  switch (cell.status ?? '') {
    case 'SUCCESS':
      return 'green'
    case 'FAILURE':
    case 'ERROR':
    case 'trigger-failed':
      return 'red'
    case 'ABORTED':
    case 'UNSTABLE':
      return 'amber'
    default:
      return null
  }
}

export function CellStateChip({ cell, now }: { cell: Cell; now: number }): React.JSX.Element {
  const live = cell.state === 'queued' || cell.state === 'building'
  return (
    <span className="inline-flex items-center gap-1">
      {live ? <Loader2 className="size-3 animate-spin text-chip-tone-blue" /> : null}
      <BuildWebToneChip label={cellLabel(cell, now)} tone={stateTone(cell)} />
    </span>
  )
}

function lastBuiltLabel(state: BuildWebLastBuilt['state']): string {
  switch (state) {
    case 'up-to-date':
      return translate('buildWeb.run.noChanges', 'no changes')
    case 'changed':
      return translate('buildWeb.run.changed', 'changed')
    case 'never-built':
      return translate('buildWeb.run.neverBuilt', 'never built')
    case 'no-image':
      return translate('buildWeb.run.noImage', 'no image')
    case 'unknown':
      return translate('buildWeb.run.notBuiltHere', 'not built here')
  }
}

function lastBuiltTip(e: BuildWebLastBuilt): string {
  switch (e.state) {
    case 'up-to-date':
      return translate(
        'buildWeb.run.noChangesTip',
        'Nothing this image is built from changed since build #{{n}} — building it again would produce the same image',
        { n: String(e.build_number ?? '') }
      )
    case 'changed':
      return translate('buildWeb.run.changedTip', 'Changed since build #{{n}}: {{what}}', {
        n: String(e.build_number ?? ''),
        what: e.changed.join(', ') || translate('buildWeb.run.itsSources', 'its sources')
      })
    case 'never-built':
      return translate(
        'buildWeb.run.neverBuiltTip',
        'This version has no CI build tag on this branch yet'
      )
    case 'no-image':
      return translate(
        'buildWeb.run.noImageTip',
        'Nothing changed since build #{{n}}, but no image of it exists for {{dist}} — that build made the other distribution',
        { n: String(e.build_number ?? ''), dist: e.dist }
      )
    case 'unknown':
      return translate(
        'buildWeb.run.notBuiltHereTip',
        'This branch does not build this image for this distribution'
      )
  }
}

export function LastBuiltChips({ entry }: { entry: BuildWebLastBuilt }): React.JSX.Element {
  const tone: ChipTone | null =
    entry.state === 'up-to-date'
      ? 'green'
      : entry.state === 'changed' || entry.state === 'no-image'
        ? 'amber'
        : null
  return (
    <>
      {entry.build_number !== null ? (
        <span className="font-mono text-2xs text-muted-foreground" title={entry.ref ?? undefined}>
          #{entry.build_number}
          {entry.built_at ? ` · ${entry.built_at.slice(0, 10)}` : ''}
          {entry.published === false
            ? ` (${translate('buildWeb.run.notInRegistry', 'not in the registry')})`
            : ''}
        </span>
      ) : null}
      <TipChip label={lastBuiltLabel(entry.state)} tone={tone} tip={lastBuiltTip(entry)} />
    </>
  )
}

function freshnessTip(f: BuildWebBuildFreshness, ticket: string | null): string {
  const made =
    f.built_from === 'build-tag'
      ? translate('buildWeb.run.builtFrom', 'built from a commit of')
      : translate('buildWeb.run.triggered', 'triggered')
  const against = ticket
    ? translate('buildWeb.run.ticketCommit', 'last commit of {{ticket}}', { ticket })
    : translate('buildWeb.run.branchCommit', 'branch last commit')
  const verdict =
    f.state === 'current'
      ? translate('buildWeb.run.containsIt', 'at or after it — this image contains that commit')
      : translate('buildWeb.run.missesIt', 'before it — a newer commit is not in this image')
  const u = f.newer_unpublished
  const unpublished = u
    ? ` ${translate('buildWeb.run.unpublished', 'CI also made #{{n}}, which the registry does not serve.', { n: String(u.build_number) })}`
    : ''
  return `${made} ${formatAt(f.built_at) ?? '—'}, ${against} ${formatAt(f.ref_at) ?? '—'}: ${verdict}.${unpublished}`
}

export function FreshnessChip({
  freshness,
  ticket
}: {
  freshness: BuildWebBuildFreshness
  ticket: string | null
}): React.JSX.Element | null {
  if (freshness.state === 'unknown') {
    return null
  }
  const current = freshness.state === 'current'
  return (
    <TipChip
      label={
        current
          ? translate('buildWeb.run.upToDate', 'up to date')
          : translate('buildWeb.run.needsRebuild', 'needs rebuild')
      }
      tone={current ? 'green' : 'amber'}
      tip={freshnessTip(freshness, ticket)}
    />
  )
}

/** Where a built row stands in the registry; the unpublished ones open the push menu. */
export function RegistryChip({
  cell,
  pushing,
  queueing,
  menuDisabled,
  onPush
}: {
  cell: Cell
  pushing: boolean
  /** A push is running: a click queues this image behind it. */
  queueing: boolean
  menuDisabled: boolean
  onPush: (cells: Cell[], moveMainTag: boolean) => void
}): React.JSX.Element | null {
  if (cell.state !== 'done' || cell.status !== 'SUCCESS') {
    return null
  }
  if (pushing && !cell.pushed) {
    return (
      <span className={cn('inline-flex items-center gap-1')}>
        <Loader2 className="size-3 animate-spin text-chip-tone-amber" />
        <BuildWebToneChip label={translate('buildWeb.run.pushing', 'pushing…')} tone="amber" />
      </span>
    )
  }
  if (cell.pushed && !cell.mainTagSkipped) {
    return <BuildWebToneChip label={translate('buildWeb.images.pushed', 'pushed')} tone="green" />
  }
  if (!cell.pushed && cell.tags.length === 0) {
    return null
  }
  const tip = cell.pushed
    ? cell.skippedTags.length
      ? cell.skippedTags.map((s) => `${s.ref} — ${s.reason}`).join('\n')
      : translate(
          'buildWeb.run.buildTagOnlyTip',
          'Published under the build tag only — the moving tag was left pointing at a newer image already in the registry.'
        )
    : queueing
      ? translate('buildWeb.run.queuePush', 'Queue this image to push after the current one')
      : translate('buildWeb.run.choosePush', 'Click to choose what to publish')
  const label = cell.pushed
    ? translate('buildWeb.run.pushedBuildTagOnly', 'pushed (build tag only)')
    : translate('buildWeb.images.notPushed', 'not pushed')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <PushMenu cells={[cell]} disabled={menuDisabled} onPush={onPush}>
            <button type="button" className="cursor-pointer hover:opacity-80">
              <BuildWebToneChip label={label} tone="amber" />
            </button>
          </PushMenu>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm whitespace-pre-line">{tip}</TooltipContent>
    </Tooltip>
  )
}
