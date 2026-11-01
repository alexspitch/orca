import type { BuildWebRecap } from '../../../../../shared/build-web-recap-types'
import type { BuildWebIssueProduct } from '../../../../../shared/build-web-types'

// The version a recap is labelled with. The phone reads it too, so the product's name comes from
// the caller, never from the desktop's i18n.

export type RecapVersionLabel = {
  /** `3.1`, or `DC 3.1 +4` for a report that covers other versions too. */
  label: string
  /** Every version it covers, its own first; null when it covers one. */
  all: string | null
}

export function recapVersionLabel(
  recap: Pick<BuildWebRecap, 'product' | 'version' | 'versions'>,
  productLabel: (product: BuildWebIssueProduct) => string
): RecapVersionLabel | null {
  const own = recap.version
  const others = (recap.versions ?? []).filter((v) => v.id !== own?.id)
  if (others.length === 0) {
    return own ? { label: own.name, all: null } : null
  }
  const names = [
    ...(own ? [`${productLabel(recap.product)} ${own.name}`] : []),
    ...others.map((v) => `${productLabel(v.product)} ${v.name}`)
  ]
  return names.length === 1
    ? { label: names[0], all: null }
    : { label: `${names[0]} +${names.length - 1}`, all: names.join(', ') }
}
