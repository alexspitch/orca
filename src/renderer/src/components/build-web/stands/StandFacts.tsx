import { Lock } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { BuildWebStandGroup } from '../../../../../shared/build-web-stand-types'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { StandProductChip } from './StandProductChip'

export const productsOf = (group: BuildWebStandGroup) => [
  ...new Set(group.cards.map((c) => c.product))
]

/** Where the stand is, what it runs, and who holds it. */
export function StandFacts({
  group,
  withProducts = true
}: {
  group: BuildWebStandGroup
  /** False in the stands table, whose Product column names them. */
  withProducts?: boolean
}): React.JSX.Element {
  const products = withProducts ? productsOf(group) : []
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="truncate font-mono text-xs text-muted-foreground">
        {group.sshHost}:{group.dir}
      </span>
      {group.branch ? <BuildWebToneChip label={group.branch} tone={null} mono /> : null}
      {products.map((p) => (
        <StandProductChip key={p} product={p} />
      ))}
      {group.enabled ? null : (
        <BuildWebToneChip label={translate('buildWeb.stands.disabled', 'disabled')} tone="faint" />
      )}
      {group.lock ? (
        <span
          className="flex items-center gap-1 text-xs text-muted-foreground"
          title={group.lock.since ?? undefined}
        >
          <Lock className="size-3" />
          {group.lock.heldBy}
        </span>
      ) : null}
    </span>
  )
}
