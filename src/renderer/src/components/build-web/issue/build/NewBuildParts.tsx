import { Checkbox } from '@/components/ui/checkbox'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { BuildWebTestingStatus } from '../../../../../../shared/build-web-run-types'
import { BuildWebToneChip } from '../../BuildWebToneChip'
import type { ChipTone } from '../../build-web-tones'

// The pieces of a task's first-build form: its steps, its read-only fields and the image rows.

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
