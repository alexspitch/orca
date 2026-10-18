import { cn } from '@/lib/utils'
import type { BuildWebIssueProduct, BuildWebIssueStatus } from '../../../../shared/build-web-types'
import { priorityLabel, productLabel, statusLabel, typeLabel } from './build-web-labels'
import {
  jiraStatusTone,
  priorityTone,
  productTone,
  statusTone,
  typeTone,
  type ChipTone
} from './build-web-tones'

// Text in the hue over the same hue at a fraction, as build-web's ToneChip: a column of repeated
// words is told apart by colour first. Without a tone it is a plain outline.
const TONE_CLASS: Record<ChipTone, string> = {
  neutral: 'border-chip-tone-neutral/40 bg-chip-tone-neutral/15 text-chip-tone-neutral',
  faint: 'border-chip-tone-faint/40 bg-chip-tone-faint/15 text-chip-tone-faint',
  blue: 'border-chip-tone-blue/40 bg-chip-tone-blue/15 text-chip-tone-blue',
  purple: 'border-chip-tone-purple/40 bg-chip-tone-purple/15 text-chip-tone-purple',
  cyan: 'border-chip-tone-cyan/40 bg-chip-tone-cyan/15 text-chip-tone-cyan',
  sky: 'border-chip-tone-sky/40 bg-chip-tone-sky/15 text-chip-tone-sky',
  green: 'border-chip-tone-green/40 bg-chip-tone-green/15 text-chip-tone-green',
  amber: 'border-chip-tone-amber/40 bg-chip-tone-amber/15 text-chip-tone-amber',
  ochre: 'border-chip-tone-ochre/40 bg-chip-tone-ochre/15 text-chip-tone-ochre',
  orange: 'border-chip-tone-orange/40 bg-chip-tone-orange/15 text-chip-tone-orange',
  red: 'border-chip-tone-red/40 bg-chip-tone-red/15 text-chip-tone-red',
  crimson: 'border-chip-tone-crimson/40 bg-chip-tone-crimson/15 text-chip-tone-crimson'
}

export function BuildWebToneChip({
  label,
  tone,
  mono,
  className
}: {
  label: string
  tone: ChipTone | null
  /** For a value read character by character: a release, a tag, a key. */
  mono?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <span
      title={label}
      className={cn(
        'inline-flex h-5 max-w-full items-center rounded-full border px-2 text-2xs whitespace-nowrap',
        mono && 'font-mono',
        tone ? TONE_CLASS[tone] : 'border-border text-muted-foreground',
        className
      )}
    >
      <span className="truncate">{label}</span>
    </span>
  )
}

export function StatusChip({ status }: { status: BuildWebIssueStatus }): React.JSX.Element {
  return <BuildWebToneChip label={statusLabel(status)} tone={statusTone(status)} />
}

export function PriorityChip({ priority }: { priority: number }): React.JSX.Element {
  return <BuildWebToneChip label={priorityLabel(priority)} tone={priorityTone(priority)} />
}

export function ProductChip({ product }: { product: BuildWebIssueProduct }): React.JSX.Element {
  return <BuildWebToneChip label={productLabel(product)} tone={productTone(product)} />
}

export function TypeChip({ type }: { type: string }): React.JSX.Element {
  return <BuildWebToneChip label={typeLabel(type)} tone={typeTone(type)} />
}

/** A Jira key and its status chip, coloured by the status name as build-web does. */
export function JiraStatusLine({
  jiraKey,
  status
}: {
  jiraKey: string
  status: string
}): React.JSX.Element {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-mono">{jiraKey}</span>
      {status ? <BuildWebToneChip label={status} tone={jiraStatusTone(status)} /> : null}
    </p>
  )
}
