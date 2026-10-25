import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type {
  BuildWebIssueBuildBranch,
  BuildWebTestingStatus
} from '../../../../../../shared/build-web-run-types'
import { BuildWebToneChip } from '../../BuildWebToneChip'
import type { ChipTone } from '../../build-web-tones'

// The pieces of a task's first-build form: its steps, its read-only fields, the image and branch rows.

export type Origin = 'found' | 'suggested' | 'manual'
export type Row = { image: string; branch: string; why: string; origin: Origin }
export const rowKey = (r: { image: string; branch: string }) => `${r.image}|${r.branch}`

function originChip(origin: Origin): { label: string; tone: ChipTone | null } {
  switch (origin) {
    case 'found':
      return { label: translate('buildWeb.newBuild.found', 'found'), tone: 'blue' }
    case 'suggested':
      return { label: translate('buildWeb.newBuild.suggested', 'suggested'), tone: 'sky' }
    case 'manual':
      return { label: translate('buildWeb.newBuild.manual', 'manual'), tone: null }
  }
}

export function testingNote(testing: BuildWebTestingStatus): string {
  switch (testing) {
    case 'Testing':
      return translate(
        'buildWeb.newBuild.noteTesting',
        'Testing: images are not published; the watcher publishes them when the task reaches Done.'
      )
    case 'TESTING_EXTERNAL':
      return translate(
        'buildWeb.newBuild.noteExternal',
        'TESTING_EXTERNAL: the build tag is published right after the build.'
      )
    case 'Done':
      return translate(
        'buildWeb.newBuild.noteDone',
        'Done: the train moves the task straight to Done and publishes every image, main tag included.'
      )
  }
}

export function Step({
  n,
  on,
  title,
  children
}: {
  n: number
  on: boolean
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
          on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}
      >
        {n}
      </span>
      <h3 className="flex-1 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  )
}

export function ReadOnlyField({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex h-8 items-center truncate rounded-md border border-border bg-muted/50 px-3 font-mono text-xs">
        {value}
      </span>
    </div>
  )
}

/** The images the form offers, each ticked or not; a click anywhere on the row toggles it. */
export function NewBuildRows({
  rows,
  off,
  branch,
  onToggle
}: {
  rows: Row[]
  off: ReadonlySet<string>
  branch: string
  onToggle: (key: string, on: boolean) => void
}): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="grid min-h-8 grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_110px] items-center bg-muted/50 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        <span />
        <span>{translate('buildWeb.images.image', 'Image')}</span>
        <span>{translate('buildWeb.newBuild.why', 'Why')}</span>
        <span>{translate('buildWeb.newBuild.origin', 'From')}</span>
      </div>
      {rows.map((r) => {
        const key = rowKey(r)
        const on = !off.has(key)
        const chip = originChip(r.origin)
        return (
          <label
            key={key}
            className={cn(
              'grid min-h-10 cursor-pointer grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_110px] items-center border-t border-border/60 text-xs',
              !on && 'bg-muted/40'
            )}
          >
            <span className="flex justify-center">
              <Checkbox emphasis="strong" checked={on} onCheckedChange={() => onToggle(key, !on)} />
            </span>
            <span className="truncate font-mono">
              {r.image}
              {r.branch !== branch ? (
                <span className="text-muted-foreground"> · {r.branch}</span>
              ) : null}
            </span>
            <span className="truncate pr-2 text-muted-foreground" title={r.why}>
              {r.why}
            </span>
            <span>
              <BuildWebToneChip label={chip.label} tone={chip.tone} />
            </span>
          </label>
        )
      })}
      {rows.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">
          {translate(
            'buildWeb.newBuild.none',
            'The task’s commits touch no image — add the one you need by hand.'
          )}
        </p>
      ) : null}
    </div>
  )
}

/** The release branches the build reaches; the release's own is always built, the rest may be left out. */
function ReleaseBranchRows({
  branches,
  off,
  onToggle
}: {
  branches: readonly BuildWebIssueBuildBranch[]
  off: ReadonlySet<string>
  onToggle: (branch: string, on: boolean) => void
}): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      {branches.map((b, i) => {
        const on = b.primary || !off.has(b.branch)
        return (
          <label
            key={b.branch}
            className={cn(
              'flex min-h-10 items-center gap-3 px-3 text-xs',
              i > 0 && 'border-t border-border/60',
              b.primary ? 'cursor-default' : 'cursor-pointer',
              !on && 'bg-muted/40'
            )}
          >
            <Checkbox
              emphasis="strong"
              checked={on}
              disabled={b.primary}
              onCheckedChange={() => onToggle(b.branch, !on)}
            />
            <span className="min-w-0 flex-1 truncate font-mono">{b.branch}</span>
            {b.primary ? (
              <BuildWebToneChip
                label={translate('buildWeb.newBuild.releaseBranch', 'task’s release')}
                tone="blue"
              />
            ) : b.has_commits ? null : (
              <span className="text-muted-foreground">
                {translate(
                  'buildWeb.newBuild.noCommitsYet',
                  'no commits yet — added when they arrive'
                )}
              </span>
            )}
            {b.on_run ? (
              <BuildWebToneChip
                label={translate('buildWeb.newBuild.onRun', 'already built')}
                tone={null}
              />
            ) : null}
          </label>
        )
      })}
    </div>
  )
}

/** The versions the build reaches, with a word on what unticking one does; nothing when there is one. */
export function ReleaseBranchChoice({
  branches,
  off,
  onChange
}: {
  branches: readonly BuildWebIssueBuildBranch[]
  off: ReadonlySet<string>
  onChange: (off: ReadonlySet<string>) => void
}): React.JSX.Element | null {
  if (branches.length < 2) {
    return null
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {translate(
          'buildWeb.newBuild.versions',
          'Versions the images are built for: the task’s release, and each newer one its commits reach. Untick one to leave it out of this task’s builds.'
        )}
      </p>
      <ReleaseBranchRows
        branches={branches}
        off={off}
        onToggle={(name, on) => {
          const next = new Set(off)
          if (on) {
            next.delete(name)
          } else {
            next.add(name)
          }
          onChange(next)
        }}
      />
    </div>
  )
}

/** The branch the build is made from: the release's own unless another is picked by hand. */
export function BuildBranchField({
  branch,
  releaseBranch,
  options,
  onChange
}: {
  branch: string
  releaseBranch: string
  options: readonly string[]
  onChange: (branch: string) => void
}): React.JSX.Element {
  return (
    <div className="flex min-w-64 flex-[2] flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">
        {translate('buildWeb.newBuild.branch', 'Branch')}{' '}
        <span className="text-primary">
          ·{' '}
          {branch === releaseBranch
            ? translate('buildWeb.newBuild.fromRelease', 'from the task’s release')
            : translate('buildWeb.newBuild.byHand', 'chosen by hand')}
        </span>
      </span>
      <Select value={branch} onValueChange={onChange}>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((b) => (
            <SelectItem key={b} value={b}>
              {b}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
