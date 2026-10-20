import { useState } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { BuildWebImageBuild } from '../../../../../shared/build-web-image-types'
import { imageLinksOf, unpushedLinkCount } from './image-links'

/** «Copy links» for the picked builds: one reference per line, each naming its build. */
export function ImageCopyLinks({ builds }: { builds: BuildWebImageBuild[] }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const links = imageLinksOf(builds)
  const copy = async (): Promise<void> => {
    try {
      await window.api.ui.writeClipboardText(links.join('\n'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
    const unpushed = unpushedLinkCount(builds)
    if (unpushed > 0) {
      toast.warning(
        translate(
          'buildWeb.images.linksNotPushed',
          '{{count}} of the copied images are not in the registry yet.',
          { count: unpushed }
        )
      )
    }
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={links.length === 0}
      title={links.join('\n') || undefined}
      onClick={() => void copy()}
    >
      <Copy />
      {copied
        ? translate('buildWeb.images.copied', 'Copied')
        : links.length
          ? translate('buildWeb.images.copyLinksCount', 'Copy links ({{count}})', {
              count: links.length
            })
          : translate('buildWeb.images.copyLinks', 'Copy links')}
    </Button>
  )
}
