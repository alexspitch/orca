import {
  ArrowDown,
  ArrowUp,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CircleSlash,
  CircleX,
  Dot,
  Equal,
  LoaderCircle,
  OctagonAlert,
  Plus,
  TriangleAlert,
  Waves,
  X,
  type LucideIcon
} from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { BuildWebTestDeltaKind } from '../../../../../../shared/build-web-test-history-types'
import type { ChipTone } from '../../build-web-tones'

// The marks of build-web's test history: a status by shape and colour, a transition by an arrow
// or a sign, so the two never read alike side by side.

export const TONE_TEXT: Record<ChipTone, string> = {
  neutral: 'text-chip-tone-neutral',
  faint: 'text-chip-tone-faint',
  blue: 'text-chip-tone-blue',
  purple: 'text-chip-tone-purple',
  cyan: 'text-chip-tone-cyan',
  sky: 'text-chip-tone-sky',
  green: 'text-chip-tone-green',
  amber: 'text-chip-tone-amber',
  ochre: 'text-chip-tone-ochre',
  orange: 'text-chip-tone-orange',
  red: 'text-chip-tone-red',
  crimson: 'text-chip-tone-crimson'
}

type Mark = { icon: LucideIcon; tone: ChipTone; label: () => string }

const STATUS: Record<string, Mark> = {
  running: {
    icon: LoaderCircle,
    tone: 'blue',
    label: () => translate('buildWeb.testHistory.status.running', 'running')
  },
  queued: {
    icon: Circle,
    tone: 'faint',
    label: () => translate('buildWeb.testHistory.status.queued', 'queued')
  },
  passed: {
    icon: CircleCheck,
    tone: 'green',
    label: () => translate('buildWeb.testHistory.status.passed', 'passed')
  },
  failed: {
    icon: CircleX,
    tone: 'red',
    label: () => translate('buildWeb.testHistory.status.failed', 'failed')
  },
  load_error: {
    icon: OctagonAlert,
    tone: 'red',
    label: () =>
      translate('buildWeb.testHistory.status.loadError', 'the suite did not start — no result')
  },
  // Why amber: a suite that collected nothing is a configuration failure dressed as a success.
  empty: {
    icon: CircleDashed,
    tone: 'amber',
    label: () => translate('buildWeb.testHistory.status.empty', 'no test was collected')
  },
  timeout: {
    icon: TriangleAlert,
    tone: 'amber',
    label: () =>
      translate(
        'buildWeb.testHistory.status.timeout',
        'killed by the watchdog (timeout or silence)'
      )
  },
  cancelled: {
    icon: CircleSlash,
    tone: 'neutral',
    label: () => translate('buildWeb.testHistory.status.cancelled', 'cancelled')
  },
  skipped: {
    icon: CircleMinus,
    tone: 'neutral',
    label: () => translate('buildWeb.testHistory.status.skipped', 'skipped')
  }
}
const UNKNOWN: Mark = { icon: Circle, tone: 'faint', label: () => '' }

function statusMark(status: string): Mark {
  // An agent run cut short: no result and nobody's fault, as a cancellation.
  return STATUS[status === 'interrupted' ? 'cancelled' : status] ?? UNKNOWN
}

export function testStatusLabel(status: string): string {
  return statusMark(status).label() || status
}

export function TestStatusMark({
  status,
  className
}: {
  status: string
  className?: string
}): React.JSX.Element {
  const mark = statusMark(status)
  const Icon = mark.icon
  const label = testStatusLabel(status)
  return (
    <Icon
      role="img"
      aria-label={label}
      className={cn(
        'size-3.5 shrink-0',
        TONE_TEXT[mark.tone],
        Icon === LoaderCircle && 'animate-spin',
        className
      )}
    >
      <title>{label}</title>
    </Icon>
  )
}

const TRANSITION: Record<BuildWebTestDeltaKind, Mark> = {
  broken: {
    icon: ArrowDown,
    tone: 'red',
    label: () => translate('buildWeb.testHistory.change.broken', 'passed, now fails')
  },
  still_failing: {
    icon: Equal,
    tone: 'red',
    label: () => translate('buildWeb.testHistory.change.stillFailing', 'failed and fails')
  },
  fixed: {
    icon: ArrowUp,
    tone: 'green',
    label: () => translate('buildWeb.testHistory.change.fixed', 'failed, now passes')
  },
  new: {
    icon: Plus,
    tone: 'blue',
    label: () => translate('buildWeb.testHistory.change.new', 'not in the previous run')
  },
  flaky: {
    icon: Waves,
    tone: 'amber',
    label: () =>
      translate('buildWeb.testHistory.change.flaky', 'changed status with the code unchanged')
  },
  disappeared: {
    icon: X,
    tone: 'neutral',
    label: () =>
      translate(
        'buildWeb.testHistory.change.disappeared',
        'was there and is gone: removed or no longer built'
      )
  },
  unchanged: {
    icon: Dot,
    tone: 'faint',
    label: () => translate('buildWeb.testHistory.change.unchanged', 'unchanged')
  }
}

export function transitionLabel(kind: BuildWebTestDeltaKind): string {
  return TRANSITION[kind].label()
}

export function TransitionMark({
  kind,
  className
}: {
  kind: BuildWebTestDeltaKind
  className?: string
}): React.JSX.Element {
  const mark = TRANSITION[kind]
  const Icon = mark.icon
  const label = `${kind} — ${mark.label()}`
  return (
    <Icon
      role="img"
      aria-label={label}
      className={cn('size-3.5 shrink-0', TONE_TEXT[mark.tone], className)}
    >
      <title>{label}</title>
    </Icon>
  )
}
