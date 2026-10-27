import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { twinChipOf } from '../../../../../../shared/build-web-redos-twin'
import { BuildWebToneChip } from '../../BuildWebToneChip'
import type { Cell } from './run-cells'
import { TipChip } from './RunCellChips'

/**
 * IS-230: what a row says about its redos, after build-web's Progress — a twin deriving, waiting for
 * a person or failed (with «Retry»), or a rhel row that gets none.
 */
export function RunTwinChip({
  cell,
  disabled,
  onRetry
}: {
  cell: Cell
  disabled: boolean
  onRetry: (cell: Cell) => void
}): React.JSX.Element | null {
  const chip = twinChipOf(cell)
  if (!chip) {
    return null
  }
  switch (chip.kind) {
    case 'deriving':
    case 'full-building':
      return (
        <span className="inline-flex items-center gap-1">
          <Loader2 className="size-3 animate-spin text-chip-tone-blue" />
          <BuildWebToneChip
            label={
              chip.kind === 'deriving'
                ? translate('buildWeb.run.twinDeriving', 'building redos')
                : translate('buildWeb.run.twinFullBuild', 'full redos build')
            }
            tone="blue"
          />
        </span>
      )
    case 'waiting':
      return (
        <TipChip
          label={translate('buildWeb.run.twinWaiting', 'redos awaits a decision')}
          tone="amber"
          tip={chip.tip}
        />
      )
    case 'failed':
      return (
        <>
          <TipChip
            label={translate('buildWeb.run.twinFailed', 'redos not built')}
            tone="red"
            tip={chip.tip}
          />
          <Button variant="outline" size="xs" disabled={disabled} onClick={() => onRetry(cell)}>
            {translate('buildWeb.run.twinRetry', 'Retry')}
          </Button>
        </>
      )
    case 'no-redos':
      return (
        <TipChip label={translate('buildWeb.run.noRedos', 'no redos')} tone={null} tip={chip.tip} />
      )
  }
}
