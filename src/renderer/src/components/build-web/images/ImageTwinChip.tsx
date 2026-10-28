import { Loader2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { BuildWebImageBuild } from '../../../../../shared/build-web-image-types'
import { imageTwinCellOf } from '../../../../../shared/build-web-image-twins'
import type { ChipTone } from '../build-web-tones'
import { TipChip } from '../issue/build/RunCellChips'

const TWIN_TONE: Record<'running' | 'failed' | 'built' | 'pushed', ChipTone> = {
  pushed: 'green',
  built: 'amber',
  running: 'blue',
  failed: 'red'
}

function twinLabel(state: keyof typeof TWIN_TONE): string {
  switch (state) {
    case 'pushed':
      return translate('buildWeb.images.twinPushed', 'redos')
    case 'built':
      return translate('buildWeb.images.twinBuilt', 'redos: not pushed')
    case 'running':
      return translate('buildWeb.images.twinRunning', 'redos: going')
    case 'failed':
      return translate('buildWeb.images.twinFailed', 'redos: failed')
  }
}

function twinHint(state: keyof typeof TWIN_TONE): string {
  switch (state) {
    case 'pushed':
      return translate('buildWeb.images.twinPushedHint', 'in the registry')
    case 'built':
      return translate('buildWeb.images.twinBuiltHint', 'not pushed — «Retry» on the run’s row')
    case 'running':
      return translate('buildWeb.images.twinRunningHint', 'being made')
    case 'failed':
      return translate('buildWeb.images.twinFailedHint', 'not made — «Retry» on the run’s row')
  }
}

/** IS-230.23, build-web's «redos» column: a rhel build's twin and its state, or a twin's rhel build. */
export function ImageTwinChip({ build }: { build: BuildWebImageBuild }): React.JSX.Element | null {
  const cell = imageTwinCellOf(build)
  if (!cell) {
    return null
  }
  if (cell.kind === 'source') {
    const n = String(cell.of ?? '?')
    return (
      <TipChip
        label={
          cell.full
            ? translate('buildWeb.images.twinFullFor', 'full for rhel #{{n}}', { n })
            : translate('buildWeb.images.twinFrom', 'from rhel #{{n}}', { n })
        }
        tone={null}
        tip={
          cell.ref ??
          translate('buildWeb.images.twinNoSource', 'The rhel build is not in the catalog')
        }
      />
    )
  }
  const how = cell.full
    ? translate('buildWeb.images.twinFullHow', 'full build #{{n}}', { n: String(cell.number) })
    : translate('buildWeb.images.twinDerivedHow', 'derived from this build')
  return (
    <TipChip
      icon={
        cell.state === 'running' ? (
          <Loader2 className="size-3 animate-spin text-chip-tone-blue" />
        ) : undefined
      }
      label={twinLabel(cell.state)}
      tone={TWIN_TONE[cell.state]}
      tip={`${cell.ref ?? build.image}: ${how}, ${twinHint(cell.state)}`}
    />
  )
}
