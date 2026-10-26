import { Hammer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { BuildWebImageBuild } from '../../../../../shared/build-web-image-types'

/** What the build dialog opens with: the picked images, their product, and their common branch. */
export type ImageBuildChoice = { images: string[]; product: string; branch?: string }

/**
 * «Build N»: the picked images built together, one run on one version. Only one product's images
 * go together — the versions offered are that product's.
 */
export function ImageGroupBuildButton({
  builds,
  onBuild
}: {
  builds: readonly BuildWebImageBuild[]
  onBuild: (choice: ImageBuildChoice) => void
}): React.JSX.Element | null {
  const images = [...new Set(builds.map((b) => b.image))]
  if (images.length === 0) {
    return null
  }
  const products = [...new Set(builds.map((b) => b.product))]
  const branches = [...new Set(builds.map((b) => b.branch.replace(/^origin\//, '')))]
  const product = products.length === 1 ? products[0] : null
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!product}
      title={
        product
          ? undefined
          : translate(
              'buildWeb.imageBuild.oneProduct',
              'Pick images of one product to build them together'
            )
      }
      onClick={() =>
        product &&
        onBuild({ images, product, ...(branches.length === 1 ? { branch: branches[0] } : {}) })
      }
    >
      <Hammer />
      {translate('buildWeb.imageBuild.buildPicked', 'Build {{count}}', { count: images.length })}
    </Button>
  )
}
