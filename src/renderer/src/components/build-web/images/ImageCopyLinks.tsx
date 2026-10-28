import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { BuildWebDistChoice } from '../../../../../shared/build-web-dist-links'
import type { BuildWebImageBuild } from '../../../../../shared/build-web-image-types'
import { DistCopyMenu } from '../DistCopyMenu'
import { imageLinksByDist } from './image-links'

/** «Copy links» for the picked builds: one reference per line, each naming its build. */
export function ImageCopyLinks({ builds }: { builds: BuildWebImageBuild[] }): React.JSX.Element {
  const count = imageLinksByDist(builds, 'both').length
  const copy = async (links: string[], choice: BuildWebDistChoice): Promise<boolean> => {
    try {
      await window.api.ui.writeClipboardText(links.join('\n'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
      return false
    }
    const unpushed = imageLinksByDist(builds, choice).filter((l) => !l.pushed).length
    if (unpushed > 0) {
      toast.warning(
        translate(
          'buildWeb.images.linksNotPushed',
          '{{count}} of the copied images are not in the registry yet.',
          { count: unpushed }
        )
      )
    }
    return true
  }
  return (
    <DistCopyMenu
      variant="ghost"
      size="sm"
      linksOf={(choice) => imageLinksByDist(builds, choice).map((l) => l.ref)}
      onCopy={copy}
      label={
        count
          ? translate('buildWeb.images.copyLinksCount', 'Copy links ({{count}})', { count })
          : translate('buildWeb.images.copyLinks', 'Copy links')
      }
    />
  )
}
