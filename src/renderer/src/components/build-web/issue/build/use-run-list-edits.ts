import { useCallback } from 'react'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'
import type { BuildWebCombo } from '../../../../../../shared/build-web-run-types'
import { cellKey, type Cell } from './run-cells'
import type { RunActions } from './use-run-actions'

/** The run's list edited by hand: an image added on a branch, a row removed once confirmed. */
export function useRunListEdits(
  cells: Record<string, Cell>,
  actions: RunActions,
  onError: (message: string | null) => void
): {
  add: (image: string, dist: string, branch: string) => Promise<boolean>
  remove: (combo: BuildWebCombo) => Promise<void>
} {
  const confirm = useConfirmationDialog()

  const remove = useCallback(
    async (combo: BuildWebCombo) => {
      const accepted = await confirm({
        title: translate('buildWeb.run.removeTitle', 'Remove image from the list?'),
        description: translate(
          'buildWeb.run.removeBody',
          'Remove {{image}} ({{dist}}) from this run? This only drops it from the list; already-built images on the server are not affected.',
          { image: combo.image, dist: combo.dist }
        ),
        confirmLabel: translate('buildWeb.run.remove', 'Remove'),
        confirmVariant: 'destructive'
      })
      if (accepted) {
        await actions.remove(combo)
      }
    },
    [actions, confirm]
  )

  const add = async (image: string, dist: string, branch: string): Promise<boolean> => {
    const want = dist === 'both' ? ['rhel', 'redos'] : [dist]
    const missing = want.filter((d) => !cells[cellKey({ image, dist: d, branch })])
    if (missing.length === 0) {
      onError(
        translate(
          'buildWeb.run.alreadyListed',
          '{{image}} ({{dist}}) on {{branch}} is already in the list.',
          { image, dist, branch }
        )
      )
      return false
    }
    return actions.add(missing.map((d) => ({ image, dist: d, branch })))
  }

  return { add, remove }
}
