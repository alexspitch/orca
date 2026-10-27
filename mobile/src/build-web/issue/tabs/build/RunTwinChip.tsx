import { StyleSheet, View } from 'react-native'
import { twinChipOf } from '../../../../../../src/shared/build-web-redos-twin'
import type { Cell } from '../../../../../../src/renderer/src/components/build-web/issue/build/run-cells'
import { LoadingSpinner } from '../../../../components/LoadingSpinner'
import { chipTones, spacing } from '../../../../theme/mobile-theme'
import { BuildTabButton } from './BuildTabControls'
import { TipChip } from './RunChips'

/**
 * IS-230: what a row says about its redos, after build-web's Progress — a twin deriving, waiting for
 * a person, failed or not published yet (both with «Retry»), or a rhel row that gets none.
 */
export function RunTwinChip({
  cell,
  disabled,
  onRetry
}: {
  cell: Cell
  disabled: boolean
  onRetry: (cell: Cell) => void
}) {
  const chip = twinChipOf(cell)
  if (!chip) {
    return null
  }
  switch (chip.kind) {
    case 'deriving':
    case 'full-building':
      return (
        <View style={styles.inline}>
          <LoadingSpinner size={12} color={chipTones.blue} />
          <TipChip
            label={chip.kind === 'deriving' ? 'building redos' : 'full redos build'}
            tone="blue"
            tip={
              cell.twinOfNumber !== null
                ? `For rhel build #${cell.twinOfNumber}`
                : 'For the published rhel build of this image'
            }
          />
        </View>
      )
    case 'waiting':
      return <TipChip label="redos awaits a decision" tone="amber" tip={chip.tip} />
    case 'failed':
      return (
        <View style={styles.inline}>
          <TipChip label="redos not built" tone="red" tip={chip.tip} />
          <BuildTabButton label="Retry" disabled={disabled} onPress={() => onRetry(cell)} />
        </View>
      )
    case 'unpublished':
      return <BuildTabButton label="Retry" disabled={disabled} onPress={() => onRetry(cell)} />
    case 'no-redos':
      return <TipChip label="no redos" tone={null} tip={chip.tip} />
  }
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }
})
