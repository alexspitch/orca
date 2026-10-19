import { BUILD_WEB_PRODUCTS, type BuildWebProduct } from '../../../../../shared/build-web-types'
import { ProductChip } from '../BuildWebToneChip'

/** A card's product as build-web names it, or null for one this app does not know. */
export function standProductOf(product: string | null): BuildWebProduct | null {
  return BUILD_WEB_PRODUCTS.find((p) => p === product) ?? null
}

/** The product's chip in its Issues colour; nothing for a card without a known product. */
export function StandProductChip({
  product
}: {
  product: string | null
}): React.JSX.Element | null {
  const known = standProductOf(product)
  return known ? <ProductChip product={known} /> : null
}
