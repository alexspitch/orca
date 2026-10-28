import { useState } from 'react'
import { Copy } from 'lucide-react-native'
import {
  BUILD_WEB_DIST_CHOICES,
  type BuildWebDistChoice
} from '../../../src/shared/build-web-dist-links'
import { ActionSheetModal } from '../components/ActionSheetModal'
import { BuildTabButton } from './issue/tabs/build/BuildTabControls'

/** IS-230.23: «Copy links» asks which distribution — a ticked rhel build gives its redos twin too. */
export function DistCopyButton({
  label,
  linksOf,
  onCopy
}: {
  label: string
  linksOf: (choice: BuildWebDistChoice) => string[]
  /** True once the references are on the clipboard. */
  onCopy: (links: string[], choice: BuildWebDistChoice) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const copy = async (choice: BuildWebDistChoice): Promise<void> => {
    setOpen(false)
    if (await onCopy(linksOf(choice), choice)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }
  return (
    <>
      <BuildTabButton
        icon={Copy}
        label={copied ? 'Copied' : label}
        disabled={linksOf('both').length === 0}
        onPress={() => setOpen(true)}
      />
      <ActionSheetModal
        visible={open}
        title="References of which distribution"
        onClose={() => setOpen(false)}
        actions={BUILD_WEB_DIST_CHOICES.map((choice) => {
          const n = linksOf(choice).length
          return {
            label: `${choice === 'both' ? 'rhel + redos' : choice} (${n})`,
            icon: Copy,
            disabled: n === 0,
            onPress: () => void copy(choice)
          }
        })}
      />
    </>
  )
}
