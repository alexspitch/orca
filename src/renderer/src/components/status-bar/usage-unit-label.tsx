import React from 'react'
import type { ProviderRateLimits } from '../../../../shared/rate-limit-types'
import type { StatusBarUsageMode } from '../../../../shared/status-bar-usage-mode'
import type { UsagePercentageDisplay } from '../../../../shared/usage-percentage-display'
import { translate } from '@/i18n/i18n'
import { getStatusBarUsageSections } from './status-bar-usage-sections'

export type UsageUnitLabelState = 'absent' | 'collapsed' | 'shown'

export function usageChipShowsPercentage(
  p: ProviderRateLimits | null,
  mode: StatusBarUsageMode
): boolean {
  return getStatusBarUsageSections(p, mode).length > 0
}

/** `chipKeys` names each provider's chip, in order; one chip per provider unless accounts split them. */
export function getUsageUnitLabelState(
  providers: readonly ProviderRateLimits[],
  collapsedProviders: readonly string[],
  mode: StatusBarUsageMode,
  chipKeys: readonly string[] = providers.map((p) => p.provider)
): UsageUnitLabelState {
  const withPercentage = providers.flatMap((p, index) =>
    usageChipShowsPercentage(p, mode) ? [chipKeys[index] ?? p.provider] : []
  )
  if (withPercentage.length === 0) {
    return 'absent'
  }
  return withPercentage.every((key) => collapsedProviders.includes(key)) ? 'collapsed' : 'shown'
}

/** Stays measurable while collapsed so the density calculation remains stable. */
export function UsageUnitLabel({
  collapsed,
  display
}: {
  collapsed: boolean
  display: UsagePercentageDisplay
}): React.JSX.Element {
  return (
    <span
      data-usage-unit
      data-usage-collapsed={collapsed}
      aria-hidden={collapsed}
      className="text-muted-foreground data-[usage-collapsed=true]:invisible data-[usage-collapsed=true]:absolute"
    >
      {display === 'used'
        ? translate('auto.components.status.bar.usageUnitLabel.used', 'Used')
        : translate('auto.components.status.bar.usageUnitLabel.remaining', 'Remaining')}
    </span>
  )
}
